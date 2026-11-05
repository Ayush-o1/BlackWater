import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public');

// Which HTML file answers which URL. Each page is its own HTML file with its
// own script; the browser reads ids such as :id from the URL itself. These
// pages carry no data. Anything private is fetched from /api after the page
// loads, using the visitor's token, so serving the HTML to anyone is safe.
export const pages = [
  ['/', 'index.html'],
  ['/login', 'login.html'],
  ['/register', 'register.html'],
  ['/invite', 'invite.html'],
];

export const notFoundPage = 'not-found.html';
