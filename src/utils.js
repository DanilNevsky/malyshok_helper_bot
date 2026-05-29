const fs = require('fs');
const path = require('path');

// Вычислить точный возраст в днях
const getAgeInDays = (birthDate) => {
  const birth = new Date(birthDate);
  const now = new Date();
  return Math.floor((now - birth) / (1000 * 60 * 60 * 24));
};

// Вычислить возраст в месяцах и днях для отображения
const getAgeFormatted = (birthDate) => {
  const birth = new Date(birthDate);
  const now = new Date();

  let years = now.getFullYear() - birth.getFullYear();
  let months = now.getMonth() - birth.getMonth();
  let days = now.getDate() - birth.getDate();

  if (days < 0) {
    months--;
    const prevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    days += prevMonth.getDate();
  }
  if (months < 0) {
    years--;
    months += 12;
  }

  if (years === 0 && months === 0) return `${days} ${pluralDays(days)}`;
  if (years === 0) {
    if (days === 0) return `${months} ${pluralMonths(months)}`;
    return `${months} ${pluralMonths(months)} и ${days} ${pluralDays(days)}`;
  }
  if (months === 0 && days === 0) return `${years} ${pluralYears(years)}`;
  if (months === 0) return `${years} ${pluralYears(years)} и ${days} ${pluralDays(days)}`;
  if (days === 0) return `${years} ${pluralYears(years)} и ${months} ${pluralMonths(months)}`;
  return `${years} ${pluralYears(years)}, ${months} ${pluralMonths(months)} и ${days} ${pluralDays(days)}`;
};

const pluralDays = (n) => {
  if (n % 10 === 1 && n % 100 !== 11) return 'день';
  if ([2,3,4].includes(n % 10) && ![12,13,14].includes(n % 100)) return 'дня';
  return 'дней';
};

const pluralMonths = (n) => {
  if (n % 10 === 1 && n % 100 !== 11) return 'месяц';
  if ([2,3,4].includes(n % 10) && ![12,13,14].includes(n % 100)) return 'месяца';
  return 'месяцев';
};

const pluralYears = (n) => {
  if (n % 10 === 1 && n % 100 !== 11) return 'год';
  if ([2,3,4].includes(n % 10) && ![12,13,14].includes(n % 100)) return 'года';
  return 'лет';
};

// Определить какой блок знаний использовать по возрасту в днях
const getKnowledgeBlock = (ageInDays) => {
  if (ageInDays <= 28)   return 'block-1-newborn-0-4weeks.md';
  if (ageInDays <= 180)  return 'block-2-infant-1-6months.md';
  if (ageInDays <= 365)  return 'block-3-infant-6-12months.md';
  if (ageInDays <= 1095) return 'block-4-toddler-1-3years.md';
  if (ageInDays <= 1825) return 'block-5-preschool-3-5years.md';
  return null; // ребёнок старше 5 лет
};

// Загрузить содержимое блока знаний
const loadKnowledgeBlock = (blockFile) => {
  const blockPath = path.join(__dirname, '../knowledge-base', blockFile);
  if (!fs.existsSync(blockPath)) return null;
  return fs.readFileSync(blockPath, 'utf8');
};

// Определить тему дня по дню недели (7 категорий = 7 дней)
const getDailyTopic = () => {
  const topics = [
    { key: 'питание', label: 'питание и еда' },
    { key: 'сон', label: 'сон и режим' },
    { key: 'моторика', label: 'физическое развитие и моторика' },
    { key: 'речь', label: 'речь и общение' },
    { key: 'когнитивное', label: 'развитие мышления и игры' },
    { key: 'эмоции', label: 'эмоции и привязанность' },
    { key: 'папа', label: 'роль папы и поддержка мамы' },
  ];
  const dayOfWeek = new Date().getDay(); // 0=вс, 1=пн, ...6=сб
  return topics[dayOfWeek];
};

// Проверить активна ли подписка
const isSubscriptionActive = (user) => {
  if (!user) return false;
  if (user.subscriptionEnd) {
    return new Date(user.subscriptionEnd) > new Date();
  }
  // Бесплатный пробный период — 3 дня
  if (user.trialStart) {
    const trialEnd = new Date(user.trialStart);
    trialEnd.setDate(trialEnd.getDate() + 3);
    return trialEnd > new Date();
  }
  return false;
};

const isTrialActive = (user) => {
  if (!user || !user.trialStart) return false;
  const trialEnd = new Date(user.trialStart);
  trialEnd.setDate(trialEnd.getDate() + 3);
  return trialEnd > new Date() && !user.subscriptionEnd;
};

const getTrialDaysLeft = (user) => {
  if (!user || !user.trialStart) return 0;
  const trialEnd = new Date(user.trialStart);
  trialEnd.setDate(trialEnd.getDate() + 3);
  const diff = trialEnd - new Date();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
};

module.exports = {
  getAgeInDays,
  getAgeFormatted,
  getKnowledgeBlock,
  loadKnowledgeBlock,
  getDailyTopic,
  isSubscriptionActive,
  isTrialActive,
  getTrialDaysLeft,
};
