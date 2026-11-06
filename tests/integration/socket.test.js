import http from 'node:http';
import { io as connect } from 'socket.io-client';
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import app from '../../src/app.js';
import { initSocketServer } from '../../src/socket/index.js';
import { api } from '../helpers/request.js';
import { cleanDatabase, prisma } from '../helpers/db.js';
import { generateToken } from '../../src/utils/jwt.js';
import { addUserToOrg, bearer, createOrgWithUser, createIncident } from '../helpers/factories.js';

let httpServer;
let socketServer;
let url;
const openSockets = [];

beforeAll(async () => {
  httpServer = http.createServer(app);
  socketServer = initSocketServer(httpServer);
  await new Promise((resolve) => httpServer.listen(0, resolve));
  url = `http://localhost:${httpServer.address().port}`;
});

afterAll(async () => {
  socketServer.close();
  await prisma.$disconnect();
});

beforeEach(cleanDatabase);

afterEach(() => {
  while (openSockets.length) openSockets.pop().close();
});

function connectAs(token) {
  const socket = connect(url, { auth: { token }, transports: ['websocket'], reconnection: false });
  openSockets.push(socket);
  return socket;
}

const connected = (socket) =>
  new Promise((resolve, reject) => {
    socket.on('connect', resolve);
    socket.on('connect_error', reject);
  });

// Resolves with the payload of the next `event`, or with `null` after `ms`.
const nextEvent = (socket, event, ms = 1500) =>
  new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    socket.once(event, (payload) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });

describe('socket authentication when the server itself has a problem', () => {
  it('does not call an unexpected failure "Unauthorized", so the browser knows to retry', async () => {
    // Signed with our own secret, but with a payload our code never produces (a numeric
    // user id), so the user lookup throws a real error that is not a bad credential,
    // the same class of failure as a dropped database connection.
    const token = generateToken({ userId: 12345, orgId: 'x', role: 'ADMIN' });
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      const socket = connect(url, { auth: { token }, transports: ['websocket'], reconnection: false });
      openSockets.push(socket);
      const refusal = await new Promise((resolve) => socket.once('connect_error', resolve));

      // "Unauthorized" tells the browser the token will never work and to stop for good.
      expect(refusal.message).not.toContain('Unauthorized');
      expect(log).toHaveBeenCalled(); // and the cause is logged, no longer swallowed
    } finally {
      log.mockRestore();
    }
  });
});

describe('socket authentication', () => {
  it('rejects a connection without a token', async () => {
    const socket = connect(url, { transports: ['websocket'], reconnection: false });
    openSockets.push(socket);

    await expect(connected(socket)).rejects.toThrow('Unauthorized');
  });

  it('rejects a forged token', async () => {
    await expect(connected(connectAs('not.a.jwt'))).rejects.toThrow('Unauthorized');
  });

  it('rejects a valid token whose user no longer exists', async () => {
    const { user, token } = await createOrgWithUser('ADMIN');
    await prisma.user.delete({ where: { id: user.id } });

    await expect(connected(connectAs(token))).rejects.toThrow('Unauthorized');
  });

  it('accepts a valid token', async () => {
    const { token } = await createOrgWithUser('VIEWER');
    await expect(connected(connectAs(token))).resolves.toBeUndefined();
  });
});

// Cuts every connection at the transport level, the way a restart, a deploy or a
// dropped network does. (socket.disconnect() would send an explicit "disconnect"
// packet, which Socket.IO clients deliberately do not recover from.)
const dropAllConnections = () => socketServer.sockets.sockets.forEach((socket) => socket.conn.close());

describe('connection loss', () => {
  it('reconnects by itself after the server drops it and is back in its organization room', async () => {
    const { token } = await createOrgWithUser('ADMIN');
    const socket = connect(url, { auth: { token }, transports: ['websocket'], reconnectionDelay: 50, reconnectionDelayMax: 100 });
    openSockets.push(socket);
    await connected(socket);

    const reconnected = new Promise((resolve) => socket.io.once('reconnect', resolve));
    dropAllConnections();
    await reconnected;

    // The new connection went through authentication and joined the room again.
    const heard = nextEvent(socket, 'incident:created');
    const res = await api().post('/api/incidents').set('Authorization', bearer(token)).send({ title: 'After the reconnect', severity: 'LOW' });
    expect(await heard).toEqual({ id: res.body.data.id });
  });

  it('refuses to reconnect with a token that has stopped being valid', async () => {
    const { user, token } = await createOrgWithUser('ADMIN');
    const socket = connect(url, { auth: { token }, transports: ['websocket'], reconnectionDelay: 50, reconnectionDelayMax: 100 });
    openSockets.push(socket);
    await connected(socket);

    // The account disappears while the connection is up; the next handshake must fail.
    await prisma.user.delete({ where: { id: user.id } });
    const rejected = new Promise((resolve) => socket.once('connect_error', resolve));
    dropAllConnections();

    expect((await rejected).message).toContain('Unauthorized');
  });
});

describe('organization deletion', () => {
  it('cuts the deleted organization\'s connections and leaves other organizations\' alone', async () => {
    const mine = await createOrgWithUser('ADMIN');
    const theirs = await createOrgWithUser('ADMIN');
    const mySocket = connect(url, { auth: { token: mine.token }, transports: ['websocket'], reconnection: false });
    const theirSocket = connect(url, { auth: { token: theirs.token }, transports: ['websocket'], reconnection: false });
    openSockets.push(mySocket, theirSocket);
    // Both waiters exist before either is awaited: a socket that connects while the
    // other is still being waited for would otherwise fire its event unheard.
    await Promise.all([connected(mySocket), connected(theirSocket)]);
    const dropped = new Promise((resolve) => mySocket.once('disconnect', resolve));

    const res = await api().delete('/api/organizations/me').set('Authorization', bearer(mine.token)).send({ password: mine.password, confirmName: mine.org.name });
    expect(res.status).toBe(200);

    expect(await dropped).toBeTruthy();
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(theirSocket.connected).toBe(true);
  });
});

describe('real-time events', () => {
  it('tells everyone in the organization when an incident is created', async () => {
    const { org, token } = await createOrgWithUser('ADMIN');
    const { token: colleagueToken } = await addUserToOrg(org.id, 'VIEWER');
    const colleague = connectAs(colleagueToken);
    await connected(colleague);
    const heard = nextEvent(colleague, 'incident:created');

    const res = await api()
      .post('/api/incidents')
      .set('Authorization', bearer(token))
      .send({ title: 'Live update test', severity: 'LOW' });

    expect(await heard).toEqual({ id: res.body.data.id });
  });

  it('never delivers one organization\'s events to another', async () => {
    const { token } = await createOrgWithUser('ADMIN');
    const { token: outsiderToken } = await createOrgWithUser('ADMIN');
    const outsider = connectAs(outsiderToken);
    await connected(outsider);
    const heard = nextEvent(outsider, 'incident:created', 700);

    await api().post('/api/incidents').set('Authorization', bearer(token)).send({ title: 'Private to org A', severity: 'LOW' });

    expect(await heard).toBeNull();
  });

  it('announces status changes, edits, visibility changes and services', async () => {
    const { org, user, token } = await createOrgWithUser('ADMIN');
    const listener = connectAs(token);
    await connected(listener);
    const incident = await createIncident(org.id, user.id);

    const statusHeard = nextEvent(listener, 'incident:updated');
    await api().patch(`/api/incidents/${incident.id}/status`).set('Authorization', bearer(token)).send({ status: 'ACKNOWLEDGED' });
    expect(await statusHeard).toEqual({ id: incident.id });

    const visibilityHeard = nextEvent(listener, 'incident:updated');
    await api().patch(`/api/incidents/${incident.id}/visibility`).set('Authorization', bearer(token)).send({ isPublic: true });
    expect(await visibilityHeard).toEqual({ id: incident.id });

    const serviceHeard = nextEvent(listener, 'service:changed');
    await api().post('/api/services').set('Authorization', bearer(token)).send({ name: 'New service' });
    expect(await serviceHeard).toMatchObject({ id: expect.any(String) });
  });

  it('does not announce a rejected change', async () => {
    const { org, user, token } = await createOrgWithUser('ADMIN');
    const listener = connectAs(token);
    await connected(listener);
    const incident = await createIncident(org.id, user.id);
    const heard = nextEvent(listener, 'incident:updated', 700);

    const res = await api().patch(`/api/incidents/${incident.id}/status`).set('Authorization', bearer(token)).send({ status: 'CLOSED' });

    expect(res.status).toBe(400);
    expect(await heard).toBeNull();
  });

  it('announces a new teammate when an invitation is accepted', async () => {
    const { token } = await createOrgWithUser('ADMIN');
    const listener = connectAs(token);
    await connected(listener);
    const invitation = await api().post('/api/invitations').set('Authorization', bearer(token)).send({ role: 'MEMBER' });
    const heard = nextEvent(listener, 'team:changed');

    await api().post('/api/invitations/accept').send({
      token: invitation.body.data.token,
      name: 'New Person',
      email: 'new.person@blackwater.test',
      password: 'CorrectHorse!9',
    });

    expect(await heard).toMatchObject({ id: expect.any(String) });
  });

  it('exposes no way for a client to join another organization\'s room', async () => {
    const { token } = await createOrgWithUser('ADMIN');
    const { org: otherOrg, user: otherUser, token: otherToken } = await createOrgWithUser('ADMIN');
    const attacker = connectAs(token);
    await connected(attacker);
    // Old versions of the protocol let a client request rooms; these events must now do nothing.
    attacker.emit('join:incident', 'anything');
    attacker.emit('join', `organization:${otherOrg.id}`);
    const heard = nextEvent(attacker, 'incident:created', 700);

    await api().post('/api/incidents').set('Authorization', bearer(otherToken)).send({ title: 'Other org incident', severity: 'LOW' });

    expect(await heard).toBeNull();
    expect(otherUser).toBeDefined();
  });
});
