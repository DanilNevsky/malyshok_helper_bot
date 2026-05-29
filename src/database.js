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

const incrementQuestions = async (telegramId) => {
  const user = await getUser(telegramId);
  if (!user) return 0;
  const now = new Date();
  const lastReset = user.questionsResetAt ? new Date(user.questionsResetAt) : null;
  let questionsUsed = user.questionsUsed || 0;
  if (!lastReset || lastReset.getMonth() !== now.getMonth() || lastReset.getFullYear() !== now.getFullYear()) {
    questionsUsed = 0;
    await saveUser(telegramId, { questionsResetAt: now.toISOString() });
  }
  questionsUsed += 1;
  await saveUser(telegramId, { questionsUsed });
  return questionsUsed;
};

const getQuestionsUsed = async (telegramId) => {
  const user = await getUser(telegramId);
  if (!user) return 0;
  const now = new Date();
  const lastReset = user.questionsResetAt ? new Date(user.questionsResetAt) : null;
  if (!lastReset || lastReset.getMonth() !== now.getMonth() || lastReset.getFullYear() !== now.getFullYear()) return 0;
  return user.questionsUsed || 0;
};

const getQuestionsLimit = (telegramId) => 30;

const addExtraQuestions = async (telegramId, amount) => {
  const user = await getUser(telegramId);
  if (!user) return 0;
  const extra = (user.extraQuestions || 0) + amount;
  await saveUser(telegramId, { extraQuestions: extra });
  return extra;
};

// Маппинг из БД в объект приложения
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
  questionsUsed: row.questions_used,
  questionsResetAt: row.questions_reset_at,
  extraQuestions: row.extra_questions,
  paused: row.paused,
  onboardingComplete: row.onboarding_complete,
});

// Маппинг из объекта приложения в БД
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
    questions_used: merged.questionsUsed ?? existing?.questionsUsed ?? 0,
    questions_reset_at: merged.questionsResetAt ?? existing?.questionsResetAt ?? null,
    extra_questions: merged.extraQuestions ?? existing?.extraQuestions ?? 0,
    paused: merged.paused ?? existing?.paused ?? false,
    onboarding_complete: merged.onboardingComplete ?? existing?.onboardingComplete ?? false,
    updated_at: new Date().toISOString(),
  };
};

module.exports = { getUser, saveUser, getAllUsers, incrementQuestions, getQuestionsUsed, getQuestionsLimit, addExtraQuestions };
