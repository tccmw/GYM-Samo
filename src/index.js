import 'dotenv/config';

import cron from 'node-cron';
import {
  Client,
  Events,
  GatewayIntentBits,
  Partials,
  SlashCommandBuilder,
} from 'discord.js';

const {
  DISCORD_TOKEN,
  DISCORD_CHANNEL_ID,
  DISCORD_GUILD_ID,
  NEIS_API_KEY,
  ATPT_OFCDC_SC_CODE,
  SD_SCHUL_CODE,
  COMMAND_PREFIX = '!',
  DEFAULT_MEAL = '\uC911\uC2DD',
  BREAKFAST_CRON = '0 7 * * 1-5',
  LUNCH_CRON = '0 12 * * 1-5',
  DINNER_CRON = '0 17 * * 1-5',
  TIMEZONE = 'Asia/Seoul',
} = process.env;

const MEAL_CODES = {
  '\uC870\uC2DD': '1',
  '\uC544\uCE68': '1',
  '\uC911\uC2DD': '2',
  '\uC810\uC2EC': '2',
  '\uC11D\uC2DD': '3',
  '\uC800\uB141': '3',
};

const ALL_MEALS = ['\uC870\uC2DD', '\uC911\uC2DD', '\uC11D\uC2DD'];

const SCHEDULED_MEALS = [
  { mealName: '\uC870\uC2DD', cron: BREAKFAST_CRON },
  { mealName: '\uC911\uC2DD', cron: LUNCH_CRON },
  { mealName: '\uC11D\uC2DD', cron: DINNER_CRON },
];

const MEAL_COMMAND = new SlashCommandBuilder()
  .setName('\uAE09\uC2DD')
  .setDescription('\uAE09\uC2DD \uBA54\uB274\uC640 \uB2E8\uBC31\uC9C8 \uC815\uBCF4\uB97C \uC870\uD68C\uD569\uB2C8\uB2E4.')
  .addStringOption((option) =>
    option
      .setName('meal')
      .setDescription('\uC870\uD68C\uD560 \uC2DD\uC0AC')
      .addChoices(
        { name: '\uC870\uC2DD', value: '\uC870\uC2DD' },
        { name: '\uC911\uC2DD', value: '\uC911\uC2DD' },
        { name: '\uC11D\uC2DD', value: '\uC11D\uC2DD' },
      ),
  )
  .addStringOption((option) =>
    option
      .setName('date')
      .setDescription('\uC624\uB298, \uB0B4\uC77C, 2026-04-14 \uD615\uC2DD\uC73C\uB85C \uC785\uB825'),
  )
  .toJSON();

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

client.once(Events.ClientReady, async () => {
  console.log(`Logged in as ${client.user.tag}`);
  await registerSlashCommands();

  if (!DISCORD_CHANNEL_ID) {
    console.log('DISCORD_CHANNEL_ID is empty. Scheduled meal posting is disabled.');
    return;
  }

  for (const scheduledMeal of SCHEDULED_MEALS) {
    if (!cron.validate(scheduledMeal.cron)) {
      console.warn(`Invalid cron for ${scheduledMeal.mealName}: ${scheduledMeal.cron}. This meal schedule is disabled.`);
      continue;
    }

    cron.schedule(
      scheduledMeal.cron,
      async () => {
        try {
          const channel = await client.channels.fetch(DISCORD_CHANNEL_ID);
          if (!channel?.isTextBased()) {
            console.warn(`Channel ${DISCORD_CHANNEL_ID} is not a text channel.`);
            return;
          }

          const meal = await getMealMessage({
            date: new Date(),
            mealName: scheduledMeal.mealName,
          });
          await channel.send(meal);
        } catch (error) {
          console.error(`Failed to post scheduled ${scheduledMeal.mealName}:`, error);
        }
      },
      { timezone: TIMEZONE },
    );

    console.log(`Scheduled ${scheduledMeal.mealName}: "${scheduledMeal.cron}" (${TIMEZONE})`);
  }

  if (SCHEDULED_MEALS.every((scheduledMeal) => !cron.validate(scheduledMeal.cron))) {
    console.warn('All scheduled meal cron values are invalid. Scheduled meal posting is disabled.');
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand() || interaction.commandName !== '\uAE09\uC2DD') {
    return;
  }

  try {
    const mealName = interaction.options.getString('meal');
    const dateInput = interaction.options.getString('date');
    const date = parseDateInput(dateInput);
    const reply = mealName
      ? await getMealMessage({ date, mealName })
      : await getDailyMealMessage({ date });

    await interaction.reply(reply);
  } catch (error) {
    console.error('Failed to handle slash meal command:', error);
    await interaction.reply({
      content: `\uAE09\uC2DD \uC815\uBCF4\uB97C \uAC00\uC838\uC624\uC9C0 \uBABB\uD588\uC5B4\uC694.\n${error.message}`,
      ephemeral: true,
    });
  }
});

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.content.startsWith(COMMAND_PREFIX)) {
    return;
  }

  const [command, ...args] = message.content
    .slice(COMMAND_PREFIX.length)
    .trim()
    .split(/\s+/);

  if (command !== '\uAE09\uC2DD') {
    return;
  }

  try {
    const { mealName, date } = parseMealArgs(args);
    const reply = mealName
      ? await getMealMessage({ date, mealName })
      : await getDailyMealMessage({ date });
    await message.reply(reply);
  } catch (error) {
    console.error('Failed to handle meal command:', error);

    const fallback =
      error.code === 50013
        ? '\uAD8C\uD55C\uC774 \uBD80\uC871\uD574\uC11C \uAE09\uC2DD \uC815\uBCF4\uB97C \uBCF4\uB0BC \uC218 \uC5C6\uC5B4\uC694. \uCC44\uB110 \uC804\uC1A1 \uAD8C\uD55C\uC744 \uD655\uC778\uD574\uC8FC\uC138\uC694.'
        : `\uAE09\uC2DD \uC815\uBCF4\uB97C \uAC00\uC838\uC624\uC9C0 \uBABB\uD588\uC5B4\uC694.\n${error.message}`;

    await message.reply(fallback);
  }
});

await client.login(DISCORD_TOKEN);

async function registerSlashCommands() {
  if (DISCORD_GUILD_ID) {
    const guild = await client.guilds.fetch(DISCORD_GUILD_ID);
    await guild.commands.set([MEAL_COMMAND]);
    console.log(`Registered slash command in guild ${DISCORD_GUILD_ID}`);
    return;
  }

  await client.application.commands.set([MEAL_COMMAND]);
  console.log('Registered global slash command. It can take some time to appear in Discord.');
}

function parseMealArgs(args) {
  let mealName = null;
  let date = new Date();

  for (const arg of args) {
    const normalized = arg.replace(/[()]/g, '').trim();

    if (MEAL_CODES[normalized]) {
      mealName = normalized;
      continue;
    }

    if (normalized === '\uC624\uB298') {
      date = new Date();
      continue;
    }

    if (normalized === '\uB0B4\uC77C') {
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

function parseDateInput(value) {
  if (!value) {
    return new Date();
  }

  const normalized = value.trim();
  if (normalized === '\uC624\uB298') {
    return new Date();
  }

  if (normalized === '\uB0B4\uC77C') {
    return addDays(new Date(), 1);
  }

  return parseDate(normalized) ?? new Date();
}

async function getDailyMealMessage({ date }) {
  const messages = await Promise.all(
    ALL_MEALS.map((mealName) => getMealMessage({ date, mealName })),
  );

  return messages.join('\n\n');
}

async function getMealMessage({ date, mealName }) {
  const meal = await fetchMeal({
    dateYmd: formatYmd(date),
    mealCode: MEAL_CODES[mealName] ?? MEAL_CODES[DEFAULT_MEAL] ?? '2',
  });

  if (!meal) {
    return `**${formatKoreanDate(date)} ${mealName}**\n- \uAE09\uC2DD \uC815\uBCF4\uAC00 \uC5C6\uC5B4\uC694.`;
  }

  const dishes = cleanDishNames(meal.DDISH_NM);
  const nutrition = parseNutrition(meal.NTR_INFO);
  const protein = nutrition.get('\uB2E8\uBC31\uC9C8(g)') ?? '\uC815\uBCF4 \uC5C6\uC74C';
  const calories = meal.CAL_INFO ?? '\uC815\uBCF4 \uC5C6\uC74C';

  return [
    `**${meal.SCHUL_NM ?? '\uD559\uAD50'} ${formatKoreanDate(date)} ${meal.MMEAL_SC_NM ?? mealName}**`,
    '',
    dishes.length > 0 ? dishes.map((dish) => `- ${dish}`).join('\n') : '- \uBA54\uB274 \uC815\uBCF4 \uC5C6\uC74C',
    '',
    `\uB2E8\uBC31\uC9C8: **${protein}**`,
    `\uCE7C\uB85C\uB9AC: ${calories}`,
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
    throw new Error(`NEIS API \uC694\uCCAD \uC2E4\uD328: HTTP ${response.status}`);
  }

  const data = await response.json();
  const row = data.mealServiceDietInfo?.[1]?.row?.[0] ?? null;
  if (row) {
    return row;
  }

  const result = data.mealServiceDietInfo?.[0]?.head?.[1]?.RESULT ?? data.RESULT;
  if (result && !['INFO-000', 'INFO-200'].includes(result.CODE)) {
    throw new Error(`NEIS API \uC624\uB958: ${result.MESSAGE ?? result.CODE}`);
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
