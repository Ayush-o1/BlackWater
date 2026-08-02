import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { api } from '../helpers/request';
import { cleanDatabase, prisma } from '../helpers/db';
import { createOrgWithUser, createUser, createService, createIncident } from '../helpers/factories';

beforeEach(cleanDatabase);
afterAll(() => prisma.$disconnect());

describe('POST /incidents', () => {
  it('lets a MEMBER declare an incident and links affected services', async () => {
    const { org, user, token } = await createOrgWithUser('MEMBER');
    const service = await createService(org.id);

    const res = await api()
      .post('/incidents')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Elevated latency on checkout', severity: 'HIGH', serviceIds: [service.id] });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('TRIGGERED');
    expect(res.body.data.creatorId).toBe(user.id);
  });

  it('rejects a title shorter than 5 characters with 400', async () => {
    const { token } = await createOrgWithUser('MEMBER');

    const res = await api()
      .post('/incidents')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Bad', severity: 'LOW' });

    expect(res.status).toBe(400);
  });

  it('rejects a serviceId that belongs to another organization', async () => {
    const { token } = await createOrgWithUser('MEMBER');
    const { org: otherOrg } = await createOrgWithUser('MEMBER');
    const foreignService = await createService(otherOrg.id);

    const res = await api()
      .post('/incidents')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Cross tenant attempt', severity: 'LOW', serviceIds: [foreignService.id] });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('not found in this organization');
  });

  it('returns 403 for a VIEWER', async () => {
    const { token } = await createOrgWithUser('VIEWER');

    const res = await api()
      .post('/incidents')
      .set('Authorization', `Bearer ${token}`)
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

    const res = await api().get('/incidents').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].title).toBe('Mine to see');
  });

  it('filters by severity', async () => {
    const { org, user, token } = await createOrgWithUser('ADMIN');
    await createIncident(org.id, user.id, { title: 'Low severity issue', severity: 'LOW' });
    await createIncident(org.id, user.id, { title: 'Critical outage', severity: 'CRITICAL' });

    const res = await api()
      .get('/incidents')
      .query({ severity: 'CRITICAL' })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].title).toBe('Critical outage');
  });
});

describe('GET /incidents/:id', () => {
  it('returns 404 for an incident belonging to another organization', async () => {
    const { token } = await createOrgWithUser('ADMIN');
    const { org: otherOrg, user: otherUser } = await createOrgWithUser('ADMIN');
    const foreignIncident = await createIncident(otherOrg.id, otherUser.id);

    const res = await api().get(`/incidents/${foreignIncident.id}`).set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});

describe('PATCH /incidents/:id/status', () => {
  it('allows a valid transition and stamps resolvedAt', async () => {
    const { org, user, token } = await createOrgWithUser('MEMBER');
    const incident = await createIncident(org.id, user.id);

    const res = await api()
      .patch(`/incidents/${incident.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'RESOLVED' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('RESOLVED');
    expect(res.body.data.resolvedAt).not.toBeNull();
  });

  it('rejects an invalid transition with 400', async () => {
    const { org, user, token } = await createOrgWithUser('MEMBER');
    const incident = await createIncident(org.id, user.id);

    const res = await api()
      .patch(`/incidents/${incident.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'CLOSED' });

    expect(res.status).toBe(400);
  });

  it('refuses to modify a CLOSED incident', async () => {
    const { org, user, token } = await createOrgWithUser('ADMIN');
    const incident = await createIncident(org.id, user.id);
    await prisma.incident.update({ where: { id: incident.id }, data: { status: 'CLOSED' } });

    const res = await api()
      .patch(`/incidents/${incident.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'TRIGGERED' });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('closed');
  });

  it('recalculates the health of every affected service', async () => {
    const { org, user, token } = await createOrgWithUser('MEMBER');
    const service = await createService(org.id);
    const incident = await createIncident(org.id, user.id, {
      severity: 'CRITICAL',
      serviceIds: [service.id],
    });
    await prisma.service.update({ where: { id: service.id }, data: { status: 'MAJOR_OUTAGE' } });

    await api()
      .patch(`/incidents/${incident.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'RESOLVED' });

    const updatedService = await prisma.service.findUniqueOrThrow({ where: { id: service.id } });
    expect(updatedService.status).toBe('OPERATIONAL');
  });
});

describe('PATCH /incidents/:id/assign', () => {
  it('assigns to a user within the same organization', async () => {
    const { org, user: admin, token } = await createOrgWithUser('ADMIN');
    const { user: assignee } = await createUser(org.id, 'MEMBER');
    const incident = await createIncident(org.id, admin.id);

    const res = await api()
      .patch(`/incidents/${incident.id}/assign`)
      .set('Authorization', `Bearer ${token}`)
      .send({ assigneeId: assignee.id });

    expect(res.status).toBe(200);
    expect(res.body.data.assigneeId).toBe(assignee.id);
  });

  it('rejects an assignee from a different organization with 400', async () => {
    const { org, user, token } = await createOrgWithUser('ADMIN');
    const { user: foreignUser } = await createOrgWithUser('MEMBER');
    const incident = await createIncident(org.id, user.id);

    const res = await api()
      .patch(`/incidents/${incident.id}/assign`)
      .set('Authorization', `Bearer ${token}`)
      .send({ assigneeId: foreignUser.id });

    expect(res.status).toBe(400);
  });
});

describe('POST /incidents/:id/updates', () => {
  it('records both internal and public updates', async () => {
    const { org, user, token } = await createOrgWithUser('MEMBER');
    const incident = await createIncident(org.id, user.id);

    const res = await api()
      .post(`/incidents/${incident.id}/updates`)
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'Investigating the root cause.', isPublic: true });

    expect(res.status).toBe(201);
    expect(res.body.data.isPublic).toBe(true);
  });

  it('rejects an empty message with 400', async () => {
    const { org, user, token } = await createOrgWithUser('MEMBER');
    const incident = await createIncident(org.id, user.id);

    const res = await api()
      .post(`/incidents/${incident.id}/updates`)
      .set('Authorization', `Bearer ${token}`)
      .send({ message: '' });

    expect(res.status).toBe(400);
  });
});
