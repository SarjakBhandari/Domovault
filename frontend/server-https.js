'use strict';
// Wrap the Next.js standalone HTTP server with TLS so no nginx proxy is needed.
// This must be required BEFORE server.js so the http.createServer patch is in
// place when Next.js internals call it.
const https = require('node:https');
const http  = require('node:http');
const fs    = require('node:fs');

const cert = fs.readFileSync('/app/certs/cert.pem');
const key  = fs.readFileSync('/app/certs/key.pem');

http.createServer = function patchedCreateServer(opts, handler) {
  if (typeof opts === 'function') { handler = opts; opts = {}; }
  return https.createServer({ cert, key, ...opts }, handler);
};

require('./server.js');
