require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
const cron = require('node-cron');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const ADMIN_TELEGRAM_ID = process.env.ADMIN_TELEGRAM_ID;

// Темы постов по дням недели
const WEEKLY_TOPICS = [
  { day: 'Воскресенье', theme: 'итоги недели / мотивация для мамы', hashtags: '#молодаямама #материнство #малыш' },
  { day: 'Понедельник', theme: 'факт о развитии мозга ребёнка', hashtags: '#развитиеребёнка #детскоеразвитие #малыш' },
  { day: 'Вторник', theme: 'лайфхак для сна / режима дня', hashtags: '#сонребёнка #режимдня #молодаямама' },
  { day: 'Среда', theme: 'игра которую можно сделать прямо сейчас', hashtags: '#играсребёнком #развивашки #малыш' },
  { day: 'Четверг', theme: 'эмоции и поддержка мамы', hashtags: '#мамавдекрете #поддержкамам #материнство' },
  { day: 'Пятница', theme: 'речь и общение с ребёнком', hashtags: '#речьребёнка #развитиеречи #малыш' },
  { day: 'Суббота', theme: 'выходной — семья и папа', hashtags: '#семьяиребёнок #папаимама #выходныесребёнком' },
];

// Поисковые запросы для поиска мам в Instagram по дням
const INSTAGRAM_SEARCH_QUERIES = [
  '#молодаямама #новорождённый',
  '#мамавдекрете #малыш',
  '#первыйребёнок #беременность',
  '#грудноевскармливание #мама',
  '#развитиеребёнка #дети',
  '#мамочка #новорождённый',
  '#декрет #малыш',
];

const generateDailyPlan = async (stats) => {
  const dayIndex = new Date().getDay();
  const topic = WEEKLY_TOPICS[dayIndex];
  const igQuery = INSTAGRAM_SEARCH_QUERIES[dayIndex];
  const dateStr = new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'long' });

  const prompt = `Ты — маркетинговый ассистент Данила, основателя Telegram-бота «Малышок» (@malyshok_helper_bot) для молодых мам.

Бот: персональный помощник с ежедневными советами по развитию детей 0-5 лет. Цена: 299 ₽/мес или 2490 ₽/год. Триал: 3 дня бесплатно.
Данил пишет в соцсетях от своего лица как основатель — честно, по-человечески.

Сегодня: ${dateStr}
Тема дня: ${topic.theme}
Текущая статистика бота: ${stats}

Составь конкретный план действий на сегодня. Каждый пункт должен быть готов к копированию и вставке — никакой воды, только готовые тексты.

Формат ответа строго такой:

📱 ПОСТ В THREADS
[готовый текст поста 4-6 абзацев, от лица Данила, на тему "${topic.theme}", без хештегов, в конце мягкое упоминание бота]

📣 BROADCAST В БОТ (через /broadcast)
[готовый текст рассылки всем пользователям бота — тёплый, полезный, 3-4 предложения, без рекламы подписки]

📸 ПОИСК В INSTAGRAM
Запрос для поиска: ${igQuery}
[3 варианта личного сообщения которое Данил может отправить маме после просмотра её профиля. Короткие, живые, не продающие — просто человеческий контакт с упоминанием бота в конце]

💡 СОВЕТ ДНЯ
[одно конкретное действие которое займёт не больше 10 минут и поможет продвижению бота сегодня]

Пиши только готовые тексты. Никаких пояснений, скобок с инструкциями, заглушек типа "[имя мамы]". Всё должно быть готово к отправке.`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  });

  const textBlock = response.content.find(b => b.type === 'text');
  return textBlock ? textBlock.text.trim() : null;
};

const sendDailyPlan = async () => {
  if (!ADMIN_TELEGRAM_ID) {
    console.error('[commander] Нет ADMIN_TELEGRAM_ID в .env');
    return;
  }
  if (!global.bot) {
    console.error('[commander] global.bot не найден');
    return;
  }

  console.log('[commander] Генерирую план дня...');

  // Получаем статистику из базы для контекста
  let stats = 'статистика недоступна';
  try {
    const { getAllUsers } = require('./database');
    const { isSubscriptionActive, isTrialActive } = require('./utils');
    const users = await getAllUsers();
    const activeSubs = users.filter(u => isSubscriptionActive(u) && !isTrialActive(u)).length;
    const trialUsers = users.filter(u => isTrialActive(u)).length;
    stats = `всего пользователей: ${users.length}, активных подписок: ${activeSubs}, на триале: ${trialUsers}`;
  } catch (e) {
    console.error('[commander] Ошибка получения статистики:', e.message);
  }

  try {
    const plan = await generateDailyPlan(stats);
    if (!plan) {
      console.error('[commander] Claude вернул пустой план');
      return;
    }

    const dateStr = new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'long' });
    const header = `🎯 *План на ${dateStr}*\n\n`;

    await global.bot.sendMessage(ADMIN_TELEGRAM_ID, header + plan, {
      parse_mode: 'Markdown',
    });

    console.log('[commander] План дня отправлен Данилу');
  } catch (e) {
    console.error('[commander] Ошибка отправки плана:', e.message);
    // Пробуем без Markdown если форматирование сломалось
    try {
      const plan = await generateDailyPlan(stats);
      await global.bot.sendMessage(ADMIN_TELEGRAM_ID, `План на сегодня:\n\n${plan}`);
    } catch (e2) {
      console.error('[commander] Повторная ошибка:', e2.message);
    }
  }
};

// Каждый день в 9:00 МСК (6:00 UTC)
cron.schedule('0 6 * * *', async () => {
  await sendDailyPlan();
});

console.log('[commander] Запущен. План дня приходит каждое утро в 9:00 МСК.');

module.exports = { sendDailyPlan };
