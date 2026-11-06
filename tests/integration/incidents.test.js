import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { api } from '../helpers/request.js';
import { cleanDatabase, prisma } from '../helpers/db.js';
import {
  addUserToOrg,
  bearer,
  createOrgWithUser,
  createService,
  createIncident,
} from '../helpers/factories.js';

beforeEach(cleanDatabase);
afterAll(() => prisma.$disconnect());

const timelineOf = (incidentId) =>
  prisma.timelineEvent.findMany({ where: { incidentId }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });

const setStatus = (token, incidentId, status) =>
  api().patch(`/api/incidents/${incidentId}/status`).set('Authorization', bearer(token)).send({ status });

describe('POST /incidents', () => {
  it('lets a MEMBER declare an incident, private by default, and links affected services', async () => {
    const { org, user, token } = await createOrgWithUser('MEMBER');
    const service = await createService(org.id);

    const res = await api()
      .post('/api/incidents')
      .set('Authorization', bearer(token))
      .send({ title: 'Elevated latency on checkout', severity: 'HIGH', serviceIds: [service.id] });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('TRIGGERED');
    expect(res.body.data.isPublic).toBe(false);
    expect(res.body.data.creatorId).toBe(user.id);

    const details = await api().get(`/api/incidents/${res.body.data.id}`).set('Authorization', bearer(token));
    expect(details.body.data.affectedServices).toEqual([
      { id: service.id, name: service.name, status: 'PARTIAL_OUTAGE', openIncidentCount: 1 },
    ]);
  });

  it('can create an incident that is public from the start', async () => {
    const { token } = await createOrgWithUser('MEMBER');

    const res = await api()
      .post('/api/incidents')
      .set('Authorization', bearer(token))
      .send({ title: 'Public from the start', severity: 'LOW', isPublic: true });

    expect(res.status).toBe(201);
    expect(res.body.data.isPublic).toBe(true);
  });

  it('records who created it in the timeline', async () => {
    const { user, token } = await createOrgWithUser('MEMBER');

    const res = await api()
      .post('/api/incidents')
      .set('Authorization', bearer(token))
      .send({ title: 'Who did this', severity: 'LOW' });

    const [event] = await timelineOf(res.body.data.id);
    expect(event.eventType).toBe('INCIDENT_CREATED');
    expect(event.actorId).toBe(user.id);
  });

  it('rejects a title shorter than 5 characters with 400', async () => {
    const { token } = await createOrgWithUser('MEMBER');

    const res = await api().post('/api/incidents').set('Authorization', bearer(token)).send({ title: 'Bad', severity: 'LOW' });

    expect(res.status).toBe(400);
  });

  it('rejects a serviceId that belongs to another organization and creates nothing', async () => {
    const { token } = await createOrgWithUser('MEMBER');
    const { org: otherOrg } = await createOrgWithUser('MEMBER');
    const foreignService = await createService(otherOrg.id);

    const res = await api()
      .post('/api/incidents')
      .set('Authorization', bearer(token))
      .send({ title: 'Cross tenant attempt', severity: 'LOW', serviceIds: [foreignService.id] });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('not found in this organization');
    expect(await prisma.incident.count()).toBe(0);
  });

  it('returns 403 for a VIEWER', async () => {
    const { token } = await createOrgWithUser('VIEWER');

    const res = await api()
      .post('/api/incidents')
      .set('Authorization', bearer(token))
      .send({ title: 'Should not be allowed', severity: 'LOW' });

    expect(res.status).toBe(403);
  });
});

describe('GET /incidents', () => {
  it('only returns incidents scoped to the caller organization', async () => {
    const { org, user, token } = await createOrgWithUser('ADMIN');
    const { org: otherOrg, user: otherUser } = await createOrgWithUser('ADMIN');
    await createIncident(org.id, user.id, { title: 'Mine to see' });
    await createIncident(otherOrg.id, otherUser.id, { title: 'Not mine' });

    const res = await api().get('/api/incidents').set('Authorization', bearer(token));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].title).toBe('Mine to see');
  });

  it('filters by severity', async () => {
    const { org, user, token } = await createOrgWithUser('ADMIN');
    await createIncident(org.id, user.id, { title: 'Low severity issue', severity: 'LOW' });
    await createIncident(org.id, user.id, { title: 'Critical outage', severity: 'CRITICAL' });

    const res = await api().get('/api/incidents').query({ severity: 'CRITICAL' }).set('Authorization', bearer(token));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].title).toBe('Critical outage');
  });

  it('rejects a non-numeric limit with 400', async () => {
    const { token } = await createOrgWithUser('ADMIN');

    const res = await api().get('/api/incidents').query({ limit: 'abc' }).set('Authorization', bearer(token));

    expect(res.status).toBe(400);
  });
});

describe('GET /incidents/:id', () => {
  it('returns 404 for an incident belonging to another organization', async () => {
    const { token } = await createOrgWithUser('ADMIN');
    const { org: otherOrg, user: otherUser } = await createOrgWithUser('ADMIN');
    const foreignIncident = await createIncident(otherOrg.id, otherUser.id);

    const res = await api().get(`/api/incidents/${foreignIncident.id}`).set('Authorization', bearer(token));

    expect(res.status).toBe(404);
  });

  it('includes the timeline with the name of whoever made each change', async () => {
    const { org, user, token } = await createOrgWithUser('MEMBER', { name: 'Tara Nair' });
    const incident = await createIncident(org.id, user.id);
    await setStatus(token, incident.id, 'ACKNOWLEDGED');

    const res = await api().get(`/api/incidents/${incident.id}`).set('Authorization', bearer(token));

    const statusEvent = res.body.data.timelineEvents.find((e) => e.eventType === 'STATUS_CHANGED');
    expect(statusEvent.actor).toEqual({ id: user.id, name: 'Tara Nair' });
    expect(statusEvent.metadata).toEqual({ oldStatus: 'TRIGGERED', newStatus: 'ACKNOWLEDGED' });
  });
});

describe('PATCH /incidents/:id/status', () => {
  it('allows a valid transition, stamps resolvedAt, and records the actor', async () => {
    const { org, user, token } = await createOrgWithUser('MEMBER');
    const incident = await createIncident(org.id, user.id);

    const res = await setStatus(token, incident.id, 'RESOLVED');

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('RESOLVED');
    expect(res.body.data.resolvedAt).not.toBeNull();

    const events = await timelineOf(incident.id);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ eventType: 'STATUS_CHANGED', actorId: user.id });
  });

  it('stamps acknowledgedAt only when moving from TRIGGERED to ACKNOWLEDGED', async () => {
    const { org, user, token } = await createOrgWithUser('MEMBER');
    const incident = await createIncident(org.id, user.id);

    const res = await setStatus(token, incident.id, 'ACKNOWLEDGED');

    expect(res.body.data.acknowledgedAt).not.toBeNull();
    expect(res.body.data.resolvedAt).toBeNull();
  });

  it('clears resolvedAt and acknowledgedAt when a resolved incident is reopened', async () => {
    const { org, user, token } = await createOrgWithUser('MEMBER');
    const incident = await createIncident(org.id, user.id);
    await setStatus(token, incident.id, 'ACKNOWLEDGED');
    await setStatus(token, incident.id, 'RESOLVED');

    const reopened = await setStatus(token, incident.id, 'TRIGGERED');

    expect(reopened.status).toBe(200);
    expect(reopened.body.data.status).toBe('TRIGGERED');
    expect(reopened.body.data.resolvedAt).toBeNull();
    expect(reopened.body.data.acknowledgedAt).toBeNull();
  });

  it('puts a reopened incident back into the service health calculation', async () => {
    const { org, user, token } = await createOrgWithUser('MEMBER');
    const service = await createService(org.id);
    const incident = await createIncident(org.id, user.id, { severity: 'CRITICAL', serviceIds: [service.id] });
    const health = async () =>
      (await api().get(`/api/services/${service.id}`).set('Authorization', bearer(token))).body.data.status;

    await setStatus(token, incident.id, 'RESOLVED');
    expect(await health()).toBe('OPERATIONAL');

    await setStatus(token, incident.id, 'TRIGGERED');
    expect(await health()).toBe('MAJOR_OUTAGE');
  });

  it('rejects an invalid transition with 400 and writes nothing', async () => {
    const { org, user, token } = await createOrgWithUser('MEMBER');
    const incident = await createIncident(org.id, user.id);

    const res = await setStatus(token, incident.id, 'CLOSED');

    expect(res.status).toBe(400);
    expect(await timelineOf(incident.id)).toHaveLength(0);
  });

  it('refuses to modify a CLOSED incident', async () => {
    const { org, user, token } = await createOrgWithUser('ADMIN');
    const incident = await createIncident(org.id, user.id, { status: 'CLOSED' });

    const res = await setStatus(token, incident.id, 'TRIGGERED');

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('closed');
  });

  it('returns 404 for another organization\'s incident', async () => {
    const { token } = await createOrgWithUser('MEMBER');
    const { org: otherOrg, user: otherUser } = await createOrgWithUser('MEMBER');
    const foreign = await createIncident(otherOrg.id, otherUser.id);

    const res = await setStatus(token, foreign.id, 'RESOLVED');

    expect(res.status).toBe(404);
    expect((await prisma.incident.findUniqueOrThrow({ where: { id: foreign.id } })).status).toBe('TRIGGERED');
  });

  it('lets exactly one of two simultaneous identical changes win', async () => {
    const { org, user, token } = await createOrgWithUser('MEMBER');
    const incident = await createIncident(org.id, user.id);

    const results = await Promise.all([
      setStatus(token, incident.id, 'RESOLVED'),
      setStatus(token, incident.id, 'RESOLVED'),
      setStatus(token, incident.id, 'RESOLVED'),
    ]);

    expect(results.map((r) => r.status).sort()).toEqual([200, 400, 400]);
    // One change, one audit entry.
    expect(await timelineOf(incident.id)).toHaveLength(1);
  });

  it('applies simultaneous different changes one after the other, each validated against the latest status', async () => {
    const { org, user, token } = await createOrgWithUser('MEMBER');
    const incident = await createIncident(org.id, user.id);

    // CLOSED is legal only after RESOLVED. Racing the two means either order can
    // happen, but the recorded history must always be a legal path:
    //   RESOLVED then CLOSED, or CLOSED rejected and only RESOLVED applied.
    // It must never contain CLOSED without a preceding RESOLVED.
    const results = await Promise.all([setStatus(token, incident.id, 'RESOLVED'), setStatus(token, incident.id, 'CLOSED')]);

    const events = await timelineOf(incident.id);
    const path = events.map((event) => event.metadata.newStatus);
    const final = await prisma.incident.findUniqueOrThrow({ where: { id: incident.id } });

    expect([['RESOLVED'], ['RESOLVED', 'CLOSED']]).toContainEqual(path);
    expect(final.status).toBe(path[path.length - 1]);
    expect(results.filter((r) => r.status === 200)).toHaveLength(path.length);
  });
});

describe('PATCH /incidents/:id (edit)', () => {
  it('changes title, description and severity, and records the before and after', async () => {
    const { org, user, token } = await createOrgWithUser('MEMBER');
    const incident = await createIncident(org.id, user.id, { title: 'Original title', severity: 'LOW' });

    const res = await api()
      .patch(`/api/incidents/${incident.id}`)
      .set('Authorization', bearer(token))
      .send({ title: 'Corrected title', severity: 'CRITICAL', description: 'Now with details' });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ title: 'Corrected title', severity: 'CRITICAL', description: 'Now with details' });

    const [event] = await timelineOf(incident.id);
    expect(event).toMatchObject({ eventType: 'INCIDENT_EDITED', actorId: user.id });
    expect(event.metadata.changes).toEqual({
      title: { from: 'Original title', to: 'Corrected title' },
      severity: { from: 'LOW', to: 'CRITICAL' },
      description: { from: null, to: 'Now with details' },
    });
  });

  it('changes the health of affected services when the severity changes', async () => {
    const { org, user, token } = await createOrgWithUser('MEMBER');
    const service = await createService(org.id);
    const incident = await createIncident(org.id, user.id, { severity: 'LOW', serviceIds: [service.id] });
    const health = async () =>
      (await api().get(`/api/services/${service.id}`).set('Authorization', bearer(token))).body.data.status;

    expect(await health()).toBe('DEGRADED');
    await api().patch(`/api/incidents/${incident.id}`).set('Authorization', bearer(token)).send({ severity: 'CRITICAL' });
    expect(await health()).toBe('MAJOR_OUTAGE');
  });

  it('can change which services are affected, recording what was added and removed', async () => {
    const { org, user, token } = await createOrgWithUser('MEMBER');
    const keep = await createService(org.id, { name: 'Keep' });
    const drop = await createService(org.id, { name: 'Drop' });
    const add = await createService(org.id, { name: 'Add' });
    const incident = await createIncident(org.id, user.id, { serviceIds: [keep.id, drop.id] });

    const res = await api()
      .patch(`/api/incidents/${incident.id}`)
      .set('Authorization', bearer(token))
      .send({ serviceIds: [keep.id, add.id] });

    expect(res.status).toBe(200);
    const linked = await prisma.incident.findUniqueOrThrow({
      where: { id: incident.id },
      select: { affectedServices: { select: { name: true }, orderBy: { name: 'asc' } } },
    });
    expect(linked.affectedServices.map((s) => s.name)).toEqual(['Add', 'Keep']);

    const [event] = await timelineOf(incident.id);
    expect(event.metadata.changes.services.added.map((s) => s.name)).toEqual(['Add']);
    expect(event.metadata.changes.services.removed.map((s) => s.name)).toEqual(['Drop']);
  });

  it('refuses to link a service from another organization', async () => {
    const { org, user, token } = await createOrgWithUser('MEMBER');
    const { org: otherOrg } = await createOrgWithUser('MEMBER');
    const foreign = await createService(otherOrg.id);
    const incident = await createIncident(org.id, user.id);

    const res = await api()
      .patch(`/api/incidents/${incident.id}`)
      .set('Authorization', bearer(token))
      .send({ serviceIds: [foreign.id] });

    expect(res.status).toBe(400);
  });

  it('does not add an audit entry when nothing actually changed', async () => {
    const { org, user, token } = await createOrgWithUser('MEMBER');
    const incident = await createIncident(org.id, user.id, { title: 'Same title here' });

    const res = await api()
      .patch(`/api/incidents/${incident.id}`)
      .set('Authorization', bearer(token))
      .send({ title: 'Same title here' });

    expect(res.status).toBe(200);
    expect(await timelineOf(incident.id)).toHaveLength(0);
  });

  it('cannot be used to change status, assignee or visibility', async () => {
    const { org, user, token } = await createOrgWithUser('MEMBER');
    const incident = await createIncident(org.id, user.id);

    const res = await api()
      .patch(`/api/incidents/${incident.id}`)
      .set('Authorization', bearer(token))
      .send({ title: 'A fine new title', status: 'CLOSED', isPublic: true, orgId: 'x', creatorId: 'x' });

    expect(res.status).toBe(200);
    const after = await prisma.incident.findUniqueOrThrow({ where: { id: incident.id } });
    expect(after).toMatchObject({ status: 'TRIGGERED', isPublic: false, orgId: org.id, creatorId: user.id });
  });

  it('requires at least one field, and refuses to edit a CLOSED incident', async () => {
    const { org, user, token } = await createOrgWithUser('MEMBER');
    const incident = await createIncident(org.id, user.id, { status: 'CLOSED' });

    const empty = await api().patch(`/api/incidents/${incident.id}`).set('Authorization', bearer(token)).send({});
    const closed = await api().patch(`/api/incidents/${incident.id}`).set('Authorization', bearer(token)).send({ title: 'Too late now' });

    expect(empty.status).toBe(400);
    expect(closed.status).toBe(400);
  });

  it('returns 403 for a VIEWER', async () => {
    const { org, user } = await createOrgWithUser('MEMBER');
    const { token: viewerToken } = await addUserToOrg(org.id, 'VIEWER');
    const incident = await createIncident(org.id, user.id);

    const res = await api().patch(`/api/incidents/${incident.id}`).set('Authorization', bearer(viewerToken)).send({ title: 'Nope nope' });

    expect(res.status).toBe(403);
  });
});

describe('PATCH /incidents/:id/assign', () => {
  it('assigns to a user within the same organization and records who and to whom', async () => {
    const { org, user: admin, token } = await createOrgWithUser('ADMIN');
    const { user: assignee } = await addUserToOrg(org.id, 'MEMBER', { name: 'Ishaan Rao' });
    const incident = await createIncident(org.id, admin.id);

    const res = await api()
      .patch(`/api/incidents/${incident.id}/assign`)
      .set('Authorization', bearer(token))
      .send({ assigneeId: assignee.id });

    expect(res.status).toBe(200);
    expect(res.body.data.assigneeId).toBe(assignee.id);

    const [event] = await timelineOf(incident.id);
    expect(event).toMatchObject({ eventType: 'ASSIGNEE_CHANGED', actorId: admin.id });
    expect(event.metadata).toEqual({ from: null, to: { id: assignee.id, name: 'Ishaan Rao' } });
  });

  it('unassigns when assigneeId is null', async () => {
    const { org, user: admin, token } = await createOrgWithUser('ADMIN');
    const incident = await createIncident(org.id, admin.id);
    await prisma.incident.update({ where: { id: incident.id }, data: { assigneeId: admin.id } });

    const res = await api()
      .patch(`/api/incidents/${incident.id}/assign`)
      .set('Authorization', bearer(token))
      .send({ assigneeId: null });

    expect(res.status).toBe(200);
    expect(res.body.data.assigneeId).toBeNull();
    const [event] = await timelineOf(incident.id);
    expect(event.metadata.to).toBeNull();
    expect(event.metadata.from.id).toBe(admin.id);
  });

  it('does not add an audit entry when the assignee is unchanged', async () => {
    const { org, user: admin, token } = await createOrgWithUser('ADMIN');
    const incident = await createIncident(org.id, admin.id);

    await api().patch(`/api/incidents/${incident.id}/assign`).set('Authorization', bearer(token)).send({ assigneeId: null });

    expect(await timelineOf(incident.id)).toHaveLength(0);
  });

  it('rejects an assignee from a different organization with 400', async () => {
    const { org, user, token } = await createOrgWithUser('ADMIN');
    const { user: foreignUser } = await createOrgWithUser('MEMBER');
    const incident = await createIncident(org.id, user.id);

    const res = await api()
      .patch(`/api/incidents/${incident.id}/assign`)
      .set('Authorization', bearer(token))
      .send({ assigneeId: foreignUser.id });

    expect(res.status).toBe(400);
    expect((await prisma.incident.findUniqueOrThrow({ where: { id: incident.id } })).assigneeId).toBeNull();
  });
});

describe('POST /incidents/:id/updates', () => {
  it('records both internal and public updates, with the author in the timeline', async () => {
    const { org, user, token } = await createOrgWithUser('MEMBER');
    const incident = await createIncident(org.id, user.id);

    const res = await api()
      .post(`/api/incidents/${incident.id}/updates`)
      .set('Authorization', bearer(token))
      .send({ message: 'Investigating the root cause.', isPublic: true });

    expect(res.status).toBe(201);
    expect(res.body.data.isPublic).toBe(true);
    const [event] = await timelineOf(incident.id);
    expect(event).toMatchObject({ eventType: 'UPDATE_ADDED', actorId: user.id });
  });

  it('rejects an empty message with 400', async () => {
    const { org, user, token } = await createOrgWithUser('MEMBER');
    const incident = await createIncident(org.id, user.id);

    const res = await api().post(`/api/incidents/${incident.id}/updates`).set('Authorization', bearer(token)).send({ message: '' });

    expect(res.status).toBe(400);
  });

  it('refuses updates on a CLOSED incident', async () => {
    const { org, user, token } = await createOrgWithUser('MEMBER');
    const incident = await createIncident(org.id, user.id, { status: 'CLOSED' });

    const res = await api().post(`/api/incidents/${incident.id}/updates`).set('Authorization', bearer(token)).send({ message: 'Late note' });

    expect(res.status).toBe(400);
  });
});

describe('PATCH /incidents/:id/visibility', () => {
  it('publishes and unpublishes, auditing each change', async () => {
    const { org, user, token } = await createOrgWithUser('MEMBER');
    const incident = await createIncident(org.id, user.id);
    const set = (isPublic) =>
      api().patch(`/api/incidents/${incident.id}/visibility`).set('Authorization', bearer(token)).send({ isPublic });

    const published = await set(true);
    expect(published.status).toBe(200);
    expect(published.body.data.isPublic).toBe(true);

    const unpublished = await set(false);
    expect(unpublished.body.data.isPublic).toBe(false);

    const events = await timelineOf(incident.id);
    expect(events.map((e) => [e.eventType, e.metadata.isPublic, e.actorId])).toEqual([
      ['VISIBILITY_CHANGED', true, user.id],
      ['VISIBILITY_CHANGED', false, user.id],
    ]);
  });

  it('does not audit a no-op', async () => {
    const { org, user, token } = await createOrgWithUser('MEMBER');
    const incident = await createIncident(org.id, user.id);

    await api().patch(`/api/incidents/${incident.id}/visibility`).set('Authorization', bearer(token)).send({ isPublic: false });

    expect(await timelineOf(incident.id)).toHaveLength(0);
  });

  it('is allowed for MEMBER and ADMIN but not VIEWER, and not across organizations', async () => {
    const { org, user } = await createOrgWithUser('MEMBER');
    const { token: viewerToken } = await addUserToOrg(org.id, 'VIEWER');
    const { token: outsiderToken } = await createOrgWithUser('ADMIN');
    const incident = await createIncident(org.id, user.id);
    const attempt = (token) =>
      api().patch(`/api/incidents/${incident.id}/visibility`).set('Authorization', bearer(token)).send({ isPublic: true });

    expect((await attempt(viewerToken)).status).toBe(403);
    expect((await attempt(outsiderToken)).status).toBe(404);
    expect((await prisma.incident.findUniqueOrThrow({ where: { id: incident.id } })).isPublic).toBe(false);
  });

  it('allows unpublishing a CLOSED incident', async () => {
    const { org, user, token } = await createOrgWithUser('MEMBER');
    const incident = await createIncident(org.id, user.id, { status: 'CLOSED', isPublic: true });

    const res = await api().patch(`/api/incidents/${incident.id}/visibility`).set('Authorization', bearer(token)).send({ isPublic: false });

    expect(res.status).toBe(200);
    expect(res.body.data.isPublic).toBe(false);
  });
});
