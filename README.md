# HRUM 만세력 API 예제

생년월일시를 보내면 사주 원국(년주·월주·일주·시주)을 돌려주는 [HRUM(흐름)](https://hrum.ai/?utm_source=github&utm_medium=example&utm_campaign=devrel-1030) 만세력 API를 아무것도 설치하지 않고 불러 보는 예제예요.

- `curl.sh` — curl 하나로 호출해요.
- `manseryeok.mjs` — Node 18 이상의 내장 `fetch`만 써요. `npm install`이 필요 없어요.
- `manseryeok.py` — Python 표준 라이브러리 `urllib`만 써요. `pip install`이 필요 없어요.

세 파일 모두 API 키를 환경변수 `HRUM_API_KEY`에서만 읽고, 네 기둥을 짧게 요약해 보여 줘요. 원하면 원본 JSON을 파일로 저장할 수 있어요.

## API 키 받기

1. [HRUM 콘솔](https://console.hrum.ai/login.html)에서 회원가입하고, 받은 메일의 인증 버튼을 누른 뒤 다시 로그인해요.
2. 콘솔의 [API 키](https://console.hrum.ai/apikeys.html) 화면에서 키 제목을 적고 발급을 눌러요.
3. 새 키는 발급 직후 한 번만 보여요. 바로 복사해서 환경변수처럼 안전한 곳에 두세요.

가입하면 무료 크레딧이 지급돼요(부정 가입 방지 조건에 걸리면 지급이 보류될 수 있어요).

키는 서버에서만 쓰세요. 브라우저나 앱 코드에 넣으면 누구나 꺼내 쓸 수 있어요. 키를 저장소에 커밋하지 않도록 `.env`는 `.gitignore`에 들어 있어요.

```bash
export HRUM_API_KEY="YOUR_API_KEY"
```

## 입력 파일

`sample-input.json`이 기본 입력이에요. 값을 바꿔서 쓰거나, 다른 파일을 인자로 넘기면 돼요.

```json
{ "year": 1990, "month": 5, "day": 15, "hour": 12, "minute": 0, "timezone": "Asia/Seoul", "gender": "male" }
```

- `year`·`month`·`day`·`timezone`·`gender`는 꼭 보내야 해요. `timezone`을 빼면 400이 와요.
- `hour`를 빼면 시주 없이(`wonkuk.hour`가 `null`) 년·월·일 세 기둥 기준으로 계산해 줘요.
- 음력(`calendar: "lunar"`), 출생지 좌표, 언어(`lang`) 같은 선택 필드는 [만세력 API 문서](https://hrum.ai/docs.html#saju-api)에 있어요.

## curl로 실행

```bash
./curl.sh                                # sample-input.json 으로 호출
./curl.sh my-input.json result.json      # 원본 응답을 result.json 에 저장
```

`jq`가 깔려 있으면 네 기둥을 요약해 보여 주고, 없으면 원본 JSON을 그대로 출력해요. 스크립트 없이 바로 부르고 싶다면 이렇게 하면 돼요.

```bash
curl -X POST https://api.hrum.ai/api/v1/partners/v1/manseryeok \
  -H "X-Partner-Api-Key: $HRUM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"year":1990,"month":5,"day":15,"hour":12,"minute":0,"timezone":"Asia/Seoul","gender":"male"}'
```

## Node로 실행

Node 18 이상이면 설치할 게 없어요.

```bash
node manseryeok.mjs                          # sample-input.json 으로 호출
node manseryeok.mjs my-input.json --save result.json
```

## Python으로 실행

Python 3.8 이상, 표준 라이브러리만 써요.

```bash
python3 manseryeok.py
python3 manseryeok.py my-input.json --save result.json
```

`urllib`의 기본 User-Agent(`Python-urllib/3.x`)는 보안 규칙에 걸려 403이 돌아와요. 그래서 이 예제는 `User-Agent: hrum-manseryeok-example/1.0`을 직접 넣어요. 직접 코드를 짤 때도 `앱이름/버전` 형태로 꼭 넣어 주세요.

## 출력 예시

```
사주 원국
  년주: 己卯 (기묘) · 오행 토 · 십신 정관/상관
  월주: 丁丑 (정축) · 오행 화 · 십신 정재/정관
  일주: 壬申 (임신) · 오행 수 · 십신 비견/편인
  시주: 丁未 (정미) · 오행 화 · 십신 정재/정관
일간: 壬水 — 큰 바다의 기운. 지혜롭고 포용력이 넓어요.
오행 분포: 목1 화2 토3 금1 수1
용신: 수
격국: 정관격
신강약: 신약
```

위 출력은 아래 테스트용 목 서버가 돌려주는 예시 응답으로 만든 거예요. 실제 결과는 입력에 따라 달라요.

## 응답 읽기

성공하면 `{"success": true, "data": { .. }}` 형태로 와요. 자주 쓰는 필드는 이 정도예요.

| 필드 | 뜻 |
|---|---|
| `data.wonkuk.year` · `month` · `day` · `hour` | 원국 네 기둥. 출생시간을 안 보내면 `hour`는 `null` |
| 각 기둥의 `stem` · `branch` | 천간·지지 (한글, 예: `"기"`, `"묘"`) |
| 각 기둥의 `stemHanja` · `branchHanja` | 천간·지지 한자 (예: `"己"`, `"卯"`) |
| 각 기둥의 `ohaeng` | 오행 (`"목"`, `"화"`, `"토"`, `"금"`, `"수"`) |
| 각 기둥의 `stemSipsin` · `branchSipsin` | 일간 기준 십신 (예: `"정관"`) |
| `data.ohaengBalance` | 오행 개수 `{ "목", "화", "토", "금", "수" }` |
| `data.ilganSummary` | 일간 한 줄 설명 |
| `data.yongshin` | 최종 용신 |
| `data.gyeokguk.name` | 격국 이름 (예: `"정관격"`) |
| `data.strength.result` | 신강·신약 |
| `data.daeun` · `data.seun` | 대운 구간 · 세운 연도별 흐름 |
| `data.birthHour.known` | 출생시간을 안 보냈을 때만 붙고 `false`예요. 시주 칸은 "미상"으로 보여 주세요 |

`stem`·`branch`·`ohaeng` 값과 `ohaengBalance`의 키는 `lang`을 보내도 한글 그대로예요. 전체 목록은 [만세력 API 문서](https://hrum.ai/docs.html#saju-api)를 보세요.

## 결과는 저장해서 다시 쓰세요

만세력은 계산형 API라서 같은 입력이면 결과가 늘 같아요. 성공한 호출은 매번 과금되니까 첫 응답을 DB에 저장하고(예: 요청 본문 해시를 키로), 다음부터는 저장한 값을 쓰세요. 같은 입력으로 API를 다시 부르지 않는 게 좋아요.

## 자주 보는 오류

오류 응답은 `{"success": false, "statusCode": .., "code": "..", "message": .., "timestamp": ".."}` 형태예요. `code`는 있을 때만 붙어요. 분기는 `statusCode`와 `code`로 하고, `message` 문구에는 기대지 마세요.

| HTTP | code | 뜻 | 이렇게 하세요 |
|---|---|---|---|
| 400 | (없음) | 본문 검사 실패. 표에 없는 필드, 틀린 타입·범위, `timezone` 누락 등. `message`는 문자열 배열 | 요청을 고쳐요. 같은 요청을 그대로 다시 보내지 마세요 |
| 400 | `INVALID_LUNAR_DATE` | 없는 음력 날짜 | 날짜와 `isLeapMonth`를 확인해요 |
| 400 | `INVALID_LOCATION` | 위도·경도 중 하나만 보냄 | 둘 다 보내거나 둘 다 빼요 |
| 401 | (없음) | 키가 없거나, 틀렸거나, 폐기된 키 | 헤더 이름 `X-Partner-Api-Key`와 키 값을 확인해요 |
| 402 | (없음) / `INSUFFICIENT_BALANCE` | 크레딧 잔액 부족. 만세력은 호출 전 잔액 검사가 없어서 `code` 없이 올 수 있어요 | 콘솔 [빌링](https://console.hrum.ai/billing.html)에서 충전한 뒤 다시 호출해요 |
| 403 | (본문이 HTML) | 보안 규칙 차단. 막힌 기본 User-Agent | `User-Agent: 앱이름/버전` 헤더를 넣어요 |
| 429 | (없음) / `RATE_LIMIT_EXCEEDED` | 요청 한도 초과 | `Retry-After` 헤더가 있으면 그만큼, 없으면 잠시 기다린 뒤 재시도해요 |
| 500 · 503 | (없음) / `SERVICE_DEGRADED` | 서버 오류 · 일시적 이용 불가 | 간격을 늘려 가며 몇 번만 재시도해요 |

400·401·402·403·404·429 오류는 과금되지 않고, 500·503은 그 요청에서 차감된 금액을 돌려줘요. 자세한 내용은 [에러 코드 문서](https://hrum.ai/docs.html#errors)에 있어요.

## 네트워크 없이 테스트하기

`node --test`로 요약 코드와 오류 처리를 확인할 수 있어요. 테스트는 로컬 목 서버(`mock/server.mjs`)를 띄워서 돌고, 실제 API는 부르지 않아요.

```bash
node --test
```

세 스크립트를 목 서버에 붙여 볼 수도 있어요. 목 서버는 입력과 상관없이 늘 같은 예시 응답을 돌려줘요.

```bash
node mock/server.mjs &
export HRUM_API_BASE=http://127.0.0.1:8787/api/v1/partners/v1
HRUM_API_KEY=mock-key node manseryeok.mjs
HRUM_API_KEY=mock-key python3 manseryeok.py
HRUM_API_KEY=mock-key ./curl.sh
```

`test/fixtures/manseryeok-response.json`은 문서의 응답 예시를 바탕으로 만든 테스트용 데이터예요. 문서에서 생략된 월·일·시주 값은 테스트를 위해 채운 거라 실제 API 응답으로 보지 마세요. `HRUM_API_BASE`는 목 서버용이에요. 실제 호출할 때는 비워 두세요.

## 파일

```
curl.sh                 curl 예제
manseryeok.mjs          Node 예제 (요약 함수도 export)
manseryeok.py           Python 예제
sample-input.json       기본 입력
mock/server.mjs         테스트용 로컬 목 서버
test/                   node --test 테스트와 예시 응답
```

## 만든 곳

이 예제는 HRUM(흐름)을 만드는 플로트 주식회사(FLOAT Co., Ltd.)가 만들었어요.

- HRUM: https://hrum.ai/?utm_source=github&utm_medium=example&utm_campaign=devrel-1030
- API 문서: https://hrum.ai/docs.html
- 시작 가이드: https://hrum.ai/getting-started.html

라이선스는 [MIT](LICENSE)예요.
