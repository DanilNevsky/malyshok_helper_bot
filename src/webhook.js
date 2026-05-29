const express = require('express');
const { saveUser, getUser, addQuestions } = require('./database');

const app = express();
app.use(express.json());

app.post('/webhook/yookassa', async (req, res) => {
  try {
    const event = req.body;
    console.log('ЮКасса webhook:', JSON.stringify(event));

    if (event.event !== 'payment.succeeded') {
      return res.status(200).json({ ok: true });
    }

    const payment = event.object;
    const { userId, plan, questionsAmount } = payment.metadata;

    if (!userId) return res.status(200).json({ ok: true });

    const user = await getUser(userId);
    if (!user) return res.status(200).json({ ok: true });

    if (plan === 'month') {
      // Подписка месяц: активируем рассылку + добавляем 30 вопросов
      const now = new Date();
      const startDate = user.subscriptionEnd && new Date(user.subscriptionEnd) > now
        ? new Date(user.subscriptionEnd) : now;
      const end = new Date(startDate);
      end.setMonth(end.getMonth() + 1);
      await saveUser(userId, { subscriptionEnd: end.toISOString() });
      await addQuestions(userId, 30);
      console.log(`Месячная подписка для ${userId} до ${end.toLocaleDateString('ru-RU')}, +30 вопросов`);

      if (global.bot) {
        const updatedUser = await getUser(userId);
        await global.bot.sendMessage(userId,
          `✅ Оплата прошла успешно!\n\nПодписка активна до ${end.toLocaleDateString('ru-RU')} 🎉\nБаланс вопросов: ${updatedUser.questionsBalance} 💬\n\nКаждое утро тебя ждёт новый совет, и ты можешь задавать вопросы прямо сейчас 💛`,
          { reply_markup: { keyboard: [['💬 Спросить Малышка'], ['📊 Мой профиль', '⚙️ Настройки'], ['💳 Подписка']], resize_keyboard: true } }
        );
        if (global.sessions) global.sessions[userId] = { step: 'active' };
      }

    } else if (plan === 'year') {
      // Подписка год: активируем рассылку + добавляем 365 вопросов
      const now = new Date();
      const startDate = user.subscriptionEnd && new Date(user.subscriptionEnd) > now
        ? new Date(user.subscriptionEnd) : now;
      const end = new Date(startDate);
      end.setFullYear(end.getFullYear() + 1);
      await saveUser(userId, { subscriptionEnd: end.toISOString() });
      await addQuestions(userId, 365);
      console.log(`Годовая подписка для ${userId} до ${end.toLocaleDateString('ru-RU')}, +365 вопросов`);

      if (global.bot) {
        const updatedUser = await getUser(userId);
        await global.bot.sendMessage(userId,
          `✅ Оплата прошла успешно!\n\nГодовая подписка активна до ${end.toLocaleDateString('ru-RU')} 🎉\nБаланс вопросов: ${updatedUser.questionsBalance} 💬\n\nЦелый год вместе! 💛`,
          { reply_markup: { keyboard: [['💬 Спросить Малышка'], ['📊 Мой профиль', '⚙️ Настройки'], ['💳 Подписка']], resize_keyboard: true } }
        );
        if (global.sessions) global.sessions[userId] = { step: 'active' };
      }

    } else if (plan === 'questions') {
      // Докупка вопросов — просто добавляем к балансу
      const amount = parseInt(questionsAmount || '30');
      await addQuestions(userId, amount);
      console.log(`+${amount} вопросов для ${userId}`);

      if (global.bot) {
        const updatedUser = await getUser(userId);
        await global.bot.sendMessage(userId,
          `✅ ${amount} вопросов добавлено!\n\nТвой баланс: ${updatedUser.questionsBalance} вопросов 💬`,
          { reply_markup: { keyboard: [['💬 Спросить Малышка'], ['📊 Мой профиль', '⚙️ Настройки'], ['💳 Подписка']], resize_keyboard: true } }
        );
        if (global.sessions) global.sessions[userId] = { step: 'active' };
      }
    }

    res.status(200).json({ ok: true });
  } catch (e) {
    console.error('Ошибка webhook:', e);
    res.status(500).json({ error: e.message });
  }
});

app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));

const startWebhookServer = (port = 3000) => {
  app.listen(port, () => console.log(`🌐 Webhook сервер запущен на порту ${port}`));
};

module.exports = { startWebhookServer };
