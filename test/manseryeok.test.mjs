// Offline tests — run with `node --test` (Node 18+). No network, no dependencies.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { callManseryeok, explainError, formatPillar, summarize } from '../manseryeok.mjs';
import { startMockServer } from '../mock/server.mjs';

const fixture = JSON.parse(
  await readFile(new URL('./fixtures/manseryeok-response.json', import.meta.url), 'utf8'),
);
const sampleInput = JSON.parse(await readFile(new URL('../sample-input.json', import.meta.url), 'utf8'));

let mock;
before(async () => { mock = await startMockServer(); });
after(async () => { await mock.close(); });

test('formatPillar renders hanja, hangul, ohaeng and sipsin', () => {
  assert.equal(formatPillar(fixture.data.wonkuk.year), '己卯 (기묘) · 오행 토 · 십신 정관/상관');
});

test('formatPillar marks a null hour pillar as unknown', () => {
  assert.match(formatPillar(null), /^미상/);
});

test('summarize lists all four pillars and key analysis fields', () => {
  const text = summarize(fixture);
  assert.match(text, /년주: 己卯/);
  assert.match(text, /월주: 丁丑/);
  assert.match(text, /일주: 壬申/);
  assert.match(text, /시주: 丁未/);
  assert.match(text, /용신: 수/);
  assert.match(text, /격국: 정관격/);
  assert.match(text, /신강약: 신약/);
});

test('summarize rejects a body without data.wonkuk', () => {
  assert.throws(() => summarize({ success: true, data: {} }), /wonkuk/);
});

test('explainError branches on status and code', () => {
  assert.match(explainError(401, null), /X-Partner-Api-Key/);
  assert.match(explainError(402, { statusCode: 402 }), /충전/);
  assert.match(explainError(400, { code: 'INVALID_LOCATION' }), /birthLatitude/);
  assert.match(explainError(429, { code: 'RATE_LIMIT_EXCEEDED' }), /Retry-After/);
});

test('mock: valid key returns the documented response shape', async () => {
  const { status, body } = await callManseryeok(sampleInput, { apiKey: 'mock-key', baseUrl: mock.baseUrl });
  assert.equal(status, 200);
  assert.equal(body.success, true);
  for (const key of ['year', 'month', 'day', 'hour']) {
    assert.ok(body.data.wonkuk[key], `wonkuk.${key} present`);
  }
});

test('mock: omitted hour gives wonkuk.hour null and birthHour.known false', async () => {
  const { hour, minute, ...noHour } = sampleInput;
  const { status, body } = await callManseryeok(noHour, { apiKey: 'mock-key', baseUrl: mock.baseUrl });
  assert.equal(status, 200);
  assert.equal(body.data.wonkuk.hour, null);
  assert.equal(body.data.birthHour.known, false);
  assert.match(summarize(body), /시주: 미상/);
});

test('mock: missing key header returns 401', async () => {
  const res = await fetch(`${mock.baseUrl}/manseryeok`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sampleInput),
  });
  const body = await res.json();
  assert.equal(res.status, 401);
  assert.equal(body.success, false);
  assert.equal(body.statusCode, 401);
});

test('mock: missing timezone returns 400 with message array', async () => {
  const { timezone, ...noTz } = sampleInput;
  const { status, body } = await callManseryeok(noTz, { apiKey: 'mock-key', baseUrl: mock.baseUrl });
  assert.equal(status, 400);
  assert.ok(Array.isArray(body.message));
});

test('mock: no-credit key returns 402', async () => {
  const { status } = await callManseryeok(sampleInput, { apiKey: 'mock-no-credit', baseUrl: mock.baseUrl });
  assert.equal(status, 402);
});

test('callManseryeok refuses to run without a key', async () => {
  await assert.rejects(() => callManseryeok(sampleInput, { apiKey: '' }), /apiKey/);
});
