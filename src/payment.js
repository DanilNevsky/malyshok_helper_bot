const YooKassa = require('yookassa');
const { v4: uuidv4 } = require('uuid');

const getKassa = () => new YooKassa({
  shopId: process.env.YOOKASSA_SHOP_ID,
  secretKey: process.env.YOOKASSA_SECRET_KEY,
});

const createMonthlyPayment = async (userId) => {
  const kassa = getKassa();
  return await kassa.createPayment({
    amount: { value: '299.00', currency: 'RUB' },
    payment_method_data: { type: 'bank_card' },
    confirmation: { type: 'redirect', return_url: 'https://t.me/malyshok_helper_bot' },
    description: 'Подписка Малышок — 1 месяц',
    metadata: { userId, plan: 'month' },
    capture: true,
  }, uuidv4());
};

const createYearlyPayment = async (userId) => {
  const kassa = getKassa();
  return await kassa.createPayment({
    amount: { value: '2490.00', currency: 'RUB' },
    payment_method_data: { type: 'bank_card' },
    confirmation: { type: 'redirect', return_url: 'https://t.me/malyshok_helper_bot' },
    description: 'Подписка Малышок — 1 год',
    metadata: { userId, plan: 'year' },
    capture: true,
  }, uuidv4());
};

const createQuestionsPayment = async (userId, amount) => {
  const kassa = getKassa();
  const price = amount === 30 ? '149.00' : '349.00';
  return await kassa.createPayment({
    amount: { value: price, currency: 'RUB' },
    payment_method_data: { type: 'bank_card' },
    confirmation: { type: 'redirect', return_url: 'https://t.me/malyshok_helper_bot' },
    description: `Малышок — ${amount} дополнительных вопросов`,
    metadata: { userId, plan: 'questions', questionsAmount: String(amount) },
    capture: true,
  }, uuidv4());
};

module.exports = { createMonthlyPayment, createYearlyPayment, createQuestionsPayment };
