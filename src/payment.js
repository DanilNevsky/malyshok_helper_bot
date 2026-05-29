const { YooCheckout } = require('yookassa');
const { v4: uuidv4 } = require('uuid');

// Инициализация ЮКассы
// Заменить на реальные ключи после регистрации
const checkout = new YooCheckout({
  shopId: process.env.YOOKASSA_SHOP_ID,
  secretKey: process.env.YOOKASSA_SECRET_KEY,
});

// Создать платёж за месячную подписку
const createMonthlyPayment = async (userId, userEmail) => {
  const idempotenceKey = uuidv4();
  const payment = await checkout.createPayment({
    amount: {
      value: '299.00',
      currency: 'RUB',
    },
    payment_method_data: {
      type: 'bank_card',
    },
    confirmation: {
      type: 'redirect',
      return_url: `https://t.me/malyshok_helper_bot`,
    },
    description: 'Подписка Малышок — 1 месяц',
    metadata: {
      userId,
      plan: 'month',
    },
    capture: true,
  }, idempotenceKey);

  return payment;
};

// Создать платёж за годовую подписку
const createYearlyPayment = async (userId) => {
  const idempotenceKey = uuidv4();
  const payment = await checkout.createPayment({
    amount: {
      value: '2490.00',
      currency: 'RUB',
    },
    payment_method_data: {
      type: 'bank_card',
    },
    confirmation: {
      type: 'redirect',
      return_url: `https://t.me/malyshok_helper_bot`,
    },
    description: 'Подписка Малышок — 1 год',
    metadata: {
      userId,
      plan: 'year',
    },
    capture: true,
  }, idempotenceKey);

  return payment;
};

// Создать платёж за дополнительные вопросы
const createQuestionsPayment = async (userId, amount) => {
  const idempotenceKey = uuidv4();
  const price = amount === 30 ? '149.00' : '349.00';
  const payment = await checkout.createPayment({
    amount: {
      value: price,
      currency: 'RUB',
    },
    payment_method_data: {
      type: 'bank_card',
    },
    confirmation: {
      type: 'redirect',
      return_url: `https://t.me/malyshok_helper_bot`,
    },
    description: `Малышок — ${amount} дополнительных вопросов`,
    metadata: {
      userId,
      plan: 'questions',
      questionsAmount: String(amount),
    },
    capture: true,
  }, idempotenceKey);

  return payment;
};

module.exports = { createMonthlyPayment, createYearlyPayment, createQuestionsPayment };
