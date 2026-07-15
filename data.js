/* ВЕЛЮР — демо-данные.
   Seeded PRNG → генерация детерминирована, но даты привязаны к «сегодня»,
   поэтому дашборд, записи и догоны всегда выглядят живыми. */

(function () {
  'use strict';

  // --- PRNG (mulberry32) ---
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rnd = mulberry32(20260715);
  const ri = (min, max) => min + Math.floor(rnd() * (max - min + 1));
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];

  // --- Календарь ---
  const TODAY = new Date();
  TODAY.setHours(0, 0, 0, 0);
  const day = (offset) => {
    const d = new Date(TODAY);
    d.setDate(d.getDate() + offset);
    return d;
  };
  const iso = (d) => {
    const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  };

  // --- Мастер ---
  const MASTER = {
    name: 'Алина Морозова',
    studio: 'Студия «Велюр»',
    role: 'Мастер маникюра и бровей',
    city: 'Сочи',
  };

  // --- Услуги ---
  // msg — полное название в винительном падеже для личных сообщений («жду вас на …»)
  const SERVICES = [
    { id: 'man', name: 'Маникюр + гель-лак', short: 'Маникюр', msg: 'маникюр с покрытием', price: 2800, dur: 120 },
    { id: 'ped', name: 'Педикюр + покрытие', short: 'Педикюр', msg: 'педикюр с покрытием', price: 3400, dur: 90 },
    { id: 'ukr', name: 'Укрепление ногтей', short: 'Укрепление', msg: 'укрепление ногтей', price: 900, dur: 30 },
    { id: 'bro', name: 'Брови: коррекция + окрашивание', short: 'Брови', msg: 'коррекцию и окрашивание бровей', price: 1400, dur: 45 },
    { id: 'lam', name: 'Ламинирование бровей', short: 'Лам. бровей', msg: 'ламинирование бровей', price: 2300, dur: 60 },
    { id: 'res', name: 'Ламинирование ресниц', short: 'Лам. ресниц', msg: 'ламинирование ресниц', price: 2700, dur: 75 },
  ];
  const SVC = Object.fromEntries(SERVICES.map((s) => [s.id, s]));

  // --- Причины отмен ---
  const CANCEL_REASONS = ['Перенесла запись', 'Заболела', 'Не подтвердила запись', 'Уехала из города', 'Передумала'];

  /* --- Клиентки ---
     cohort: vip | regular | new | sleeping | risk — задаёт форму истории.
     favs: базовые услуги, interval: средний цикл визитов в днях. */
  const CLIENT_SEEDS = [
    // VIP: давно ходят, часто, стабильно
    ['Анна Соколова',      'vip', ['man', 'bro'], 21, '03-14', 'Кофе с корицей. Аллергия на гель Kodi.'],
    ['Мария Ким',          'vip', ['man', 'ped'], 24, '11-02', 'Предпочитает утренние слоты.'],
    ['Дарья Лебедева',     'vip', ['man', 'res'], 21, '07-29', 'Всегда берёт дизайн на 2 ногтя.'],
    ['Ольга Виноградова',  'vip', ['man', 'bro'], 28, '01-19', 'Приводит подруг — дать бонус за рекомендации.'],
    ['Екатерина Мельник',  'vip', ['ped', 'man'], 24, '09-08', ''],
    ['София Орлова',       'vip', ['man', 'lam'], 21, '05-23', 'Чувствительная кожа, мягкая пилка.'],
    // Постоянные
    ['Алиса Громова',      'regular', ['man'], 28, '02-11', ''],
    ['Виктория Царёва',    'regular', ['man', 'ukr'], 30, '12-05', 'Ногти ломкие — всегда укрепление.'],
    ['Полина Шестакова',   'regular', ['bro'], 32, '06-17', ''],
    ['Ксения Волкова',     'regular', ['man'], 26, '04-02', ''],
    ['Наталья Романова',   'regular', ['ped'], 35, '08-25', 'Только будни после 18:00.'],
    ['Ирина Белова',       'regular', ['man', 'bro'], 28, '10-13', ''],
    ['Юлия Савельева',     'regular', ['man'], 30, '03-30', ''],
    ['Кристина Зайцева',   'regular', ['res'], 40, '07-07', 'Ресницы — свои, красить не надо.'],
    ['Елизавета Фомина',   'regular', ['man', 'ped'], 28, '11-21', ''],
    ['Татьяна Крылова',    'regular', ['man'], 32, '01-04', ''],
    ['Светлана Никитина',  'regular', ['bro', 'lam'], 36, '09-16', ''],
    ['Вероника Гусева',    'regular', ['man'], 27, '05-09', 'Просит без металлических украшений.'],
    ['Диана Абрамова',     'regular', ['man', 'bro'], 29, '02-27', ''],
    ['Маргарита Ильина',   'regular', ['ped'], 38, '12-19', ''],
    ['Алёна Тарасова',     'regular', ['man'], 31, '06-03', ''],
    ['Валерия Комарова',   'regular', ['man', 'ukr'], 25, '10-28', ''],
    ['Евгения Сорокина',   'regular', ['lam'], 42, '04-15', ''],
    ['Людмила Киселёва',   'regular', ['man', 'ped'], 30, '08-11', 'Дочь тоже хочет записаться.'],
    // Новые: 1–2 визита
    ['Оксана Павлова',     'new', ['man'], 30, '07-19', 'Пришла по рекомендации Ольги В.'],
    ['Яна Фролова',        'new', ['bro'], 30, '03-08', ''],
    ['Галина Степанова',   'new', ['man'], 28, '11-11', ''],
    ['Регина Хакимова',    'new', ['res'], 35, '05-30', ''],
    ['Милана Ковалёва',    'new', ['man'], 26, '09-24', 'Из Instagram-рекламы.'],
    ['Лилия Сафина',       'new', ['man', 'bro'], 30, '01-26', ''],
    ['Надежда Тихонова',   'new', ['ped'], 32, '06-28', ''],
    ['Элина Мустафина',    'new', ['man'], 28, '10-06', ''],
    // Спящие: пропали 60+ дней назад
    ['Жанна Александрова', 'sleeping', ['man'], 28, '02-18', ''],
    ['Карина Демидова',    'sleeping', ['man', 'bro'], 30, '12-09', 'Переехала в другой район.'],
    ['Инна Максимова',     'sleeping', ['ped'], 34, '04-22', ''],
    ['Лариса Богданова',   'sleeping', ['man'], 30, '08-01', ''],
    ['Снежана Мороз',      'sleeping', ['lam'], 38, '07-24', ''],
    ['Азалия Гареева',     'sleeping', ['man', 'ukr'], 27, '11-30', ''],
    ['Варвара Одинцова',   'sleeping', ['bro'], 33, '03-21', ''],
    // Риск: цикл превышен, будущей записи нет
    ['Тамара Гончарова',   'risk', ['man'], 26, '09-02', ''],
    ['Нина Ефимова',       'risk', ['man', 'bro'], 28, '05-12', ''],
    ['Зарина Алиева',      'risk', ['ped'], 30, '01-08', ''],
    ['Динара Юсупова',     'risk', ['man'], 24, '10-17', 'Любит нюдовые оттенки.'],
    ['Есения Лазарева',    'risk', ['res'], 36, '06-09', ''],
  ];

  // Дни рождения в ближайшую неделю — для догона «поздравить»
  const bdSoon = [day(2), day(5)];

  const clients = [];
  const appointments = [];
  let apptId = 1;

  // Сетка одного мастера: слоты по 2 часа — любая услуга (до 120 мин) помещается в один слот.
  // занятые слоты будущих дней: 'YYYY-MM-DD HH:MM' → true
  const takenSlots = {};
  const SLOT_TIMES = ['10:00', '12:00', '14:00', '16:00', '18:00'];

  function takeSlot(dateIso, preferIdx) {
    for (let k = 0; k < SLOT_TIMES.length; k++) {
      const t = SLOT_TIMES[(preferIdx + k) % SLOT_TIMES.length];
      const key = dateIso + ' ' + t;
      if (!takenSlots[key]) { takenSlots[key] = true; return t; }
    }
    return null;
  }

  CLIENT_SEEDS.forEach((seed, idx) => {
    const [name, cohort, favs, interval, bday, note] = seed;
    const id = 'c' + (idx + 1);
    const phone = `+7 9${ri(10, 89)} ${ri(100, 999)}-${String(ri(0, 99)).padStart(2, '0')}-${String(ri(0, 99)).padStart(2, '0')}`;
    const tg = '@' + name.split(' ')[0].toLowerCase()
      .replace(/ё/g, 'e').replace(/[аа]/g, 'a').replace(/о/g, 'o').replace(/е/g, 'e')
      .replace(/и/g, 'i').replace(/у/g, 'u').replace(/[^a-z]/g, '') + ri(2, 99);

    // Глубина истории по когорте
    let joinedDaysAgo, lastGap;
    if (cohort === 'vip') { joinedDaysAgo = ri(170, 210); lastGap = ri(3, interval - 4); }
    else if (cohort === 'regular') { joinedDaysAgo = ri(90, 180); lastGap = ri(3, interval - 2); }
    else if (cohort === 'new') { joinedDaysAgo = ri(10, 50); lastGap = ri(2, 20); }
    else if (cohort === 'sleeping') { joinedDaysAgo = ri(150, 210); lastGap = ri(62, 105); }
    else { joinedDaysAgo = ri(100, 190); lastGap = Math.round(interval * (1.5 + rnd() * 0.4)); }

    let bdayFinal = bday;
    if (idx === 0) bdayFinal = `${String(bdSoon[0].getMonth() + 1).padStart(2, '0')}-${String(bdSoon[0].getDate()).padStart(2, '0')}`;
    if (idx === 7) bdayFinal = `${String(bdSoon[1].getMonth() + 1).padStart(2, '0')}-${String(bdSoon[1].getDate()).padStart(2, '0')}`;

    const client = {
      id, name, phone, tg, birthday: bdayFinal, note: note || '',
      cohort, favs, interval, joined: iso(day(-joinedDaysAgo)),
    };
    clients.push(client);

    // --- История визитов: от joined до последнего визита (lastGap дней назад) ---
    let cursor = joinedDaysAgo;
    const visits = [];
    while (cursor > lastGap) {
      visits.push(cursor);
      cursor -= Math.max(14, Math.round(interval * (0.8 + rnd() * 0.45)));
    }
    if (!visits.includes(lastGap) && cohort !== 'new') visits.push(lastGap);
    if (cohort === 'new' && visits.length === 0) visits.push(lastGap);

    visits.sort((a, b) => b - a); // от старых (большой offset) к свежим
    visits.forEach((offset, vi) => {
      const isLast = offset === Math.min(...visits);
      // исходы: done чаще всего; отмены/неявки — только не в последнем визите
      let status = 'done', reason = null;
      const roll = rnd();
      if (!isLast && roll > 0.90) { status = 'cancelled'; reason = pick(CANCEL_REASONS); }
      else if (!isLast && roll > 0.86) { status = 'no_show'; reason = 'Не пришла без предупреждения'; }
      const svcIds = [...favs];
      if (favs.includes('man') && rnd() < 0.3 && !svcIds.includes('ukr')) svcIds.push('ukr');
      const price = svcIds.reduce((s, sid) => s + SVC[sid].price, 0);
      appointments.push({
        id: 'a' + apptId++, clientId: id, serviceIds: svcIds, price,
        date: iso(day(-offset)), time: pick(SLOT_TIMES), status, reason,
      });
    });

    // --- Будущие записи: одна услуга = один слот, чтобы сетка сходилась физически ---
    const hasFuture = (cohort === 'vip') || (cohort === 'regular' && rnd() < 0.72) || (cohort === 'new' && rnd() < 0.5);
    if (hasFuture) {
      const inDays = cohort === 'vip' ? ri(1, 9) : ri(1, 13);
      const dIso = iso(day(inDays));
      const t = takeSlot(dIso, ri(0, SLOT_TIMES.length - 1));
      if (t) {
        const svcIds = [favs[0]];
        const price = svcIds.reduce((s, sid) => s + SVC[sid].price, 0);
        appointments.push({
          id: 'a' + apptId++, clientId: id, serviceIds: svcIds, price,
          date: dIso, time: t,
          status: inDays <= 2 ? (rnd() < 0.6 ? 'confirmed' : 'pending') : (rnd() < 0.35 ? 'confirmed' : 'pending'),
          reason: null,
        });
      }
    }
  });

  // --- Сегодняшний день: живая лента ---
  // Утро: 2 завершённых визита; день/вечер: подтверждённая и неподтверждённая записи.
  const todayIso = iso(TODAY);
  function forceToday(clientIdx, time, status) {
    const c = clients[clientIdx];
    const svcIds = [c.favs[0]];
    const price = svcIds.reduce((s, sid) => s + SVC[sid].price, 0);
    takenSlots[todayIso + ' ' + time] = true;
    appointments.push({
      id: 'a' + apptId++, clientId: c.id, serviceIds: svcIds, price,
      date: todayIso, time, status, reason: status === 'no_show' ? 'Не пришла без предупреждения' : null,
    });
  }
  forceToday(0, '10:00', 'done');
  forceToday(9, '12:00', 'done');
  forceToday(2, '14:00', 'confirmed');
  forceToday(12, '16:00', 'pending');
  forceToday(20, '18:00', 'pending');

  // Вчера: завершённые визиты для догона «как впечатления» + одна неявка
  const yIso = iso(day(-1));
  function forceYesterday(clientIdx, time, status) {
    const c = clients[clientIdx];
    const svcIds = [c.favs[0]];
    appointments.push({
      id: 'a' + apptId++, clientId: c.id, serviceIds: svcIds,
      price: svcIds.reduce((s, sid) => s + SVC[sid].price, 0),
      date: yIso, time, status,
      reason: status === 'no_show' ? 'Не пришла без предупреждения' : null,
    });
  }
  forceYesterday(6, '12:00', 'done');
  forceYesterday(15, '16:00', 'done');
  forceYesterday(39, '18:00', 'no_show');

  // Свежие потери за последние 30 дней — чтобы аналитика потерь была наглядной
  [
    [10, 3, 'cancelled', 'Не подтвердила запись'],
    [13, 6, 'cancelled', 'Перенесла запись'],
    [40, 9, 'no_show', 'Не пришла без предупреждения'],
    [18, 13, 'cancelled', 'Заболела'],
    [22, 17, 'cancelled', 'Не подтвердила запись'],
    [33, 22, 'no_show', 'Не пришла без предупреждения'],
    [27, 26, 'cancelled', 'Передумала'],
  ].forEach(([ci, ago, status, reason]) => {
    const c = clients[ci];
    const svcIds = [...c.favs];
    appointments.push({
      id: 'a' + apptId++, clientId: c.id, serviceIds: svcIds,
      price: svcIds.reduce((s, sid) => s + SVC[sid].price, 0),
      date: iso(day(-ago)), time: pick(SLOT_TIMES), status, reason,
    });
  });

  // Завтра: записи, требующие подтверждения
  const tIso = iso(day(1));
  [[4, '12:00'], [17, '14:00'], [24, '16:00']].forEach(([ci, time]) => {
    const c = clients[ci];
    if (appointments.some((a) => a.clientId === c.id && a.date === tIso)) return;
    const svcIds = [c.favs[0]];
    takenSlots[tIso + ' ' + time] = true;
    appointments.push({
      id: 'a' + apptId++, clientId: c.id, serviceIds: svcIds,
      price: svcIds.reduce((s, sid) => s + SVC[sid].price, 0),
      date: tIso, time, status: 'pending', reason: null,
    });
  });

  window.VELOUR_DATA = {
    master: MASTER,
    services: SERVICES,
    cancelReasons: CANCEL_REASONS,
    clients,
    appointments,
    todayIso,
  };
})();
