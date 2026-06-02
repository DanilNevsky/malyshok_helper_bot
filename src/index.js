require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const cron = require('node-cron');
const { getUser, saveUser, getAllUsers, addQuestions, useQuestion, getQuestionsBalance } = require('./database');
const { isSubscriptionActive, isTrialActive, getTrialDaysLeft } = require('./utils');
const { generateDailyMessage, answerQuestion, generateWelcomeMessage } = require('./claude');
const { findTimezone } = require('./timezones');
const { DateTime } = require('luxon');
const { createMonthlyPayment, createYearlyPayment, createQuestionsPayment } = require('./payment');
const { startWebhookServer } = require('./webhook');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });


console.log('🤖 Малышок запускается...');

// Хранение состояний пользователей в памяти
const sessions = {};
global.sessions = sessions;

const getSession = (userId) => {
  if (!sessions[userId]) sessions[userId] = { step: 'idle' };
  return sessions[userId];
};

// ─── КЛАВИАТУРЫ ──────────────────────────────────────────────

const mainMenu = {
  reply_markup: {
    keyboard: [
      ['📊 Мой профиль', '💬 Спросить Малышка'],
      ['💳 Подписка', '⚙️ Настройки'],
      ['📞 Поддержка']
    ],
    resize_keyboard: true
  }
};

const timezoneKeyboard = {
  reply_markup: {
    keyboard: [
      ['🌍 Калининград (UTC+2)', '🌍 Москва / Питер (UTC+3)'],
      ['🌍 Самара / Удмуртия (UTC+4)', '🌍 Екатеринбург (UTC+5)'],
      ['🌍 Омск (UTC+6)', '🌍 Новосибирск / Красноярск (UTC+7)'],
      ['🌍 Иркутск (UTC+8)', '🌍 Якутск (UTC+9)'],
      ['🌍 Владивосток / Хабаровск (UTC+10)', '🌍 Магадан (UTC+11)'],
      ['🌍 Камчатка / Чукотка (UTC+12)', '🌍 Другой регион (UTC+3)'],
    ],
    resize_keyboard: true
  }
};

const timezoneOffsets = {
  'Калининград': 2, 'Москва': 3, 'Питер': 3, 'Самара': 4, 'Удмуртия': 4,
  'Екатеринбург': 5, 'Омск': 6, 'Новосибирск': 7, 'Красноярск': 7,
  'Иркутск': 8, 'Якутск': 9, 'Владивосток': 10, 'Хабаровск': 10,
  'Магадан': 11, 'Камчатка': 12, 'Чукотка': 12
};

const getOffsetFromButton = (text) => {
  const match = text.match(/UTC+(d+)/);
  if (match) return parseInt(match[1]);
  return 3; // дефолт Москва
};

const timeKeyboard = {
  reply_markup: {
    keyboard: [
      ['7:00', '8:00', '9:00'],
      ['10:00', '11:00', '12:00']
    ],
    resize_keyboard: true
  }
};

const removeKeyboard = {
  reply_markup: { remove_keyboard: true }
};

// ─── КОМАНДА /start ──────────────────────────────────────────

bot.onText(/\/start/, async (msg) => {
  const userId = String(msg.from.id);
  const session = getSession(userId);
  session.step = 'welcome';

  const text = `Привет! 👋 Я *Малышок* — твой ежедневный помощник в воспитании и развитии малыша.

Каждое утро я буду присылать тебе короткое сообщение — игру, совет или интересный факт о том что происходит с твоим ребёнком прямо сейчас. Всё основано на рекомендациях ВОЗ, AAP и проверенных исследованиях.

*Что я умею:*
🌅 Ежедневные советы под точный возраст малыша
🎮 Игры и активности которые реально развивают
👨‍👧 Советы для папы — он тоже важен
💛 Поддержка для тебя

*Важно:* Я помощник по развитию и воспитанию — не врач. При любых вопросах о здоровье малыша обращайся к педиатру.

_Если что-то пошло не так — напиши /menu чтобы вернуться в главное меню._`;

  await bot.sendMessage(msg.chat.id, text, {
    parse_mode: 'Markdown',
    reply_markup: {
      keyboard: [['🚀 Начать знакомство']],
      resize_keyboard: true
    }
  });
});

// ─── КОМАНДА /menu — сброс в главное меню
bot.onText(/\/menu/, async (msg) => {
  const userId = String(msg.from.id);
  const session = getSession(userId);
  session.step = 'active';
  await bot.sendMessage(msg.chat.id, '«Малышок» перезапущен 👌', mainMenu);
});

// ─── КОМАНДА /resume ─────────────────────────────────────────

bot.onText(/\/resume/, async (msg) => {
  const userId = String(msg.from.id);
  await saveUser(userId, { paused: false });
  await bot.sendMessage(msg.chat.id, 'Рассылка возобновлена ▶️ Жди сообщение завтра утром 💛', mainMenu);
});

// ─── КОМАНДА /activated (после оплаты) ──────────────────────

bot.onText(/\/activated/, async (msg) => {
  const userId = String(msg.from.id);
  const user = await getUser(userId);
  if (!user) return;
  const end = new Date();
  end.setMonth(end.getMonth() + 1);
  await saveUser(userId, { subscriptionEnd: end.toISOString() });
  await bot.sendMessage(msg.chat.id,
    `${user.momName}, подписка активирована до ${end.toLocaleDateString('ru-RU')} ✅\n\nТеперь ты можешь задавать вопросы — до 30 в месяц 💬`,
    mainMenu
  );
});

// ─── ОБРАБОТКА ТЕКСТОВЫХ СООБЩЕНИЙ ──────────────────────────

bot.on('message', async (msg) => {
  const _userId = String(msg.from.id);
  const _session = getSession(_userId);
  // Блокируем голосовые, кружочки и стикеры — но сохраняем step сессии
  if (msg.voice || msg.video_note || msg.sticker || msg.audio || msg.video) {
    const hint = _session.step === 'waiting_question'
      ? 'Я пока умею читать только текст 😊 Напиши свой вопрос словами!'
      : 'Я пока умею читать только текст 😊 Напиши мне текстом!';
    await bot.sendMessage(msg.chat.id, hint);
    return; // step НЕ меняем — диалог продолжается
  }
  if (!msg.text || msg.text.startsWith('/')) return;

  const userId = _userId;
  const chatId = msg.chat.id;
  const text = msg.text.trim();
  const session = _session;

  // ── Онбординг ──────────────────────────────────────────────

  if (text === '🚀 Начать знакомство') {
    session.step = 'oferta';
    await bot.sendMessage(chatId,
      `📄 *Пользовательское соглашение*\n\nПеред началом работы, пожалуйста, прими условия:\n\n• Бот "Малышок" предоставляет информацию о развитии и воспитании детей\n• Бот *не является медицинским сервисом* и не даёт медицинских консультаций\n• Вся информация носит ознакомительный характер\n• При любых вопросах о здоровье ребёнка обращайся к педиатру\n• Информация основана на рекомендациях ВОЗ, AAP и CDC\n• Разработчик не несёт ответственности за решения принятые на основе информации бота`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[{ text: '✅ Принимаю условия', callback_data: 'accept_oferta' }]]
        }
      }
    );
    return;
  }

  if (session.step === 'ask_mom_name') {
    session.momName = text;
    session.step = 'ask_dad_name';
    await bot.sendMessage(chatId, `Приятно познакомиться, ${text}! 🌸\n\nКак зовут папу? (или напиши "пропустить" если папы нет рядом)`, removeKeyboard);
    return;
  }

  if (session.step === 'ask_dad_name') {
    session.dadName = text.toLowerCase() === 'пропустить' ? null : text;
    session.step = 'ask_child_name';
    await bot.sendMessage(chatId, 'Как зовут вашего малыша? 👶');
    return;
  }

  if (session.step === 'ask_child_name') {
    session.childName = text;
    session.step = 'ask_child_gender';
    await bot.sendMessage(chatId, `${text} — какое красивое имя! 🥹\n\nМалыш или малышка?`, {
      reply_markup: {
        keyboard: [['👦 Мальчик', '👧 Девочка']],
        resize_keyboard: true
      }
    });
    return;
  }

  if (session.step === 'ask_child_gender') {
    const isBoy = text.includes('Мальчик');
    session.childGender = isBoy ? 'boy' : 'girl';
    session.step = 'ask_birth_date';
    const born = isBoy ? 'родился' : 'родилась';
    await bot.sendMessage(chatId, `Когда ${born} ${session.childName}? Напиши дату в формате ДД.ММ.ГГГГ\nНапример: 15.03.2024`, {
      reply_markup: { remove_keyboard: true }
    });
    return;
  }

  if (session.step === 'ask_birth_date') {
    const dateMatch = text.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (!dateMatch) {
      await bot.sendMessage(chatId, 'Не получилось распознать дату 😕 Напиши в формате ДД.ММ.ГГГГ\nНапример: 15.03.2024');
      return;
    }
    const [, day, month, year] = dateMatch;
    const birthDate = new Date(`${year}-${month}-${day}`);
    if (isNaN(birthDate.getTime()) || birthDate > new Date()) {
      await bot.sendMessage(chatId, 'Дата выглядит неверной. Проверь и напиши ещё раз 😊');
      return;
    }
    session.childBirthDate = birthDate.toISOString();
    // Сразу сохраняем — время и регион фиксированные
    const utcOffset = 3;
    const utcHour = 7;
    await saveUser(userId, {
      momName: session.momName,
      dadName: session.dadName,
      childName: session.childName,
      childBirthDate: session.childBirthDate,
      childGender: session.childGender || 'unknown',
      notifyHour: utcHour,
      utcOffset: utcOffset,
      trialStart: (await getUser(userId) && (await getUser(userId)).trialStart) || new Date().toISOString(),
      onboardingComplete: true,
    });
    session.step = 'active';
    // Если новый пользователь — даём 5 бесплатных вопросов
    const existingUser = await getUser(userId);
    if (!existingUser || existingUser.questionsBalance === 0) {
      await addQuestions(userId, 5);
    }
    const savedUser = await getUser(userId);
    await bot.sendMessage(chatId,
      `Всё готово, ${session.momName}! 🎉 Каждый день утром — новый совет и идея для вас с ${session.childName}.\n\n*У тебя есть 3 дня бесплатного доступа* — включая возможность задавать вопросы.`,
      { parse_mode: 'Markdown', ...mainMenu }
    );
    // Сразу шлём первое полезное сообщение
    try {
      await bot.sendMessage(chatId, 'А пока — вот кое-что интересное специально для вас прямо сейчас 👇');
      const firstMessage = await generateWelcomeMessage(savedUser);
      await bot.sendMessage(chatId, firstMessage);
    } catch(e) { console.error('first msg error:', e.message); }
    return;
  }

  // ── Редактирование данных ───────────────────────────────────

  if (session.step === 'edit_mom_name') {
    await saveUser(userId, { momName: text });
    session.step = 'active';
    await bot.sendMessage(chatId, `Имя обновлено на "${text}" ✅`, mainMenu);
    return;
  }

  if (session.step === 'edit_notify_hour') {
    const timeMatch = text.match(/^(\d{1,2}):00$/);
    if (!timeMatch) {
      await bot.sendMessage(chatId, 'Выбери время из кнопок или напиши в формате 8:00', {
        reply_markup: {
          keyboard: [['7:00', '8:00', '9:00', '10:00'], ['11:00', '12:00', '18:00', '20:00']],
          resize_keyboard: true
        }
      });
      return;
    }
    session.pendingHour = parseInt(timeMatch[1]);
    session.step = 'edit_region';
    await bot.sendMessage(chatId, 'Теперь напиши свой регион или город — это нужно чтобы правильно настроить время рассылки 🌍\n\nНапример: Москва, Новосибирская область, Екатеринбург, Казань', {
      reply_markup: { remove_keyboard: true }
    });
    return;
  }

  if (session.step === 'edit_region') {
    const tz = findTimezone(text);
    if (!tz) {
      await bot.sendMessage(chatId, 'Не смог определить регион 😕 Попробуй написать по-другому — например "Московская область", "Новосибирск", "Екатеринбург"');
      return;
    }
    // Конвертируем локальный час в UTC
    const now = DateTime.now().setZone(tz);
    const offsetHours = now.offset / 60;
    const utcHour = ((session.pendingHour - offsetHours) + 24) % 24;
    await saveUser(userId, { notifyHour: Math.round(utcHour), utcOffset: offsetHours, timezone: tz });
    session.step = 'active';
    await bot.sendMessage(chatId, `✅ Готово! Буду присылать сообщения в ${session.pendingHour}:00 по твоему времени 💛`, mainMenu);
    return;
  }

  if (session.step === 'edit_dad_name') {
    const newDadName = text.toLowerCase() === 'пропустить' ? null : text;
    await saveUser(userId, { dadName: newDadName });
    session.step = 'active';
    await bot.sendMessage(chatId, newDadName ? `Имя папы обновлено на "${newDadName}" ✅` : 'Имя папы удалено ✅', mainMenu);
    return;
  }

  if (session.step === 'edit_child_name') {
    await saveUser(userId, { childName: text });
    session.step = 'active';
    await bot.sendMessage(chatId, `Имя ребёнка обновлено на "${text}" ✅`, mainMenu);
    return;
  }

  if (session.step === 'edit_birth_date') {
    const dateMatch = text.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (!dateMatch) {
      await bot.sendMessage(chatId, 'Формат: ДД.ММ.ГГГГ (например 15.03.2024)');
      return;
    }
    const [, day, month, year] = dateMatch;
    const birthDate = new Date(`${year}-${month}-${day}`);
    if (isNaN(birthDate.getTime()) || birthDate > new Date()) {
      await bot.sendMessage(chatId, 'Дата выглядит неверной, проверь ещё раз');
      return;
    }
    await saveUser(userId, { childBirthDate: birthDate.toISOString() });
    session.step = 'active';
    await bot.sendMessage(chatId, 'Дата рождения обновлена ✅', mainMenu);
    return;
  }

  if (session.step === 'edit_timezone') {
    const utcOffset = getOffsetFromButton(text);
    const user2 = await getUser(userId);
    if (user2) {
      // Пересчитываем час рассылки с новым UTC offset
      const localHour = (user2.notifyHour + (user2.utcOffset || 3)) % 24;
      const newUtcHour = (localHour - utcOffset + 24) % 24;
      await saveUser(userId, { utcOffset, notifyHour: newUtcHour });
    }
    session.step = 'active';
    await bot.sendMessage(chatId, 'Регион обновлён ✅', mainMenu);
    return;
  }

  if (session.step === 'edit_notify_time') {
    const timeMatch = text.match(/^(\d{1,2}):00$/);
    if (!timeMatch) {
      await bot.sendMessage(chatId, 'Выбери время из кнопок', timeKeyboard);
      return;
    }
    const localHour = parseInt(timeMatch[1]);
    const currentUser = await getUser(userId);
    const utcOffset = currentUser?.utcOffset || 3;
    const utcHour = (localHour - utcOffset + 24) % 24;
    await saveUser(userId, { notifyHour: utcHour });
    session.step = 'active';
    await bot.sendMessage(chatId, 'Время рассылки обновлено ✅', mainMenu);
    return;
  }

  // ── Главное меню ────────────────────────────────────────────

  const user = await getUser(userId);
  if (!user || !user.onboardingComplete) {
    await bot.sendMessage(chatId, 'Напиши /start чтобы начать 😊');
    return;
  }

  if (text === '📊 Мой профиль') {
    const balance = await getQuestionsBalance(userId);
    const subActive = isSubscriptionActive(user);
    const trial = isTrialActive(user);

    let statusText = '';
    if (trial) {
      const daysLeft = getTrialDaysLeft(user);
      statusText = `🆓 Пробный период: осталось ${daysLeft} ${daysLeft === 1 ? 'день' : 'дня'}`;
    } else if (subActive) {
      const end = new Date(user.subscriptionEnd).toLocaleDateString('ru-RU');
      statusText = `✅ Подписка активна до ${end}`;
    } else {
      statusText = `❌ Подписка не активна`;
    }

    await bot.sendMessage(chatId,
      `*Твой профиль* 👤\n\n` +
      `👩 Мама: ${user.momName}\n` +
      `👨 Папа: ${user.dadName || 'не указан'}\n` +
      `👶 Малыш: ${user.childName}\n` +
      `🎂 Дата рождения: ${new Date(user.childBirthDate).toLocaleDateString('ru-RU')}\n` +
      
      `${statusText}\n` +
      `💬 Вопросов осталось: ${balance}`,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  if (text === '💳 Подписка') {
    const subActive = isSubscriptionActive(user);
    const trial = isTrialActive(user);
    const balance = await getQuestionsBalance(userId);
    
    

    let statusBlock = '';
    if (trial) {
      const daysLeft = getTrialDaysLeft(user);
      statusBlock = `🆓 *Пробный период:* осталось ${daysLeft} ${daysLeft === 1 ? 'день' : daysLeft < 5 ? 'дня' : 'дней'}\n💬 Вопросов на балансе: ${balance}`;
    } else if (subActive) {
      const end = new Date(user.subscriptionEnd).toLocaleDateString('ru-RU');
      statusBlock = `✅ *Подписка активна* до ${end}\n💬 Вопросов осталось: ${balance}`;
    } else {
      statusBlock = `❌ *Подписка не активна*\nЕжедневные сообщения приостановлены`;
    }

    const text2 = `💳 *Подписка Малышок*\n\n${statusBlock}\n\n━━━━━━━━━━━━━━━\n*Тарифы:*\n💫 299 ₽/месяц — ежедневные советы + 30 вопросов\n🌟 2 490 ₽/год — экономия 2 месяца\n━━━━━━━━━━━━━━━\n\nПосле оплаты подписка активируется автоматически.`;

    const buttons = [];
    if (!subActive || trial) {
      buttons.push([{ text: '💫 Оплатить 299 ₽/месяц', callback_data: 'pay_month' }]);
      buttons.push([{ text: '🌟 Оплатить 2 490 ₽/год', callback_data: 'pay_year' }]);
    } else {
      buttons.push([{ text: '🔄 Продлить подписку', callback_data: 'pay_month' }]);
      buttons.push([{ text: '💬 Докупить 30 вопросов — 149 ₽', callback_data: 'buy_questions_30' }]);
      buttons.push([{ text: '💬 Докупить 100 вопросов — 349 ₽', callback_data: 'buy_questions_100' }]);
    }

    await bot.sendMessage(chatId, text2, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: buttons }
    });
    return;
  }

  if (text === '📞 Поддержка') {
    await bot.sendMessage(chatId,
      `📞 *Поддержка Малышок*\n\nЕсли у тебя есть вопрос, предложение или ты хочешь запросить возврат — напиши нам напрямую:\n\n👉 @malyshok_support\n\nОтвечаем в течение 24 часов 💛`,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  if (text === '⚙️ Настройки') {
    await bot.sendMessage(chatId, 'Что хочешь изменить?', {
      reply_markup: {
        inline_keyboard: [
          [{ text: '👩 Изменить имя мамы', callback_data: 'edit_mom' }],
          [{ text: '👨 Изменить имя папы', callback_data: 'edit_dad' }],
          [{ text: '👶 Изменить имя ребёнка', callback_data: 'edit_child' }],
          [{ text: '🎂 Изменить дату рождения', callback_data: 'edit_date' }],
          
          [{ text: '⏰ Настроить время рассылки', callback_data: 'edit_time_new' }],
        ]
      }
    });
    return;
  }

  if (text === '💬 Спросить Малышка') {
    if (!isSubscriptionActive(user)) {
      await bot.sendMessage(chatId, 'Функция вопрос-ответ доступна подписчикам 💛\n\nОформи подписку чтобы задавать вопросы:', {
        reply_markup: {
          inline_keyboard: [[{ text: '💳 Оплатить подписку', callback_data: 'pay_sub' }]]
        }
      });
      return;
    }
    const balance = await getQuestionsBalance(userId);
    if (balance <= 0) {
      await bot.sendMessage(chatId,
        isTrialActive(user)
          ? `В пробном периоде доступно 5 вопросов — ты использовала все. Оформи подписку и получи 30 вопросов в месяц 💛`
          : `${user.momName}, вопросы на этот месяц закончились 💬\n\nМожешь докупить дополнительные прямо сейчас, или подождать — лимит обновится в начале следующего месяца.`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '💬 30 вопросов — 149 ₽', callback_data: 'buy_questions_30' }],
              [{ text: '💬 100 вопросов — 349 ₽', callback_data: 'buy_questions_100' }],
            ]
          }
        }
      );
      return;
    }
    session.step = 'waiting_question';
    await bot.sendMessage(chatId, `Слушаю тебя, ${user.momName} 👂 Задай свой вопрос о ${user.childName}:`);
    return;
  }

  // ── Ответ на вопрос ─────────────────────────────────────────

  if (session.step === 'waiting_question') {
    // Выход из диалога по кнопкам меню или команде закончить диалог
    const exitCommands = ['📊 Мой профиль', '⚙️ Настройки', '💬 Спросить Малышка', '🛑 Закончить диалог', 'закончить диалог', 'выход', '/menu'];
    if (exitCommands.some(cmd => text.toLowerCase() === cmd.toLowerCase())) {
      session.step = 'active';
      await bot.sendMessage(chatId, 'Диалог завершён. Чем могу помочь? 💛', mainMenu);
      return;
    }
    if (!isSubscriptionActive(user)) {
      session.step = 'active';
      await bot.sendMessage(chatId, 'Подписка истекла. Оформи новую чтобы задавать вопросы 💛');
      return;
    }
    const balance = await getQuestionsBalance(userId);
    if (balance <= 0) {
      session.step = 'active';
      await bot.sendMessage(chatId,
        `Вопросы закончились 💬 Докупи чтобы продолжить:`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '💬 30 вопросов — 149 ₽', callback_data: 'buy_questions_30' }],
              [{ text: '💬 100 вопросов — 349 ₽', callback_data: 'buy_questions_100' }],
              [{ text: '💫 Подписка 299 ₽/мес (+30 вопросов)', callback_data: 'pay_month' }],
            ]
          }
        }
      );
      return;
    }
    await bot.sendMessage(chatId, 'Думаю... ⏳');
    try {
      const answer = await answerQuestion(user, text);
      const newBalance = await useQuestion(userId);
      await bot.sendMessage(chatId, answer + `\n\n_💬 Осталось вопросов: ${newBalance}_`, {
        parse_mode: 'Markdown',
        reply_markup: {
          keyboard: [
            ['🛑 Закончить диалог'],
          ],
          resize_keyboard: true
        }
      });
    } catch (e) {
      console.error(e);
      await bot.sendMessage(chatId, 'Что-то пошло не так, попробуй ещё раз 😕');
    }
    // Остаёмся в режиме диалога — мама может сразу задать следующий вопрос
    // session.step остаётся 'waiting_question'
    return;
  }
});

// ─── CALLBACK КНОПКИ ─────────────────────────────────────────

bot.on('callback_query', async (query) => {
  const userId = String(query.from.id);
  const chatId = query.message.chat.id;
  const session = getSession(userId);
  const data = query.data;

  await bot.answerCallbackQuery(query.id);

  if (data === 'accept_oferta') {
    session.step = 'ask_mom_name';
    await bot.sendMessage(chatId, 'Отлично! Как тебя зовут? 😊', removeKeyboard);
    return;
  }

  if (data === 'edit_mom') {
    session.step = 'edit_mom_name';
    await bot.sendMessage(chatId, 'Напиши новое имя мамы:');
    return;
  }

  if (data === 'edit_dad') {
    session.step = 'edit_dad_name';
    await bot.sendMessage(chatId, 'Напиши новое имя папы (или "пропустить"):');
    return;
  }

  if (data === 'edit_child') {
    session.step = 'edit_child_name';
    await bot.sendMessage(chatId, 'Напиши новое имя ребёнка:');
    return;
  }

  if (data === 'edit_date') {
    session.step = 'edit_birth_date';
    await bot.sendMessage(chatId, 'Напиши новую дату рождения в формате ДД.ММ.ГГГГ:');
    return;
  }

  if (data === 'edit_time') {
    session.step = 'edit_notify_time';
    await bot.sendMessage(chatId, 'Выбери новое время рассылки:', timeKeyboard);
    return;
  }

  if (data === 'edit_timezone') {
    session.step = 'edit_timezone';
    await bot.sendMessage(chatId, 'Выбери свой регион:', timezoneKeyboard);
    return;
  }

  if (data === 'edit_time_new') {
    session.step = 'edit_notify_hour';
    await bot.sendMessage(chatId, 'В котором часу тебе удобно получать сообщения? ⏰\n\nНапиши время в формате ЧЧ:00, например: 8:00 или 21:00', {
      reply_markup: {
        keyboard: [
          ['7:00', '8:00', '9:00', '10:00'],
          ['11:00', '12:00', '18:00', '20:00'],
        ],
        resize_keyboard: true
      }
    });
    return;
  }

  if (data === 'pause_notify') {
    await saveUser(userId, { paused: true });
    await bot.sendMessage(chatId, 'Рассылка приостановлена ⏸\n\nЧтобы возобновить — напиши /resume');
    return;
  }

  if (data === 'pay_month' || data === 'pay_sub') {
    try {
      const payment = await createMonthlyPayment(userId);
      const url = payment.confirmation.confirmation_url;
      await bot.sendMessage(chatId,
        `💳 *Оплата 299 ₽/месяц*\n\nНажми кнопку для оплаты. После оплаты подписка активируется автоматически ✅`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[{ text: '💳 Перейти к оплате', url }]]
          }
        }
      );
    } catch(e) {
      console.error('Ошибка создания платежа:', e.message);
      await bot.sendMessage(chatId, 'Не удалось создать платёж, попробуй чуть позже 😕');
    }
    return;
  }

  if (data === 'pay_year') {
    try {
      const payment = await createYearlyPayment(userId);
      const url = payment.confirmation.confirmation_url;
      await bot.sendMessage(chatId,
        `💳 *Оплата 2 490 ₽/год*\n\nНажми кнопку для оплаты. После оплаты подписка активируется автоматически ✅`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[{ text: '💳 Перейти к оплате', url }]]
          }
        }
      );
    } catch(e) {
      console.error('Ошибка создания платежа:', e.message);
      await bot.sendMessage(chatId, 'Не удалось создать платёж, попробуй чуть позже 😕');
    }
    return;
  }

  if (data === 'buy_questions_30') {
    try {
      const payment = await createQuestionsPayment(userId, 30);
      const url = payment.confirmation.confirmation_url;
      await bot.sendMessage(chatId,
        `💬 *30 дополнительных вопросов — 149 ₽*\n\nПосле оплаты вопросы добавятся автоматически ✅`,
        {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: [[{ text: '💳 Оплатить 149 ₽', url }]] }
        }
      );
    } catch(e) { await bot.sendMessage(chatId, 'Не удалось создать платёж 😕'); }
    return;
  }

  if (data === 'buy_questions_100') {
    try {
      const payment = await createQuestionsPayment(userId, 100);
      const url = payment.confirmation.confirmation_url;
      await bot.sendMessage(chatId,
        `💬 *100 дополнительных вопросов — 349 ₽*\n\nПосле оплаты вопросы добавятся автоматически ✅`,
        {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: [[{ text: '💳 Оплатить 349 ₽', url }]] }
        }
      );
    } catch(e) { await bot.sendMessage(chatId, 'Не удалось создать платёж 😕'); }
    return;
  }
});


// ─── ЕЖЕДНЕВНАЯ РАССЫЛКА ─────────────────────────────────────

// Cron каждый час — проверяем у кого сейчас нужное время
cron.schedule('0 * * * *', async () => {
  const users = await getAllUsers();
  const nowUtc = DateTime.utc();

  for (const user of users) {
    if (!user.onboardingComplete) continue;
    if (user.paused) continue;

    // Определяем текущий час пользователя
    const userTz = user.timezone || 'Europe/Moscow';
    const userNow = nowUtc.setZone(userTz);
    const userHour = userNow.hour;
    const targetHour = user.notifyHour !== undefined
      ? Math.round(((user.notifyHour + (user.utcOffset || 3)) + 24) % 24)
      : 10; // дефолт 10:00 по Москве

    if (userHour !== targetHour) continue;

    if (!isSubscriptionActive(user)) {
      if (isTrialActive(user)) {
        // Триал активен — шлём рассылку
        try {
          const message = await generateDailyMessage(user);
          await bot.sendMessage(user.telegramId, message);
        } catch (e) {
          console.error(`Ошибка рассылки для ${user.telegramId}:`, e.message);
        }
      } else {
        // Триал закончился — уведомляем один раз в день вместо рассылки
        try {
          await bot.sendMessage(user.telegramId,
            `${user.momName}, твой пробный период закончился 🌸\n\nЧтобы продолжить получать ежедневные советы и задавать вопросы — оформи подписку:\n\n💫 299 ₽/месяц — рассылка + 30 вопросов\n🌟 2 490 ₽/год — экономия 2 месяца`,
            {
              reply_markup: {
                inline_keyboard: [
                  [{ text: '💫 Оплатить 299 ₽/мес', callback_data: 'pay_month' }],
                  [{ text: '🌟 Оплатить 2 490 ₽/год', callback_data: 'pay_year' }],
                ]
              }
            }
          );
        } catch (e) { console.error(e); }
      }
      continue;
    }

    try {
      const message = await generateDailyMessage(user);
      await bot.sendMessage(user.telegramId, message);
    } catch (e) {
      console.error(`Ошибка рассылки для ${user.telegramId}:`, e.message);
    }
  }
});

// Напоминание за 3 дня до конца подписки
cron.schedule('0 10 * * *', async () => {
  const users = await getAllUsers();
  for (const user of users) {
    if (!user.subscriptionEnd) continue;
    const end = new Date(user.subscriptionEnd);
    const daysLeft = Math.ceil((end - new Date()) / (1000 * 60 * 60 * 24));
    if (daysLeft === 3) {
      try {
        await bot.sendMessage(user.telegramId,
          `${user.momName}, твоя подписка заканчивается через 3 дня (${end.toLocaleDateString('ru-RU')}) 🔔\n\nПродли чтобы не прерывать ежедневные советы 💛`,
          {
            reply_markup: {
              inline_keyboard: [[{ text: '🔄 Продлить подписку', callback_data: 'pay_sub' }]]
            }
          }
        );
      } catch (e) { console.error(e); }
    }
  }
});


// ─── АДМИН: ТВОЙ TELEGRAM ID ────────────────────────────────
const ADMIN_ID = 'ВСТАВЬ_СВОЙ_TELEGRAM_ID';

// ─── КОМАНДА /broadcast ─────────────────────────────────────
bot.onText(/\/broadcast (.+)/, async (msg, match) => {
  if (String(msg.from.id) !== ADMIN_ID) {
    await bot.sendMessage(msg.chat.id, 'Нет доступа');
    return;
  }
  const broadcastText = match[1];
  const allUsers = await getAllUsers();
  let sent = 0;
  let failed = 0;
  await bot.sendMessage(msg.chat.id, `Начинаю рассылку для ${allUsers.length} пользователей...`);
  for (const u of allUsers) {
    if (!u.onboardingComplete) continue;
    try {
      await bot.sendMessage(u.telegramId, broadcastText, { parse_mode: 'Markdown' });
      sent++;
      await new Promise(r => setTimeout(r, 50));
    } catch (e) { failed++; }
  }
  await bot.sendMessage(msg.chat.id, `✅ Готово! Отправлено: ${sent}, ошибок: ${failed}`);
});

// ─── КОМАНДА /stats ──────────────────────────────────────────
bot.onText(/\/stats/, async (msg) => {
  if (String(msg.from.id) !== ADMIN_ID) return;
  const allUsers = await getAllUsers();
  const activeSubs = allUsers.filter(u => isSubscriptionActive(u)).length;
  const trialUsers = allUsers.filter(u => isTrialActive(u)).length;
  const expired = allUsers.filter(u => !isSubscriptionActive(u) && !isTrialActive(u)).length;
  await bot.sendMessage(msg.chat.id,
    `📊 *Статистика Малышок*\n\n👥 Всего: ${allUsers.length}\n✅ Подписок: ${activeSubs}\n🆓 Триал: ${trialUsers}\n❌ Без подписки: ${expired}`,
    { parse_mode: 'Markdown' }
  );
});

console.log('🤖 Малышок запущен!');
global.bot = bot;
startWebhookServer(process.env.PORT || 3000);
