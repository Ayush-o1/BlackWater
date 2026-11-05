import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { api } from '../helpers/request.js';
import { cleanDatabase, prisma } from '../helpers/db.js';
import { addUserToOrg, bearer, createIncident, createOrgWithUser, createService } from '../helpers/factories.js';

beforeEach(cleanDatabase);
afterAll(() => prisma.$disconnect());

describe('sensitive data never appears in responses', () => {
  it('leaks no password hash or invitation token hash from any endpoint', async () => {
    const { org, user, token } = await createOrgWithUser('ADMIN');
    const { user: teammate } = await addUserToOrg(org.id, 'MEMBER');
    const service = await createService(org.id);
    const incident = await createIncident(org.id, user.id, { serviceIds: [service.id], isPublic: true });
    await api().patch(`/api/incidents/${incident.id}/assign`).set('Authorization', bearer(token)).send({ assigneeId: teammate.id });
    await api().post('/api/invitations').set('Authorization', bearer(token)).send({ role: 'VIEWER' });

    const registration = await api().post('/api/auth/register').send({
      name: 'Another Person', email: 'another@blackwater.test', password: 'CorrectHorse!9', orgName: 'Another Org',
    });

    const responses = await Promise.all([
      api().get('/api/auth/me').set('Authorization', bearer(token)),
      api().get('/api/users').set('Authorization', bearer(token)),
      api().get('/api/users/me').set('Authorization', bearer(token)),
      api().get('/api/organizations/me').set('Authorization', bearer(token)),
      api().get('/api/incidents').set('Authorization', bearer(token)),
      api().get(`/api/incidents/${incident.id}`).set('Authorization', bearer(token)),
      api().get('/api/services').set('Authorization', bearer(token)),
      api().get(`/api/services/${service.id}`).set('Authorization', bearer(token)),
      api().get('/api/invitations').set('Authorization', bearer(token)),
      api().get('/api/dashboard').set('Authorization', bearer(token)),
      api().get('/api/status').query({ orgId: org.id }),
      api().get(`/api/status/incidents/${incident.id}`).query({ orgId: org.id }),
      Promise.resolve(registration),
    ]);

    for (const res of responses) {
      const body = JSON.stringify(res.body);
      expect(body).not.toMatch(/passwordHash/i);
      expect(body).not.toMatch(/tokenHash/i);
      expect(body).not.toContain('$2b$'); // bcrypt hashes
    }
  });

  it('answers with a generic message for any login failure and never says which part was wrong', async () => {
    const { user } = await createOrgWithUser('ADMIN');

    const wrongPassword = await api().post('/api/auth/login').send({ email: user.email, password: 'nope-nope-nope' });
    const unknownEmail = await api().post('/api/auth/login').send({ email: 'nobody@blackwater.test', password: 'nope-nope-nope' });

    expect(wrongPassword.body).toEqual(unknownEmail.body);
  });
});

describe('request limits', () => {
  it('rejects a request body over the size limit with 413', async () => {
    const huge = { name: 'x'.repeat(150_000), email: 'big@blackwater.test', password: 'CorrectHorse!9', orgName: 'Big Org' };

    const res = await api().post('/api/auth/register').send(huge);

    expect(res.status).toBe(413);
    expect(res.body).toEqual({ success: false, message: 'Request body is too large' });
  });

  it('caps how many services an incident can link', async () => {
    const { token } = await createOrgWithUser('MEMBER');
    const tooMany = Array.from({ length: 101 }, () => '3f2b8c1e-6a4d-4f5b-9c7e-1a2b3c4d5e6f');

    const res = await api().post('/api/incidents').set('Authorization', bearer(token)).send({ title: 'Linking far too many', severity: 'LOW', serviceIds: tooMany });

    expect(res.status).toBe(400);
  });
});

describe('audit trail and deleted users', () => {
  it('keeps timeline events when their author is deleted, shown as having no actor', async () => {
    const { org, user, token } = await createOrgWithUser('ADMIN');
    const { user: temp, token: tempToken } = await addUserToOrg(org.id, 'MEMBER', { name: 'Temp Worker' });
    const incident = await createIncident(org.id, user.id);
    await api().patch(`/api/incidents/${incident.id}/status`).set('Authorization', bearer(tempToken)).send({ status: 'ACKNOWLEDGED' });

    // The database allows deleting a person who only ever acted on timelines.
    await prisma.user.delete({ where: { id: temp.id } });

    const res = await api().get(`/api/incidents/${incident.id}`).set('Authorization', bearer(token));
    expect(res.status).toBe(200);
    const [event] = res.body.data.timelineEvents;
    expect(event).toMatchObject({ eventType: 'STATUS_CHANGED', actor: null, actorId: null });
    expect(event.metadata).toEqual({ oldStatus: 'TRIGGERED', newStatus: 'ACKNOWLEDGED' });
  });

  it('refuses to delete a user who created an incident, so history is never orphaned', async () => {
    const { org, user } = await createOrgWithUser('ADMIN');
    await createIncident(org.id, user.id);

    await expect(prisma.user.delete({ where: { id: user.id } })).rejects.toThrow();
  });

  it('ignores an actor supplied by the client', async () => {
    const { org, user, token } = await createOrgWithUser('MEMBER');
    const { user: someoneElse } = await addUserToOrg(org.id, 'MEMBER');
    const incident = await createIncident(org.id, user.id);

    await api()
      .patch(`/api/incidents/${incident.id}/status`)
      .set('Authorization', bearer(token))
      .send({ status: 'ACKNOWLEDGED', actorId: someoneElse.id, actor: { id: someoneElse.id } });

    const [event] = await prisma.timelineEvent.findMany({ where: { incidentId: incident.id } });
    expect(event.actorId).toBe(user.id);
  });
});
