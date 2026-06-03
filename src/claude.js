const Anthropic = require('@anthropic-ai/sdk');
const { getAgeInDays, getAgeFormatted, getKnowledgeBlock, loadKnowledgeBlock, getDailyTopic } = require('./utils');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const CONSTITUTION = `
Ты — тёплый помощник молодой мамы по имени "Малышок". 
Ты говоришь как умная подруга которая много знает о детском развитии — не как врач и не как учитель.
Ты никогда не даёшь медицинских советов, не анализируешь симптомы, не рекомендуешь лекарства.
При любом вопросе о здоровье — мягко перенаправляешь к педиатру.
Ты всегда называешь ребёнка по имени и обращаешься к маме по имени.
Твои сообщения короткие — мама читает с ребёнком на руках.
Эмодзи используешь умеренно — для тепла, не для пестроты.
`;


// Определить текущий сезон
const getSeason = () => {
  const month = new Date().getMonth() + 1;
  if ([12, 1, 2].includes(month)) return 'зима';
  if ([3, 4, 5].includes(month)) return 'весна';
  if ([6, 7, 8].includes(month)) return 'лето';
  return 'осень';
};

// Проверить есть ли сегодня праздник
const getHoliday = () => {
  const now = new Date();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  if (month === 3 && day === 8) return '8 Марта — Международный женский день';
  if (month === 6 && day === 1) return '1 июня — Международный день защиты детей';
  // День матери — последнее воскресенье ноября
  if (month === 11) {
    const lastSunday = new Date(now.getFullYear(), 11, 0);
    while (lastSunday.getDay() !== 0) lastSunday.setDate(lastSunday.getDate() - 1);
    if (day === lastSunday.getDate()) return 'День матери';
  }
  // День отца — третье воскресенье июня
  if (month === 6) {
    let sundays = 0;
    for (let d = 1; d <= 30; d++) {
      const date = new Date(now.getFullYear(), 5, d);
      if (date.getDay() === 0) sundays++;
      if (sundays === 3 && d === day) return 'День отца';
    }
  }
  return null;
};

// Проверить этапную дату
const getMilestone = (ageInDays) => {
  const milestones = {
    30: '1 месяц',
    90: '3 месяца',
    180: '6 месяцев',
    365: '1 год',
    548: '1.5 года',
    730: '2 года',
    1095: '3 года',
    1460: '4 года',
    1825: '5 лет',
  };
  return milestones[ageInDays] || null;
};
// Генерация ежедневного сообщения
const generateDailyMessage = async (user) => {
  const ageInDays = getAgeInDays(user.childBirthDate);
  const ageFormatted = getAgeFormatted(user.childBirthDate);
  const blockFile = getKnowledgeBlock(ageInDays);

  if (!blockFile) {
    return `Привет, ${user.momName}! ${user.childName} уже вырос из нашей программы — но ты справилась потрясающе 🌟`;
  }

  const knowledge = loadKnowledgeBlock(blockFile);
  const topic = getDailyTopic();

  const prompt = `
${CONSTITUTION}

Вот база знаний о детском развитии для текущего возраста ребёнка:
<knowledge>
${knowledge}
</knowledge>

Напиши ежедневное утреннее сообщение для мамы по имени ${user.momName}.
Имя ребёнка: ${user.childName}
Пол ребёнка: ${user.childGender === 'boy' ? 'мальчик' : user.childGender === 'girl' ? 'девочка' : 'неизвестно'}
Возраст ребёнка сегодня: ${ageFormatted} (точно ${ageInDays} дней от рождения — фокусируйся на том, что актуально именно в этот момент, а не на всём диапазоне блока)
Папа: ${user.dadName ? 'есть, зовут ' + user.dadName : 'не указан — мама растит одна'}
Тема сегодняшнего дня: ${topic.label}

Правила:
1. Пиши как тёплая подруга — живо, неформально, с душой. Начни с тёплого приветствия по имени мамы, но НЕ используй 'Доброе утро' — рассылка приходит в разное время суток. Можно просто 'Привет, [имя]! 👋' или '[имя] 💛' или сразу с чего-то интересного про ребёнка
2. Используй ТОЛЬКО факты из базы знаний выше — ничего от себя не придумывай
3. СТРОГИЙ ЗАПРЕТ: не называй конкретные цифры, сроки и возраст если их нет в базе знаний — лучше написать "примерно в этом возрасте" чем придумать точную цифру
4. Сосредоточься на теме "${topic.label}"
5. ФОРМУЛА: сначала объясни ПОЧЕМУ так происходит (факт из базы), потом дай КОНКРЕТНЫЙ ЛАЙФХАК — что мама может сделать прямо сегодня. Не просто интересный факт а практический совет который упрощает жизнь
6. В конце добавь одно короткое предложение о том что именно сейчас формируется в мозге или развитии ребёнка — с восхищением
7. Длина — 4-6 коротких абзацев, не больше
8. Обязательно упомяни имя ребёнка хотя бы один раз
9. Никакой медицины — только развитие, игры, эмоции, питание, сон
10. НЕ заканчивай вопросом к маме — просто поделись и заверши тепло
11. СТРОГО: не пиши никаких XML-тегов, служебных пометок, отчётов о выполнении правил или внутренних комментариев — только само сообщение для мамы
`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 1000,
    messages: [{ role: 'user', content: prompt }],
  });

  const textBlock = response.content.find(b => b.type === 'text');
  return textBlock ? textBlock.text.trim() : '';
};

// Ответ на вопрос мамы
const answerQuestion = async (user, question) => {
  const ageInDays = getAgeInDays(user.childBirthDate);
  const ageFormatted = getAgeFormatted(user.childBirthDate);
  const blockFile = getKnowledgeBlock(ageInDays);
  const knowledge = blockFile ? loadKnowledgeBlock(blockFile) : '';

  const prompt = `
${CONSTITUTION}

Вот база знаний о детском развитии для текущего возраста ребёнка:
<knowledge>
${knowledge || 'База знаний для этого возраста недоступна.'}
</knowledge>

Мама: ${user.momName}
Имя ребёнка: ${user.childName}
Пол ребёнка: ${user.childGender === 'boy' ? 'мальчик' : user.childGender === 'girl' ? 'девочка' : 'неизвестно'}
Возраст ребёнка: ${ageFormatted}
Папа: ${user.dadName ? 'есть, зовут ' + user.dadName : 'не указан — мама растит одна'}

Вопрос мамы: "${question}"

Правила ответа:
1. Отвечай как тёплая подруга — живо, по-человечески
2. Используй факты из базы знаний. Если ответа нет в базе — можешь ответить из общих знаний о развитии детей, но СТРОГО: не называй конкретные цифры, сроки и возраст если не уверен на 100%. Лучше сказать 'примерно в этом возрасте' или 'у большинства детей' чем назвать точную цифру и ошибиться
3. Если вопрос касается здоровья, симптомов, лекарств или медицины — НЕ отвечай по существу. Скажи: "Это важный вопрос о здоровье ${user.childName} — здесь я не помощник, потому что только педиатр может правильно оценить ситуацию. Позвони своему врачу 💛"
4. Ответ короткий — 2-4 абзаца максимум
5. Никакого медицинского анализа, диагнозов, дозировок
6. СТРОГО: не пиши никаких XML-тегов, служебных пометок или внутренних комментариев — только сам ответ для мамы
`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 1000,
    messages: [{ role: 'user', content: prompt }],
  });

  const textBlock = response.content.find(b => b.type === 'text');
  return textBlock ? textBlock.text.trim() : '';
};



// Первое приветственное сообщение сразу после онбординга

// Первое приветственное сообщение сразу после онбординга
const generateWelcomeMessage = async (user) => {
  const ageInDays = getAgeInDays(user.childBirthDate);
  const ageFormatted = getAgeFormatted(user.childBirthDate);
  const blockFile = getKnowledgeBlock(ageInDays);
  if (!blockFile) return null;
  const knowledge = loadKnowledgeBlock(blockFile);
  const genderText = user.childGender === 'boy' ? 'мальчик' : user.childGender === 'girl' ? 'девочка' : 'неизвестно';

  const prompt = [
    CONSTITUTION,
    'Вот база знаний:',
    knowledge,
    'Мама: ' + user.momName,
    'Имя ребёнка: ' + user.childName,
    'Пол: ' + genderText,
    'Возраст: ' + ageFormatted,
    'Папа: ' + (user.dadName ? 'есть, зовут ' + user.dadName : 'не указан — мама растит одна'),
    '',
    'Напиши ПЕРВОЕ сообщение после знакомства с ботом. НЕ начинай с "Доброе утро".',
    'Начни с интересного факта что прямо сейчас происходит в развитии ребёнка.',
    'Используй ТОЛЬКО факты из базы знаний. Тон — как подруга которая говорит "знаешь что интересно про твоего малыша прямо сейчас?"',
    'Длина 3-4 абзаца. Никакой медицины. Упомяни имя и точный возраст. НЕ заканчивай вопросом к маме — просто поделись информацией и заверши тепло.',
    'СТРОГО: не пиши никаких XML-тегов, служебных пометок или внутренних комментариев — только само сообщение для мамы.'
  ].join('\n');

  const response = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 1000,
    messages: [{ role: 'user', content: prompt }],
  });
  const textBlock = response.content.find(b => b.type === 'text');
  return textBlock ? textBlock.text.trim() : '';
};

module.exports = { generateDailyMessage, answerQuestion, generateWelcomeMessage };
