import 'dotenv/config';

import cron from 'node-cron';
import {
  Client,
  GatewayIntentBits,
  Partials,
} from 'discord.js';

const {
  DISCORD_TOKEN,
  DISCORD_CHANNEL_ID,
  NEIS_API_KEY,
  ATPT_OFCDC_SC_CODE,
  SD_SCHUL_CODE,
  COMMAND_PREFIX = '!',
  DEFAULT_MEAL = '중식',
  SCHEDULE_CRON = '0 8 * * 1-5',
  TIMEZONE = 'Asia/Seoul',
} = process.env;

const MEAL_CODES = {
  조식: '1',
  아침: '1',
  중식: '2',
  점심: '2',
  석식: '3',
  저녁: '3',
};

if (!DISCORD_TOKEN) {
  throw new Error('DISCORD_TOKEN is required. Check your .env file.');
}

if (!ATPT_OFCDC_SC_CODE || !SD_SCHUL_CODE) {
  throw new Error('ATPT_OFCDC_SC_CODE and SD_SCHUL_CODE are required. Check your .env file.');
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);

  if (!DISCORD_CHANNEL_ID) {
    console.log('DISCORD_CHANNEL_ID is empty. Scheduled meal posting is disabled.');
    return;
  }

  if (!cron.validate(SCHEDULE_CRON)) {
    console.warn(`Invalid SCHEDULE_CRON: ${SCHEDULE_CRON}. Scheduled meal posting is disabled.`);
    return;
  }

  cron.schedule(
    SCHEDULE_CRON,
    async () => {
      try {
        const channel = await client.channels.fetch(DISCORD_CHANNEL_ID);
        if (!channel?.isTextBased()) {
          console.warn(`Channel ${DISCORD_CHANNEL_ID} is not a text channel.`);
          return;
        }

        const meal = await getMealMessage({
          date: new Date(),
          mealName: DEFAULT_MEAL,
        });
        await channel.send(meal);
      } catch (error) {
        console.error('Failed to post scheduled meal:', error);
      }
    },
    { timezone: TIMEZONE },
  );

  console.log(`Scheduled meal posting: "${SCHEDULE_CRON}" (${TIMEZONE})`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.content.startsWith(COMMAND_PREFIX)) {
    return;
  }

  const [command, ...args] = message.content
    .slice(COMMAND_PREFIX.length)
    .trim()
    .split(/\s+/);

  if (command !== '급식') {
    return;
  }

  try {
    const { mealName, date } = parseMealArgs(args);
    const reply = await getMealMessage({ date, mealName });
    await message.reply(reply);
  } catch (error) {
    console.error('Failed to handle meal command:', error);

    const fallback =
      error.code === 50013
        ? '권한이 부족해서 급식 정보를 보낼 수 없어요. 채널 전송 권한을 확인해주세요.'
        : `급식 정보를 가져오지 못했어요.\n${error.message}`;

    await message.reply(fallback);
  }
});

await client.login(DISCORD_TOKEN);

function parseMealArgs(args) {
  let mealName = DEFAULT_MEAL;
  let date = new Date();

  for (const arg of args) {
    const normalized = arg.replace(/[()]/g, '').trim();

    if (MEAL_CODES[normalized]) {
      mealName = normalized;
      continue;
    }

    if (normalized === '오늘') {
      date = new Date();
      continue;
    }

    if (normalized === '내일') {
      date = addDays(new Date(), 1);
      continue;
    }

    const parsedDate = parseDate(normalized);
    if (parsedDate) {
      date = parsedDate;
    }
  }

  return { mealName, date };
}

async function getMealMessage({ date, mealName }) {
  const meal = await fetchMeal({
    dateYmd: formatYmd(date),
    mealCode: MEAL_CODES[mealName] ?? MEAL_CODES[DEFAULT_MEAL] ?? '2',
  });

  if (!meal) {
    return `${formatKoreanDate(date)} ${mealName} 급식 정보가 없어요.`;
  }

  const dishes = cleanDishNames(meal.DDISH_NM);
  const nutrition = parseNutrition(meal.NTR_INFO);
  const protein = nutrition.get('단백질(g)') ?? '정보 없음';
  const calories = meal.CAL_INFO ?? '정보 없음';

  return [
    `**${meal.SCHUL_NM ?? '학교'} ${formatKoreanDate(date)} ${meal.MMEAL_SC_NM ?? mealName}**`,
    '',
    dishes.length > 0 ? dishes.map((dish) => `- ${dish}`).join('\n') : '- 메뉴 정보 없음',
    '',
    `단백질: **${protein}**`,
    `칼로리: ${calories}`,
  ].join('\n');
}

async function fetchMeal({ dateYmd, mealCode }) {
  const params = new URLSearchParams({
    Type: 'json',
    pIndex: '1',
    pSize: '10',
    ATPT_OFCDC_SC_CODE,
    SD_SCHUL_CODE,
    MLSV_YMD: dateYmd,
    MMEAL_SC_CODE: mealCode,
  });

  if (NEIS_API_KEY) {
    params.set('KEY', NEIS_API_KEY);
  }

  const response = await fetch(`https://open.neis.go.kr/hub/mealServiceDietInfo?${params}`);

  if (!response.ok) {
    throw new Error(`NEIS API 요청 실패: HTTP ${response.status}`);
  }

  const data = await response.json();
  const row = data.mealServiceDietInfo?.[1]?.row?.[0] ?? null;
  if (row) {
    return row;
  }

  const result = data.mealServiceDietInfo?.[0]?.head?.[1]?.RESULT ?? data.RESULT;
  if (result && !['INFO-000', 'INFO-200'].includes(result.CODE)) {
    throw new Error(`NEIS API 오류: ${result.MESSAGE ?? result.CODE}`);
  }

  return null;
}

function cleanDishNames(rawDishNames = '') {
  return rawDishNames
    .split(/<br\s*\/?>/i)
    .map((dish) =>
      dish
        .replace(/\([^)]*\)/g, '')
        .replace(/\d+(?:\.\d+)*\.?/g, '')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter(Boolean);
}

function parseNutrition(rawNutrition = '') {
  return new Map(
    rawNutrition
      .split(/<br\s*\/?>/i)
      .map((line) => line.split(':').map((part) => part.trim()))
      .filter(([key, value]) => key && value),
  );
}

function formatYmd(date) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  return formatter.format(date).replaceAll('-', '');
}

function formatKoreanDate(date) {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(date);
}

function parseDate(value) {
  const compact = value.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compact) {
    return new Date(`${compact[1]}-${compact[2]}-${compact[3]}T00:00:00+09:00`);
  }

  const dashed = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dashed) {
    return new Date(`${dashed[1]}-${dashed[2]}-${dashed[3]}T00:00:00+09:00`);
  }

  return null;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}
