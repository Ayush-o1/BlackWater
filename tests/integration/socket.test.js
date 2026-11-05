import http from 'node:http';
import { io as connect } from 'socket.io-client';
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import app from '../../src/app.js';
import { initSocketServer } from '../../src/socket/index.js';
import { api } from '../helpers/request.js';
import { cleanDatabase, prisma } from '../helpers/db.js';
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
