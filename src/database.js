const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../data/users.json');

// Убедиться что папка существует
const ensureDir = () => {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

const readDB = () => {
  ensureDir();
  if (!fs.existsSync(DB_PATH)) return {};
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
};

const writeDB = (data) => {
  ensureDir();
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
};

const getUser = (telegramId) => {
  const db = readDB();
  return db[telegramId] || null;
};

const saveUser = (telegramId, userData) => {
  const db = readDB();
  db[telegramId] = { ...db[telegramId], ...userData, updatedAt: new Date().toISOString() };
  writeDB(db);
  return db[telegramId];
};

const getAllUsers = () => {
  const db = readDB();
  return Object.entries(db).map(([telegramId, data]) => ({ telegramId, ...data }));
};

const incrementQuestions = (telegramId) => {
  const db = readDB();
  if (!db[telegramId]) return 0;
  const now = new Date();
  const user = db[telegramId];

  // Сброс лимита в начале нового месяца
  const lastReset = user.questionsResetAt ? new Date(user.questionsResetAt) : null;
  if (!lastReset || lastReset.getMonth() !== now.getMonth() || lastReset.getFullYear() !== now.getFullYear()) {
    db[telegramId].questionsUsed = 0;
    db[telegramId].questionsResetAt = now.toISOString();
  }

  db[telegramId].questionsUsed = (db[telegramId].questionsUsed || 0) + 1;
  writeDB(db);
  return db[telegramId].questionsUsed;
};

const getQuestionsUsed = (telegramId) => {
  const db = readDB();
  if (!db[telegramId]) return 0;
  const now = new Date();
  const user = db[telegramId];
  const lastReset = user.questionsResetAt ? new Date(user.questionsResetAt) : null;
  if (!lastReset || lastReset.getMonth() !== now.getMonth() || lastReset.getFullYear() !== now.getFullYear()) {
    return 0;
  }
  return user.questionsUsed || 0;
};

module.exports = { getUser, saveUser, getAllUsers, incrementQuestions, getQuestionsUsed };

const addExtraQuestions = (telegramId, amount) => {
  const db = readDB();
  if (!db[telegramId]) return 0;
  db[telegramId].extraQuestions = (db[telegramId].extraQuestions || 0) + amount;
  writeDB(db);
  return db[telegramId].extraQuestions;
};

const getQuestionsLimit = (telegramId) => {
  const db = readDB();
  if (!db[telegramId]) return 30;
  return 30 + (db[telegramId].extraQuestions || 0);
};

module.exports.addExtraQuestions = addExtraQuestions;
module.exports.getQuestionsLimit = getQuestionsLimit;
