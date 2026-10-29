#!/usr/bin/env bash
# HRUM manseryeok (saju chart) example — curl only.
#
# Usage:
#   HRUM_API_KEY=... ./curl.sh [input.json] [result.json]
#
# The API key is read ONLY from the HRUM_API_KEY environment variable.
# If result.json is given, the raw response is kept there. A four-pillar summary
# is printed when jq is installed; otherwise the raw JSON is printed.
set -euo pipefail

API_BASE="${HRUM_API_BASE:-https://api.hrum.ai/api/v1/partners/v1}"
INPUT="${1:-sample-input.json}"
SAVE="${2:-}"

if [ -z "${HRUM_API_KEY:-}" ]; then
  echo "HRUM_API_KEY 환경변수가 비어 있어요." >&2
  echo "콘솔(https://console.hrum.ai/apikeys.html)에서 키를 발급받은 뒤 이렇게 실행해 주세요:" >&2
  echo '  export HRUM_API_KEY="YOUR_API_KEY"' >&2
  echo '  ./curl.sh' >&2
  exit 1
fi

if [ ! -f "$INPUT" ]; then
  echo "입력 파일을 찾을 수 없어요: $INPUT" >&2
  exit 1
fi

OUT="${SAVE:-$(mktemp)}"
cleanup() { if [ -z "$SAVE" ]; then rm -f "${OUT:?}"; fi; }
trap cleanup EXIT

STATUS=$(curl -sS -o "$OUT" -w '%{http_code}' -X POST "$API_BASE/manseryeok" \
  -H "X-Partner-Api-Key: $HRUM_API_KEY" \
  -H "Content-Type: application/json" \
  --data-binary "@$INPUT")

if [ -n "$SAVE" ]; then
  echo "원본 응답을 $SAVE 에 저장했어요." >&2
fi

if [ "$STATUS" != "200" ]; then
  echo "오류 $STATUS — 응답 본문:" >&2
  cat "$OUT" >&2
  echo >&2
  echo "401 키 확인 · 402 크레딧 충전 · 429 잠시 뒤 재시도 (README 의 '자주 보는 오류' 참고)" >&2
  exit 1
fi

if command -v jq >/dev/null 2>&1; then
  jq -r '
    def pillar($label; $p):
      if $p == null then "  \($label): 미상 (출생시간을 보내지 않았어요)"
      else "  \($label): \($p.stemHanja)\($p.branchHanja) (\($p.stem)\($p.branch)) · 오행 \($p.ohaeng)"
      end;
    .data as $d
    | "사주 원국",
      pillar("년주"; $d.wonkuk.year),
      pillar("월주"; $d.wonkuk.month),
      pillar("일주"; $d.wonkuk.day),
      pillar("시주"; $d.wonkuk.hour),
      (if $d.yongshin then "용신: \($d.yongshin)" else empty end),
      (if $d.gyeokguk.name then "격국: \($d.gyeokguk.name)" else empty end)
  ' "$OUT"
else
  cat "$OUT"
  echo
fi
