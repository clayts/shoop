'use strict';

const crypto = require('crypto');
const { parseCookie, stringifySetCookie } = require('cookie');

const COOKIE_NAME = 'pid';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days, in seconds

function readClientId(req) {
  const header = req.headers.cookie;
  if (!header) return null;
  const parsed = parseCookie(header);
  const val = parsed[COOKIE_NAME];
  if (val && /^[A-Za-z0-9-]{10,64}$/.test(val)) return val;
  return null;
}

function mintClientId() {
  return crypto.randomUUID();
}

function clientIdMiddleware(req, res, next) {
  let id = readClientId(req);
  if (!id) {
    id = mintClientId();
    res.setHeader(
      'Set-Cookie',
      stringifySetCookie({
        name: COOKIE_NAME,
        value: id,
        httpOnly: true,
        sameSite: 'lax',
        secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
        path: '/',
        maxAge: COOKIE_MAX_AGE,
      })
    );
  }
  req.clientId = id;
  next();
}

module.exports = { clientIdMiddleware, readClientId, COOKIE_NAME };
