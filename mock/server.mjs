#!/usr/bin/env node
// Local mock of POST /manseryeok for offline testing. Zero dependencies.
// Responses are shaped like the examples in https://hrum.ai/docs.html#saju-api
// and https://hrum.ai/docs.html#errors — the saju values are illustrative only.
//
// Standalone:
//   node mock/server.mjs            # listens on 127.0.0.1:8787
//   HRUM_API_BASE=http://127.0.0.1:8787/api/v1/partners/v1 HRUM_API_KEY=mock-key node manseryeok.mjs
//
// Special keys: "mock-no-credit" → 402. Any other non-empty key → 200.

import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const FIXTURE = JSON.parse(
  readFileSync(new URL('../test/fixtures/manseryeok-response.json', import.meta.url), 'utf8'),
);
const PATH = '/api/v1/partners/v1/manseryeok';
const REQUIRED = ['year', 'month', 'day', 'timezone', 'gender'];

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function errorBody(statusCode, extra) {
  return { success: false, statusCode, ...extra, timestamp: new Date().toISOString() };
}

// Same chart without the hour pillar, following the documented "birth hour unknown" contract.
function withoutHour(fixture) {
  const copy = structuredClone(fixture);
  copy.data.wonkuk.hour = null;
  copy.data.trueSolarTime = null;
  copy.data.birthHour = {
    known: false,
    hourPillar: null,
    basis: 'three_pillars',
    excludedFields: [],
    note: 'mock: hour omitted',
  };
  return copy;
}

function handle(req, res, rawBody) {
  if (req.method !== 'POST' || req.url !== PATH) {
    return send(res, 404, errorBody(404, { message: 'Not Found' }));
  }
  const key = req.headers['x-partner-api-key'];
  if (!key) {
    return send(res, 401, errorBody(401, { message: 'Invalid or missing API key', error: 'Unauthorized' }));
  }
  let input;
  try {
    input = JSON.parse(rawBody);
  } catch {
    return send(res, 400, errorBody(400, { message: ['body must be valid JSON'], error: 'Bad Request' }));
  }
  const missing = REQUIRED.filter((f) => input[f] === undefined || input[f] === '');
  if (missing.length > 0) {
    const message = missing.map((f) => `${f} should not be empty`);
    return send(res, 400, errorBody(400, { message, error: 'Bad Request' }));
  }
  if (key === 'mock-no-credit') {
    return send(res, 402, errorBody(402, { message: 'mock: balance is lower than the call price' }));
  }
  return send(res, 200, input.hour === undefined ? withoutHour(FIXTURE) : FIXTURE);
}

export function startMockServer({ port = 0, host = '127.0.0.1' } = {}) {
  const server = createServer((req, res) => {
    let raw = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => { raw += chunk; });
    req.on('end', () => handle(req, res, raw));
  });
  return new Promise((resolve) => {
    server.listen(port, host, () => {
      const { port: actual } = server.address();
      resolve({
        baseUrl: `http://${host}:${actual}/api/v1/partners/v1`,
        close: () => new Promise((done) => server.close(done)),
      });
    });
  });
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  const port = Number(process.env.PORT || 8787);
  startMockServer({ port }).then(({ baseUrl }) => {
    console.log(`mock listening: ${baseUrl}`);
  });
}
