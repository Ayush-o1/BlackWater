import { describe, it, expect, vi, afterEach } from 'vitest';
import { Prisma } from '@prisma/client';
import { globalErrorHandler } from '../../src/middleware/error.middleware.js';
import { AppError } from '../../src/utils/AppError.js';

function run(error) {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  globalErrorHandler(error, {}, res, vi.fn());
  return { status: res.status.mock.calls[0][0], body: res.json.mock.calls[0][0] };
}

afterEach(() => vi.restoreAllMocks());

describe('globalErrorHandler', () => {
  it('shows the message of an error we raised on purpose', () => {
    expect(run(new AppError('No such thing', 404))).toEqual({
      status: 404,
      body: { success: false, message: 'No such thing' },
    });
  });

  it('turns a unique-constraint violation into 409', () => {
    const error = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: 'test',
    });

    expect(run(error)).toEqual({ status: 409, body: { success: false, message: 'That record already exists' } });
  });

  it('turns an oversized body into 413', () => {
    expect(run(Object.assign(new Error('too big'), { type: 'entity.too.large' })).status).toBe(413);
  });

  it('hides the details of an unexpected error and logs it instead', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { status, body } = run(new Error('relation "Secret" does not exist at /srv/app/db.js:12'));

    expect(status).toBe(500);
    expect(body).toEqual({ success: false, message: 'Something went wrong!' });
    expect(log).toHaveBeenCalled();
  });
});
