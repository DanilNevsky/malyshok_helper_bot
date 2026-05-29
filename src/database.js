const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const getUser = async (telegramId) => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('telegram_id', String(telegramId))
    .single();
  if (error || !data) return null;
  return mapFromDB(data);
};

const saveUser = async (telegramId, userData) => {
  const existing = await getUser(telegramId);
  const dbData = mapToDB(telegramId, userData, existing);
  const { data, error } = await supabase
    .from('users')
    .upsert(dbData, { onConflict: 'telegram_id' })
    .select()
    .single();
  if (error) { console.error('saveUser error:', error); return null; }
  return mapFromDB(data);
};

const getAllUsers = async () => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('onboarding_complete', true);
  if (error || !data) return [];
  return data.map(mapFromDB);
};

// Добавить вопросы к балансу
const addQuestions = async (telegramId, amount) => {
  const user = await getUser(telegramId);
  if (!user) return 0;
  const newBalance = (user.questionsBalance || 0) + amount;
  await saveUser(telegramId, { questionsBalance: newBalance });
  return newBalance;
};

// Использовать один вопрос
const useQuestion = async (telegramId) => {
  const user = await getUser(telegramId);
  if (!user) return 0;
  const newBalance = Math.max(0, (user.questionsBalance || 0) - 1);
  await saveUser(telegramId, { questionsBalance: newBalance });
  return newBalance;
};

// Получить баланс вопросов
const getQuestionsBalance = async (telegramId) => {
  const user = await getUser(telegramId);
  if (!user) return 0;
  return user.questionsBalance || 0;
};

const mapFromDB = (row) => ({
  telegramId: row.telegram_id,
  momName: row.mom_name,
  dadName: row.dad_name,
  childName: row.child_name,
  childBirthDate: row.child_birth_date,
  childGender: row.child_gender,
  notifyHour: row.notify_hour,
  trialStart: row.trial_start,
  subscriptionEnd: row.subscription_end,
  questionsBalance: row.questions_balance || 0,
  paused: row.paused,
  onboardingComplete: row.onboarding_complete,
});

const mapToDB = (telegramId, userData, existing) => {
  const merged = { ...(existing || {}), ...userData };
  return {
    telegram_id: String(telegramId),
    mom_name: merged.momName ?? existing?.momName ?? null,
    dad_name: merged.dadName !== undefined ? merged.dadName : (existing?.dadName ?? null),
    child_name: merged.childName ?? existing?.childName ?? null,
    child_birth_date: merged.childBirthDate ?? existing?.childBirthDate ?? null,
    child_gender: merged.childGender ?? existing?.childGender ?? 'unknown',
    notify_hour: merged.notifyHour ?? existing?.notifyHour ?? 9,
    trial_start: merged.trialStart ?? existing?.trialStart ?? null,
    subscription_end: merged.subscriptionEnd ?? existing?.subscriptionEnd ?? null,
    questions_balance: merged.questionsBalance ?? existing?.questionsBalance ?? 0,
    paused: merged.paused ?? existing?.paused ?? false,
    onboarding_complete: merged.onboardingComplete ?? existing?.onboardingComplete ?? false,
    updated_at: new Date().toISOString(),
  };
};

module.exports = { getUser, saveUser, getAllUsers, addQuestions, useQuestion, getQuestionsBalance };
