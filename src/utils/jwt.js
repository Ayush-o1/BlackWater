import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

// The algorithm is pinned on both sign and verify. Without pinning on verify,
// a token could pick its own algorithm (the classic "alg: none" attack).
export const generateToken = ({ userId, orgId, role }) =>
  jwt.sign({ userId, orgId, role }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
    algorithm: 'HS256',
  });

export const verifyToken = (token) =>
  jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
