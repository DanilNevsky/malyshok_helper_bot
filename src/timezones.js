// Таблица регионов России и популярных стран → IANA timezone
// Поиск по ключевым словам (не точное совпадение)

const REGION_TIMEZONES = {
  // UTC+2 — Калининград
  'калининград': 'Europe/Kaliningrad',

  // UTC+3 — Москва и большинство европейской части
  'москв': 'Europe/Moscow',
  'питер': 'Europe/Moscow',
  'петербург': 'Europe/Moscow',
  'ленинград': 'Europe/Moscow',
  'краснодар': 'Europe/Moscow',
  'ростов': 'Europe/Moscow',
  'воронеж': 'Europe/Moscow',
  'нижний новгород': 'Europe/Moscow',
  'нижегородск': 'Europe/Moscow',
  'казань': 'Europe/Moscow',
  'татарстан': 'Europe/Moscow',
  'башкортостан': 'Europe/Moscow',
  'уфа': 'Europe/Moscow',
  'пермь': 'Europe/Moscow',
  'пермск': 'Europe/Moscow',
  'саратов': 'Europe/Moscow',
  'волгоград': 'Europe/Moscow',
  'астрахань': 'Europe/Moscow',
  'ставрополь': 'Europe/Moscow',
  'белгород': 'Europe/Moscow',
  'брянск': 'Europe/Moscow',
  'владимир': 'Europe/Moscow',
  'иванов': 'Europe/Moscow',
  'калуг': 'Europe/Moscow',
  'кировск': 'Europe/Moscow',
  'киров': 'Europe/Moscow',
  'костром': 'Europe/Moscow',
  'курск': 'Europe/Moscow',
  'липецк': 'Europe/Moscow',
  'орел': 'Europe/Moscow',
  'орловск': 'Europe/Moscow',
  'пензенск': 'Europe/Moscow',
  'псков': 'Europe/Moscow',
  'рязань': 'Europe/Moscow',
  'смоленск': 'Europe/Moscow',
  'тамбов': 'Europe/Moscow',
  'тверь': 'Europe/Moscow',
  'тверск': 'Europe/Moscow',
  'тул': 'Europe/Moscow',
  'ярославль': 'Europe/Moscow',
  'мордов': 'Europe/Moscow',
  'марий эл': 'Europe/Moscow',
  'чуваши': 'Europe/Moscow',
  'карели': 'Europe/Moscow',
  'коми': 'Europe/Moscow',
  'архангельск': 'Europe/Moscow',
  'вологд': 'Europe/Moscow',
  'мурманск': 'Europe/Moscow',
  'новгород': 'Europe/Moscow',
  'дагестан': 'Europe/Moscow',
  'чечн': 'Europe/Moscow',
  'ингушети': 'Europe/Moscow',
  'осети': 'Europe/Moscow',
  'кабардин': 'Europe/Moscow',
  'карачаев': 'Europe/Moscow',
  'адыгей': 'Europe/Moscow',
  'крым': 'Europe/Moscow',
  'севастополь': 'Europe/Moscow',

  // UTC+4 — Самара, Удмуртия
  'самар': 'Europe/Samara',
  'удмурти': 'Europe/Samara',
  'ижевск': 'Europe/Samara',
  'ульяновск': 'Europe/Samara',

  // UTC+5 — Екатеринбург
  'екатеринбург': 'Asia/Yekaterinburg',
  'свердловск': 'Asia/Yekaterinburg',
  'челябинск': 'Asia/Yekaterinburg',
  'курган': 'Asia/Yekaterinburg',
  'тюмень': 'Asia/Yekaterinburg',
  'тюменск': 'Asia/Yekaterinburg',
  'ханты': 'Asia/Yekaterinburg',
  'ямал': 'Asia/Yekaterinburg',

  // UTC+6 — Омск
  'омск': 'Asia/Omsk',

  // UTC+7 — Новосибирск, Красноярск
  'новосибирск': 'Asia/Novosibirsk',
  'красноярск': 'Asia/Krasnoyarsk',
  'кемеров': 'Asia/Novosibirsk',
  'томск': 'Asia/Tomsk',
  'алтай': 'Asia/Barnaul',
  'барнаул': 'Asia/Barnaul',
  'хакасси': 'Asia/Krasnoyarsk',
  'тыв': 'Asia/Krasnoyarsk',

  // UTC+8 — Иркутск
  'иркутск': 'Asia/Irkutsk',
  'бурятия': 'Asia/Irkutsk',
  'улан-удэ': 'Asia/Irkutsk',
  'забайкаль': 'Asia/Chita',
  'чита': 'Asia/Chita',

  // UTC+9 — Якутск
  'якутск': 'Asia/Yakutsk',
  'якути': 'Asia/Yakutsk',

  // UTC+10 — Владивосток, Хабаровск
  'владивосток': 'Asia/Vladivostok',
  'хабаровск': 'Asia/Vladivostok',
  'приморск': 'Asia/Vladivostok',
  'амурск': 'Asia/Vladivostok',
  'амурская': 'Asia/Yakutsk',

  // UTC+11 — Магадан, Сахалин
  'магадан': 'Asia/Magadan',
  'сахалин': 'Asia/Sakhalin',

  // UTC+12 — Камчатка, Чукотка
  'камчатк': 'Asia/Kamchatka',
  'чукотк': 'Asia/Anadyr',

  // Популярные зарубежные
  'беларусь': 'Europe/Minsk',
  'минск': 'Europe/Minsk',
  'украина': 'Europe/Kiev',
  'киев': 'Europe/Kiev',
  'казахстан': 'Asia/Almaty',
  'алматы': 'Asia/Almaty',
  'нур-султан': 'Asia/Almaty',
  'астана': 'Asia/Almaty',
  'грузия': 'Asia/Tbilisi',
  'тбилиси': 'Asia/Tbilisi',
  'армения': 'Asia/Yerevan',
  'ереван': 'Asia/Yerevan',
  'азербайджан': 'Asia/Baku',
  'баку': 'Asia/Baku',
  'узбекистан': 'Asia/Tashkent',
  'ташкент': 'Asia/Tashkent',
  'израиль': 'Asia/Jerusalem',
  'тель-авив': 'Asia/Jerusalem',
  'германия': 'Europe/Berlin',
  'берлин': 'Europe/Berlin',
  'франция': 'Europe/Paris',
  'париж': 'Europe/Paris',
  'лондон': 'Europe/London',
  'дубай': 'Asia/Dubai',
  'оаэ': 'Asia/Dubai',
};

// Найти timezone по тексту пользователя
const findTimezone = (input) => {
  if (!input) return 'Europe/Moscow';
  const lower = input.toLowerCase().trim();

  for (const [key, tz] of Object.entries(REGION_TIMEZONES)) {
    if (lower.includes(key)) return tz;
  }

  return null; // не нашли
};

module.exports = { findTimezone, REGION_TIMEZONES };
