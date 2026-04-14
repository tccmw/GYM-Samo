# GYM-Samo

디스코드 채널에서 `!급식` 또는 `!급식 중식`을 입력하면 NEIS 급식 정보를 가져와 메뉴와 단백질 정보를 알려주는 봇입니다.

## 기능

- `!급식`: 오늘 조식, 중식, 석식 정보를 모두 조회합니다.
- `!급식 중식`, `!급식 석식`, `!급식 조식`: 원하는 식사를 조회합니다.
- `!급식 내일`: 내일 조식, 중식, 석식 정보를 모두 조회합니다.
- `!급식 내일 중식`: 내일 중식을 조회합니다.
- `!급식 2026-04-14 중식`: 특정 날짜 급식을 조회합니다.
- 설정한 시간마다 지정 채널에 자동으로 급식을 올립니다.

## 준비

Node.js 18 이상이 필요합니다.

```bash
npm install
```

`.env.example`을 참고해서 `.env` 파일을 만듭니다.

```env
DISCORD_TOKEN=디스코드_봇_토큰
DISCORD_CHANNEL_ID=정기알림을_보낼_채널_ID

NEIS_API_KEY=
ATPT_OFCDC_SC_CODE=교육청코드
SD_SCHUL_CODE=학교코드

COMMAND_PREFIX=!
DEFAULT_MEAL=중식
SCHEDULE_CRON=0 8 * * 1-5
TIMEZONE=Asia/Seoul
```

NEIS 급식 API는 `ATPT_OFCDC_SC_CODE`와 `SD_SCHUL_CODE`가 필요합니다. 학교 코드는 나이스 교육정보 개방 포털의 학교기본정보에서 확인할 수 있습니다.

## 실행

```bash
npm start
```

디스코드 개발자 포털에서 봇의 `MESSAGE CONTENT INTENT`를 켜야 `!급식` 같은 일반 메시지 명령을 읽을 수 있습니다.
