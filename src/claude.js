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
Возраст ребёнка сегодня: ${ageFormatted}
Папа: ${user.dadName ? 'есть, зовут ' + user.dadName : 'не указан — мама растит одна'}
Тема сегодняшнего дня: ${topic.label}

Правила:
1. Пиши как тёплая подруга — живо, неформально, с душой
2. Используй ТОЛЬКО факты из базы знаний выше — ничего от себя не придумывай
3. Сосредоточься на теме "${topic.label}"
4. В конце добавь одно короткое предложение о том что именно сейчас формируется в мозге или развитии ребёнка — с восхищением
5. Длина — 4-6 коротких абзацев, не больше
6. Обязательно упомяни имя ребёнка хотя бы один раз
7. Никакой медицины — только развитие, игры, эмоции, питание, сон
8. НЕ заканчивай вопросом к маме — просто поделись и заверши тепло
`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    messages: [{ role: 'user', content: prompt }],
  });

  return response.content[0].text;
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
2. Используй факты из базы знаний. Если ответа нет в базе — можешь ответить из общих знаний о развитии детей, но не выдумывай
3. Если вопрос касается здоровья, симптомов, лекарств или медицины — НЕ отвечай по существу. Скажи: "Это важный вопрос о здоровье ${user.childName} — здесь я не помощник, потому что только педиатр может правильно оценить ситуацию. Позвони своему врачу 💛"
4. Ответ короткий — 2-4 абзаца максимум
5. Никакого медицинского анализа, диагнозов, дозировок
`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    messages: [{ role: 'user', content: prompt }],
  });

  return response.content[0].text;
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
    'Длина 3-4 абзаца. Никакой медицины. Упомяни имя и точный возраст. НЕ заканчивай вопросом к маме — просто поделись информацией и заверши тепло.'
  ].join('\n');

  const response = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 1000,
    messages: [{ role: 'user', content: prompt }],
  });
  return response.content[0].text;
};

module.exports = { generateDailyMessage, answerQuestion, generateWelcomeMessage };
