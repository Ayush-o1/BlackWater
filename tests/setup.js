import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

// Loaded before any test file's imports evaluate `src/config/env.js`, so the
// test database/secret win over whatever `.env` has (dotenv never overwrites
// vars that are already set on `process.env`).
dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env.test') });
