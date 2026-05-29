const express = require('express');
const { saveUser, addExtraQuestions, getUser } = require('./database');

const app = express();
app.use(express.json());

// Webhook от ЮКассы — вызывается автоматически после оплаты
app.post('/webhook/yookassa', async (req, res) => {
  try {
    const event = req.body;
    console.log('ЮКасса webhook:', JSON.stringify(event));

    // Обрабатываем только успешные платежи
    if (event.event !== 'payment.succeeded') {
      return res.status(200).json({ ok: true });
    }

    const payment = event.object;
    const { userId, plan, questionsAmount } = payment.metadata;

    if (!userId) {
      console.error('userId не найден в metadata');
      return res.status(200).json({ ok: true });
    }

    const user = getUser(userId);
    if (!user) {
      console.error('Пользователь не найден:', userId);
      return res.status(200).json({ ok: true });
    }

    if (plan === 'month') {
      // Активируем месячную подписку
      const now = new Date();
      // Если подписка ещё активна — продлеваем от текущей даты окончания
      const startDate = user.subscriptionEnd && new Date(user.subscriptionEnd) > now
        ? new Date(user.subscriptionEnd)
        : now;
      const end = new Date(startDate);
      end.setMonth(end.getMonth() + 1);
      saveUser(userId, { subscriptionEnd: end.toISOString(), questionsUsed: 0, questionsResetAt: new Date().toISOString(), extraQuestions: 0 });
      console.log(`Месячная подписка активирована для ${userId} до ${end.toLocaleDateString('ru-RU')}`);

    } else if (plan === 'year') {
      // Активируем годовую подписку
      const now = new Date();
      const startDate = user.subscriptionEnd && new Date(user.subscriptionEnd) > now
        ? new Date(user.subscriptionEnd)
        : now;
      const end = new Date(startDate);
      end.setFullYear(end.getFullYear() + 1);
      saveUser(userId, { subscriptionEnd: end.toISOString(), questionsUsed: 0, questionsResetAt: new Date().toISOString(), extraQuestions: 0 });
      console.log(`Годовая подписка активирована для ${userId} до ${end.toLocaleDateString('ru-RU')}`);

    } else if (plan === 'questions') {
      // Добавляем дополнительные вопросы
      const amount = parseInt(questionsAmount || '30');
      addExtraQuestions(userId, amount);
      console.log(`Добавлено ${amount} вопросов для ${userId}`);
    }

    // Отправляем уведомление пользователю через бота
    // bot передаётся через глобальный объект
    if (global.bot) {
      try {
        if (plan === 'month') {
          const end = new Date(getUser(userId).subscriptionEnd);
          await global.bot.sendMessage(userId,
            `✅ Оплата прошла успешно!\n\nПодписка активна до ${end.toLocaleDateString('ru-RU')} 🎉\n\nТеперь тебе доступно 30 вопросов в месяц. Просто напиши мне — я рядом 💛`
          );
        } else if (plan === 'year') {
          const end = new Date(getUser(userId).subscriptionEnd);
          await global.bot.sendMessage(userId,
            `✅ Оплата прошла успешно!\n\nГодовая подписка активна до ${end.toLocaleDateString('ru-RU')} 🎉\n\nЦелый год вместе — это здорово! 30 вопросов в месяц уже доступны 💛`
          );
        } else if (plan === 'questions') {
          await global.bot.sendMessage(userId,
            `✅ ${questionsAmount} дополнительных вопросов добавлено!\n\nМожешь спрашивать прямо сейчас 💬`
          );
        }
      } catch (e) {
        console.error('Ошибка отправки уведомления:', e.message);
      }
    }

    res.status(200).json({ ok: true });
  } catch (e) {
    console.error('Ошибка webhook:', e);
    res.status(500).json({ error: e.message });
  }
});

// Healthcheck для Railway
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

const startWebhookServer = (port = 3000) => {
  app.listen(port, () => {
    console.log(`🌐 Webhook сервер запущен на порту ${port}`);
  });
};

module.exports = { startWebhookServer };
