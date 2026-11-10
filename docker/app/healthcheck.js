'use strict';
const http = require('node:http');
const port = Number(process.env.PORT || 8784);
const host = process.env.AIGH_PUBLIC_ORIGIN
  ? new URL(process.env.AIGH_PUBLIC_ORIGIN).host
  : '127.0.0.1:' + port;
const request = http.get({
  hostname: '127.0.0.1', port, path: '/healthz',
  headers: { Host: host }, timeout: 2000
}, response => {
  response.resume();
  response.on('end', () => process.exit(response.statusCode === 200 ? 0 : 1));
});
request.on('timeout', () => request.destroy(new Error('Healthcheck timeout')));
request.on('error', () => process.exit(1));
