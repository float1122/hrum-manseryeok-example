#!/usr/bin/env node
// HRUM manseryeok (saju chart) example — Node 18+, built-in fetch, zero dependencies.
//
// Usage:
//   HRUM_API_KEY=... node manseryeok.mjs [input.json] [--save result.json]
//
// The API key is read ONLY from the HRUM_API_KEY environment variable.
// HRUM_API_BASE is optional and only meant for pointing at the local mock server.

import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export const DEFAULT_API_BASE = 'https://api.hrum.ai/api/v1/partners/v1';
const REQUEST_TIMEOUT_MS = 30_000;

const PILLARS = [
  ['year', '년주'],
  ['month', '월주'],
  ['day', '일주'],
  ['hour', '시주'],
];

// One pillar → "己卯 (기묘) · 오행 토 · 십신 정관/상관"
export function formatPillar(pillar) {
  if (!pillar) return '미상 (출생시간을 보내지 않았어요)';
  const hanja = `${pillar.stemHanja ?? ''}${pillar.branchHanja ?? ''}`;
  const hangul = `${pillar.stem ?? ''}${pillar.branch ?? ''}`;
  const sipsin = [pillar.stemSipsin, pillar.branchSipsin].filter(Boolean).join('/');
  const parts = [`${hanja} (${hangul})`];
  if (pillar.ohaeng) parts.push(`오행 ${pillar.ohaeng}`);
  if (sipsin) parts.push(`십신 ${sipsin}`);
  return parts.join(' · ');
}

// Build a short human summary from a successful response body ({ success, data }).
export function summarize(body) {
  const data = body?.data;
  if (!data?.wonkuk) throw new Error('응답에 data.wonkuk 가 없어요. 만세력 응답이 맞는지 확인해 주세요.');

  const lines = ['사주 원국'];
  for (const [key, label] of PILLARS) {
    lines.push(`  ${label}: ${formatPillar(data.wonkuk[key])}`);
  }
  if (data.ilganSummary) lines.push(`일간: ${data.ilganSummary}`);
  if (data.ohaengBalance) {
    const balance = Object.entries(data.ohaengBalance).map(([k, v]) => `${k}${v}`).join(' ');
    lines.push(`오행 분포: ${balance}`);
  }
  if (data.yongshin) lines.push(`용신: ${data.yongshin}`);
  if (data.gyeokguk?.name) lines.push(`격국: ${data.gyeokguk.name}`);
  if (data.strength?.result) lines.push(`신강약: ${data.strength.result}`);
  if (data.birthHour && data.birthHour.known === false) {
    lines.push('참고: 출생시간 미상이라 년·월·일 3주 기준으로 계산된 결과예요.');
  }
  if (Array.isArray(data.warnings) && data.warnings.length > 0) {
    lines.push(`경고: ${data.warnings.map((w) => `${w.code}(${w.field})`).join(', ')}`);
  }
  return lines.join('\n');
}

// Map an error status/code to a short hint. Branch on statusCode + code, never on message.
export function explainError(status, body) {
  const code = body?.code;
  if (status === 400) {
    if (code === 'INVALID_LUNAR_DATE') return '없는 음력 날짜예요. 날짜와 isLeapMonth 를 확인해 주세요.';
    if (code === 'INVALID_LOCATION') return 'birthLatitude 와 birthLongitude 는 둘 다 보내야 해요.';
    return '요청 본문이 잘못됐어요. 필드 이름·타입·범위를 확인해 주세요. 같은 요청을 그대로 다시 보내지 마세요.';
  }
  if (status === 401) return 'API 키가 없거나 맞지 않아요. X-Partner-Api-Key 헤더와 키 값을 확인해 주세요.';
  if (status === 402) return '크레딧 잔액이 부족해요. 콘솔 빌링에서 충전한 뒤 다시 호출해 주세요.';
  if (status === 403) return '보안 규칙에 막혔어요. User-Agent 헤더를 직접 지정해 보세요.';
  if (status === 404) return '경로가 없거나 계정에 열리지 않은 기능이에요.';
  if (status === 429) return '요청 한도를 넘었어요. Retry-After 헤더가 있으면 그만큼, 없으면 잠시 기다린 뒤 다시 시도해 주세요.';
  if (status >= 500) return '서버 쪽 일시 오류예요. 간격을 늘려 가며 몇 번만 다시 시도해 주세요.';
  return '알 수 없는 오류예요.';
}

export async function callManseryeok(input, { apiKey, baseUrl = DEFAULT_API_BASE, fetchImpl = fetch } = {}) {
  if (!apiKey) throw new Error('apiKey 가 필요해요.');
  const res = await fetchImpl(`${baseUrl}/manseryeok`, {
    method: 'POST',
    headers: {
      'X-Partner-Api-Key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const text = await res.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    // Non-JSON body (e.g. 403 HTML page from the security layer).
  }
  return { status: res.status, body, text };
}

function parseArgs(argv) {
  const args = { input: 'sample-input.json', save: null };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--save') {
      args.save = argv[i + 1];
      i += 1;
    } else {
      args.input = argv[i];
    }
  }
  return args;
}

async function main() {
  const apiKey = process.env.HRUM_API_KEY;
  if (!apiKey) {
    console.error('HRUM_API_KEY 환경변수가 비어 있어요.');
    console.error('콘솔(https://console.hrum.ai/apikeys.html)에서 키를 발급받은 뒤 이렇게 실행해 주세요:');
    console.error('  export HRUM_API_KEY="YOUR_API_KEY"');
    console.error('  node manseryeok.mjs');
    process.exit(1);
  }

  const args = parseArgs(process.argv.slice(2));
  const input = JSON.parse(await readFile(args.input, 'utf8'));
  const baseUrl = process.env.HRUM_API_BASE || DEFAULT_API_BASE;

  const { status, body, text } = await callManseryeok(input, { apiKey, baseUrl });

  if (args.save) {
    await writeFile(args.save, body ? `${JSON.stringify(body, null, 2)}\n` : text);
    console.error(`원본 응답을 ${args.save} 에 저장했어요.`);
  }

  if (status !== 200 || !body?.success) {
    console.error(`오류 ${status}${body?.code ? ` ${body.code}` : ''}: ${explainError(status, body)}`);
    process.exit(1);
  }
  console.log(summarize(body));
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  main().catch((err) => {
    console.error(`실행 중 오류: ${err.message}`);
    process.exit(1);
  });
}
