# Railway Deployment

Railway에 디스코드 급식봇을 24시간 실행하는 방법입니다.

## 1. GitHub에 올리기

Railway는 GitHub 저장소를 연결해서 배포하는 방식이 가장 쉽습니다.

`.env` 파일은 절대 올리지 마세요. 현재 `.gitignore`에 포함되어 있습니다.

## 2. Railway 프로젝트 만들기

1. Railway에 로그인합니다.
2. `New Project`를 누릅니다.
3. `Deploy from GitHub repo`를 선택합니다.
4. 이 저장소를 선택합니다.

## 3. 환경변수 추가

Railway 프로젝트의 서비스에서 `Variables`에 아래 값을 추가합니다.

```env
DISCORD_TOKEN=새로_발급받은_봇_토큰
DISCORD_CHANNEL_ID=정기알림_채널_ID
DISCORD_GUILD_ID=서버_ID

NEIS_API_KEY=
ATPT_OFCDC_SC_CODE=G10
SD_SCHUL_CODE=7430310

COMMAND_PREFIX=!
DEFAULT_MEAL=중식
BREAKFAST_CRON=0 7 * * 1-5
LUNCH_CRON=0 12 * * 1-5
DINNER_CRON=0 17 * * 1-5
TIMEZONE=Asia/Seoul
```

## 4. 봇 초대 권한 확인

Discord Developer Portal의 OAuth2 URL Generator에서 `Scopes`는 아래 둘 다 체크합니다.

```text
bot
applications.commands
```

권한은 아래 항목을 허용합니다.

```text
채널 보기
메시지 보내기
메시지 기록 보기
링크 임베드
```

## 5. 배포 확인

Railway 배포 로그에 아래처럼 나오면 정상입니다.

```text
Logged in as 급식봇#0000
Registered slash command in guild ...
Scheduled 조식: "0 7 * * 1-5" (Asia/Seoul)
Scheduled 중식: "0 12 * * 1-5" (Asia/Seoul)
Scheduled 석식: "0 17 * * 1-5" (Asia/Seoul)
```

이후 디스코드에서 `/급식` 또는 `!급식`을 테스트합니다.
