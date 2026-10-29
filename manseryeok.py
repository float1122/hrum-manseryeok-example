#!/usr/bin/env python3
"""HRUM manseryeok (saju chart) example — Python 3.8+, standard library only.

Usage:
    HRUM_API_KEY=... python3 manseryeok.py [input.json] [--save result.json]

The API key is read ONLY from the HRUM_API_KEY environment variable.
HRUM_API_BASE is optional and only meant for pointing at the local mock server.
"""

import json
import os
import sys
import urllib.error
import urllib.request

DEFAULT_API_BASE = "https://api.hrum.ai/api/v1/partners/v1"
REQUEST_TIMEOUT_SECONDS = 30
# urllib's default User-Agent (Python-urllib/3.x) is blocked with 403 (error 1010),
# so the docs ask urllib users to set "<app-name>/<version>" explicitly.
USER_AGENT = "hrum-manseryeok-example/1.0"

PILLARS = (("year", "년주"), ("month", "월주"), ("day", "일주"), ("hour", "시주"))


def format_pillar(pillar):
    if not pillar:
        return "미상 (출생시간을 보내지 않았어요)"
    hanja = (pillar.get("stemHanja") or "") + (pillar.get("branchHanja") or "")
    hangul = (pillar.get("stem") or "") + (pillar.get("branch") or "")
    sipsin = "/".join(s for s in (pillar.get("stemSipsin"), pillar.get("branchSipsin")) if s)
    parts = [f"{hanja} ({hangul})"]
    if pillar.get("ohaeng"):
        parts.append(f"오행 {pillar['ohaeng']}")
    if sipsin:
        parts.append(f"십신 {sipsin}")
    return " · ".join(parts)


def summarize(body):
    data = (body or {}).get("data") or {}
    wonkuk = data.get("wonkuk")
    if not wonkuk:
        raise ValueError("응답에 data.wonkuk 가 없어요. 만세력 응답이 맞는지 확인해 주세요.")

    lines = ["사주 원국"]
    for key, label in PILLARS:
        lines.append(f"  {label}: {format_pillar(wonkuk.get(key))}")
    if data.get("ilganSummary"):
        lines.append(f"일간: {data['ilganSummary']}")
    if data.get("ohaengBalance"):
        balance = " ".join(f"{k}{v}" for k, v in data["ohaengBalance"].items())
        lines.append(f"오행 분포: {balance}")
    if data.get("yongshin"):
        lines.append(f"용신: {data['yongshin']}")
    if (data.get("gyeokguk") or {}).get("name"):
        lines.append(f"격국: {data['gyeokguk']['name']}")
    if (data.get("strength") or {}).get("result"):
        lines.append(f"신강약: {data['strength']['result']}")
    if (data.get("birthHour") or {}).get("known") is False:
        lines.append("참고: 출생시간 미상이라 년·월·일 3주 기준으로 계산된 결과예요.")
    if data.get("warnings"):
        warns = ", ".join(f"{w.get('code')}({w.get('field')})" for w in data["warnings"])
        lines.append(f"경고: {warns}")
    return "\n".join(lines)


def explain_error(status, body):
    """Branch on statusCode + code, never on message text."""
    code = (body or {}).get("code")
    if status == 400:
        if code == "INVALID_LUNAR_DATE":
            return "없는 음력 날짜예요. 날짜와 isLeapMonth 를 확인해 주세요."
        if code == "INVALID_LOCATION":
            return "birthLatitude 와 birthLongitude 는 둘 다 보내야 해요."
        return "요청 본문이 잘못됐어요. 필드 이름·타입·범위를 확인해 주세요. 같은 요청을 그대로 다시 보내지 마세요."
    if status == 401:
        return "API 키가 없거나 맞지 않아요. X-Partner-Api-Key 헤더와 키 값을 확인해 주세요."
    if status == 402:
        return "크레딧 잔액이 부족해요. 콘솔 빌링에서 충전한 뒤 다시 호출해 주세요."
    if status == 403:
        return "보안 규칙에 막혔어요. User-Agent 헤더를 직접 지정해 보세요."
    if status == 404:
        return "경로가 없거나 계정에 열리지 않은 기능이에요."
    if status == 429:
        return "요청 한도를 넘었어요. Retry-After 헤더가 있으면 그만큼, 없으면 잠시 기다린 뒤 다시 시도해 주세요."
    if status >= 500:
        return "서버 쪽 일시 오류예요. 간격을 늘려 가며 몇 번만 다시 시도해 주세요."
    return "알 수 없는 오류예요."


def call_manseryeok(payload, api_key, base_url=DEFAULT_API_BASE):
    req = urllib.request.Request(
        f"{base_url}/manseryeok",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "X-Partner-Api-Key": api_key,
            "Content-Type": "application/json",
            "User-Agent": USER_AGENT,
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT_SECONDS) as res:
            status, text = res.status, res.read().decode("utf-8")
    except urllib.error.HTTPError as err:
        status, text = err.code, err.read().decode("utf-8", errors="replace")
    try:
        body = json.loads(text)
    except ValueError:
        body = None  # Non-JSON body (e.g. 403 HTML page from the security layer).
    return status, body, text


def parse_args(argv):
    input_path, save_path = "sample-input.json", None
    i = 0
    while i < len(argv):
        if argv[i] == "--save" and i + 1 < len(argv):
            save_path = argv[i + 1]
            i += 2
            continue
        input_path = argv[i]
        i += 1
    return input_path, save_path


def main():
    api_key = os.environ.get("HRUM_API_KEY")
    if not api_key:
        sys.stderr.write(
            "HRUM_API_KEY 환경변수가 비어 있어요.\n"
            "콘솔(https://console.hrum.ai/apikeys.html)에서 키를 발급받은 뒤 이렇게 실행해 주세요:\n"
            '  export HRUM_API_KEY="YOUR_API_KEY"\n'
            "  python3 manseryeok.py\n"
        )
        return 1

    input_path, save_path = parse_args(sys.argv[1:])
    with open(input_path, encoding="utf-8") as f:
        payload = json.load(f)
    base_url = os.environ.get("HRUM_API_BASE") or DEFAULT_API_BASE

    status, body, text = call_manseryeok(payload, api_key, base_url)

    if save_path:
        with open(save_path, "w", encoding="utf-8") as f:
            f.write(json.dumps(body, ensure_ascii=False, indent=2) + "\n" if body is not None else text)
        sys.stderr.write(f"원본 응답을 {save_path} 에 저장했어요.\n")

    if status != 200 or not (body or {}).get("success"):
        code = (body or {}).get("code")
        suffix = f" {code}" if code else ""
        sys.stderr.write(f"오류 {status}{suffix}: {explain_error(status, body)}\n")
        return 1

    print(summarize(body))
    return 0


if __name__ == "__main__":
    sys.exit(main())
