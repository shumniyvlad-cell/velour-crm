/* ВЕЛЮР — логика приложения (v2: салон при отеле).
   Данные: seed из data.js + пользовательские изменения в localStorage.
   Ничего не уходит наружу: все «отправки» — копирование текста в буфер. */

(function () {
  'use strict';

  const D = window.VELOUR_DATA;
  const LS_KEY = 'velour_state_v2';
  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ==================== Состояние ====================
  let saved;
  try { saved = JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch (e) { saved = {}; }
  saved = Object.assign({ addedClients: [], addedAppointments: [], statusOverrides: {}, sentFollowups: {}, notes: {}, flags: {} }, saved);
  const persist = () => localStorage.setItem(LS_KEY, JSON.stringify(saved));

  const clients = () => [...D.clients, ...saved.addedClients].map((c) => {
    const fl = saved.flags[c.id];
    return fl ? Object.assign({}, c, fl) : c;
  });
  // Ключ оверлея — id+дата: сид пересобирается относительно «сегодня», и без даты
  // вчерашняя отметка навсегда прилипала бы к перегенерированной записи с тем же id.
  const apptKey = (a) => a.id + '|' + a.date;
  const appointments = () => [...D.appointments, ...saved.addedAppointments].map((a) => {
    const ov = saved.statusOverrides[apptKey(a)];
    return ov ? Object.assign({}, a, ov) : a;
  });

  const SVC = Object.fromEntries(D.services.map((s) => [s.id, s]));
  const MB = Object.fromEntries(D.masters.map((m) => [m.id, m]));
  const clientById = (id) => clients().find((c) => c.id === id);
  const NAIL_SVC = ['man', 'ped', 'ukr'];
  const homeMasterId = (svcId) => (NAIL_SVC.includes(svcId) ? 'alina' : 'dina');
  const masterOfClient = (c) => MB[homeMasterId(c.favs[0])];

  // ==================== Даты и форматы ====================
  const TODAY = new Date(D.todayIso + 'T00:00:00');
  const MS_DAY = 86400000;
  const iso = (d) => {
    const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  };
  const dayOffset = (n) => { const d = new Date(TODAY); d.setDate(d.getDate() + n); return d; };
  const parseIso = (s) => new Date(s + 'T00:00:00');
  const daysFromToday = (s) => Math.round((parseIso(s) - TODAY) / MS_DAY);

  const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  const WEEKDAYS = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
  const DOW_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

  const nf = new Intl.NumberFormat('ru-RU');
  const money = (n) => nf.format(Math.round(n)) + ' ₽';
  const dateHuman = (s) => { const d = parseIso(s); return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`; };
  const dateRel = (s) => {
    const n = daysFromToday(s);
    if (n === 0) return 'сегодня';
    if (n === 1) return 'завтра';
    if (n === -1) return 'вчера';
    return dateHuman(s);
  };
  const cap = (s) => s[0].toUpperCase() + s.slice(1);
  const plural = (n, one, few, many) => {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
  };
  const firstName = (name) => name.split(' ')[0];
  const initials = (name) => name.split(' ').map((w) => w[0]).slice(0, 2).join('');
  const avaClass = (id) => 'a' + (Array.from(id).reduce((s, ch) => s + ch.charCodeAt(0), 0) % 6);
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  // ==================== Иконки (тонкая линия, 1.5) ====================
  const I = (paths) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
  const ICONS = {
    plus: I('<path d="M12 5v14M5 12h14"/>'),
    search: I('<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.4-4.4"/>'),
    close: I('<path d="M6 6l12 12M18 6 6 18"/>'),
    check: I('<path d="m4.5 12.5 5 5L19.5 7"/>'),
    copy: I('<rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M5 15V6.5A2.5 2.5 0 0 1 7.5 4H15"/>'),
    arrow: I('<path d="M7 17 17 7M9 7h8v8"/>'),
    up: I('<path d="M12 19V5M6 11l6-6 6 6"/>'),
    down: I('<path d="M12 5v14M6 13l6 6 6-6"/>'),
    spark: I('<path d="M12 3.5c.6 4.4 2.2 6 6.5 6.5-4.3.6-5.9 2.2-6.5 6.5-.6-4.3-2.2-5.9-6.5-6.5 4.3-.5 5.9-2.1 6.5-6.5z"/><path d="M19 14.5c.3 2 1 2.8 3 3-2 .3-2.7 1-3 3-.3-2-1-2.7-3-3 2-.2 2.7-1 3-3z"/>'),
    gift: I('<rect x="4" y="10.5" width="16" height="10" rx="1.5"/><path d="M4 10.5h16v-3H4zM12 7.5v13M12 7.5c-2.5 0-4.5-1-4.5-2.7C7.5 3.6 8.6 3 9.7 3c1.5 0 2.3 1.7 2.3 4.5zM12 7.5c2.5 0 4.5-1 4.5-2.7 0-1.2-1.1-1.8-2.2-1.8-1.5 0-2.3 1.7-2.3 4.5z"/>'),
    send: I('<path d="M20.5 3.5 10 14M20.5 3.5l-6.8 17-3.7-6.5-6.5-3.7z"/>'),
    wallet: I('<rect x="3" y="6" width="18" height="14" rx="2.5"/><path d="M3 10h18M16.5 14.5h1"/>'),
    trendDown: I('<path d="m3 7 6.5 6.5 4-4L21 17"/><path d="M21 11v6h-6"/>'),
    refresh: I('<path d="M20 11a8 8 0 0 0-14.9-3M4 13a8 8 0 0 0 14.9 3"/><path d="M20 4v4h-4M4 20v-4h4"/>'),
    userX: I('<circle cx="10" cy="8" r="3.5"/><path d="M3.8 19.5c.8-3 3.2-4.7 6.2-4.7 1.2 0 2.3.3 3.2.8"/><path d="m16.5 15.5 4 4M20.5 15.5l-4 4"/>'),
    chevL: I('<path d="m15 6-6 6 6 6"/>'),
    chevR: I('<path d="m9 6 6 6-6 6"/>'),
    plane: I('<path d="M10.5 13.5 3 11l1.5-1.5L9 10l4.5-4.5L6 3.7 7.7 2l9.3 2.5 3-3L21.5 3l-3 3L21 15.3l-1.7 1.7-1.8-7.5L13 14l.5 4.5L12 20z" transform="rotate(45 12 12)"/>'),
    cake: I('<path d="M4.5 20.5h15M5.5 20.5v-7a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v7"/><path d="M5.5 15.5c1.2 1 2.4 1 3.6 0s2.4-1 3.6 0 2.4 1 3.6 0M12 8.5v3M12 5.7a1.2 1.2 0 0 0 1.2-1.2C13.2 3.5 12 2.5 12 2.5s-1.2 1-1.2 2a1.2 1.2 0 0 0 1.2 1.2z"/>'),
  };

  // ==================== Метрики клиентки ====================
  function clientStats(c) {
    const apps = appointments().filter((a) => a.clientId === c.id);
    const done = apps.filter((a) => a.status === 'done' && daysFromToday(a.date) <= 0)
      .sort((a, b) => a.date.localeCompare(b.date));
    const future = apps.filter((a) => daysFromToday(a.date) >= 0 && (a.status === 'pending' || a.status === 'confirmed'))
      .sort((a, b) => a.date.localeCompare(b.date));
    const ltv = done.reduce((s, a) => s + a.price, 0);
    const lastVisit = done.length ? done[done.length - 1].date : null;
    const daysSince = lastVisit ? -daysFromToday(lastVisit) : null;

    // Уровень лояльности: Silver → Gold → VIP
    const tier = done.length >= 10 || ltv >= 35000 ? 'VIP' : done.length >= 5 ? 'Gold' : 'Silver';
    const rate = tier === 'VIP' ? 15 : tier === 'Gold' ? 10 : 5;
    const points = Math.round(ltv * rate / 100);

    // Сегмент: гостья отеля перекрывает остальные — она не «спящая», она уехала домой
    const joinedDays = -daysFromToday(c.joined);
    let segment = 'regular';
    if (c.tourist) segment = 'tourist';
    else {
      if (done.length >= 10 || ltv >= 35000) segment = 'vip';
      else if (done.length <= 2 && joinedDays <= 60) segment = 'new';
      if (daysSince !== null && daysSince > 60 && future.length === 0) segment = 'sleeping';
      else if (segment !== 'vip' && daysSince !== null && daysSince > c.interval * 1.35 && future.length === 0 && daysSince <= 60) segment = 'risk';
      else if (segment === 'vip' && daysSince !== null && daysSince > 60 && future.length === 0) segment = 'sleeping';
    }

    return {
      visits: done.length, ltv,
      avgCheck: done.length ? Math.round(ltv / done.length) : 0,
      lastVisit, daysSince, future, done,
      segment, tier, rate, points,
      noShows: apps.filter((a) => a.status === 'no_show').length,
    };
  }

  const SEGMENT_LABEL = { vip: 'VIP', new: 'Новая', regular: 'Постоянная', sleeping: 'Спящая', risk: 'В зоне риска', tourist: 'Гостья' };

  function triedService(c, ids) {
    return appointments().some((a) => a.clientId === c.id && a.status === 'done' && a.serviceIds.some((s) => ids.includes(s)));
  }

  // ==================== Рекомендации «что предложить» ====================
  function recommendations(c, st) {
    const out = [];
    if (triedService(c, ['man']) && !triedService(c, ['ped']))
      out.push({
        t: 'Комбо: маникюр + педикюр',
        w: `Ходит на маникюр примерно раз в ${c.interval} ${plural(c.interval, 'день', 'дня', 'дней')}, педикюр не пробовала. Комбо-визит почти удваивает чек.`,
        offer: 'В следующий визит можно сделать маникюр и педикюр за одно посещение — выйдет быстрее, а на комбо дам −10%. Забронировать двойной слот?',
      });
    if (triedService(c, ['bro']) && !triedService(c, ['lam']))
      out.push({
        t: 'Ламинирование бровей',
        w: 'Коррекцию делает регулярно — ламинирование держится дольше и стоит дороже обычного окрашивания.',
        offer: 'Вы регулярно делаете коррекцию бровей — попробуйте ламинирование: эффект держится до шести недель. В этом месяце для вас −15%.',
      });
    if (!triedService(c, ['bro', 'lam']) && triedService(c, ['man']))
      out.push({
        t: 'Брови в следующий визит',
        w: 'Ногти доверяет вам — брови, скорее всего, делает в другом месте. Предложите за один визит.',
        offer: 'Вы у нас на ногтях — загляните и на брови: коррекция займёт всего 20 минут до или после маникюра. Добавить к следующей записи?',
      });
    if (st.visits >= 8 && !triedService(c, ['res']))
      out.push({
        t: 'Ламинирование ресниц −15%',
        w: 'Лояльная клиентка: новую услугу проще продать с бонусом уровня.',
        offer: 'Для постоянных клиенток у нас −15% на ламинирование ресниц — хотите попробовать в следующий визит?',
      });
    if (st.points >= 1200)
      out.push({
        t: `Напомнить про ${nf.format(st.points)} ${plural(st.points, 'балл', 'балла', 'баллов')}`,
        w: 'Списание на укрепление ногтей ощущается как подарок и закрепляет привычку.',
        offer: `У вас накопилось ${nf.format(st.points)} ${plural(st.points, 'балл', 'балла', 'баллов')} — можно списать на укрепление ногтей в следующий визит. Напомнить при записи?`,
      });
    if (st.tier === 'VIP' && st.future.length === 0)
      out.push({
        t: 'Забронировать любимый слот',
        w: 'VIP без следующей записи — предложите её постоянное время заранее, до того как разберут.',
        offer: 'Ваше любимое время скоро разберут — забронировать за вами слот на следующую неделю?',
      });
    return out.slice(0, 3);
  }

  // ==================== Аналитика ====================
  const doneIn = (from, to) => appointments().filter((a) => a.status === 'done' && a.date >= from && a.date <= to);
  const lostIn = (from, to) => appointments().filter((a) => (a.status === 'cancelled' || a.status === 'no_show') && a.date >= from && a.date <= to);

  function repeatShare(from, to) {
    const all = appointments();
    const done = all.filter((a) => a.status === 'done' && a.date >= from && a.date <= to);
    if (!done.length) return 0;
    const rep = done.filter((a) => all.some((b) => b.clientId === a.clientId && b.status === 'done' && b.date < a.date)).length;
    return Math.round(rep / done.length * 100);
  }
  function lostShare(from, to) {
    const d = doneIn(from, to).length, l = lostIn(from, to).length;
    return d + l ? Math.round(l / (d + l) * 1000) / 10 : 0;
  }

  function analytics() {
    const t0 = iso(dayOffset(-29)), t1 = iso(TODAY);
    const p0 = iso(dayOffset(-59)), p1 = iso(dayOffset(-30));

    const cur = doneIn(t0, t1), prev = doneIn(p0, p1);
    const revenue = cur.reduce((s, a) => s + a.price, 0);
    const revenuePrev = prev.reduce((s, a) => s + a.price, 0);

    const lost = lostIn(t0, t1);
    const lostSum = lost.reduce((s, a) => s + a.price, 0);
    const lostSumPrev = lostIn(p0, p1).reduce((s, a) => s + a.price, 0);
    const byReason = {};
    lost.forEach((a) => {
      const r = a.reason || 'Без причины';
      byReason[r] = byReason[r] || { n: 0, sum: 0 };
      byReason[r].n++; byReason[r].sum += a.price;
    });

    const repeat = repeatShare(t0, t1), repeatPrev = repeatShare(p0, p1);
    const noShowPct = lostShare(t0, t1), noShowPrev = lostShare(p0, p1);

    const future = appointments().filter((a) => daysFromToday(a.date) >= 0 && (a.status === 'pending' || a.status === 'confirmed'));
    const futureSum = future.reduce((s, a) => s + a.price, 0);

    // Недельные ряды для спарклайнов (8 недель)
    const weekly = (fn) => {
      const out = [];
      for (let w = 7; w >= 0; w--) out.push(fn(iso(dayOffset(-7 * w - 6)), iso(dayOffset(-7 * w))));
      return out;
    };
    const sparkRevenue = weekly((f, t) => doneIn(f, t).reduce((s, a) => s + a.price, 0));
    const sparkLost = weekly((f, t) => lostIn(f, t).reduce((s, a) => s + a.price, 0));
    const sparkRepeat = weekly(repeatShare);
    const sparkNoShow = weekly(lostShare);

    // 6 месяцев выручки
    const months = [];
    for (let k = 5; k >= 0; k--) {
      const d = new Date(TODAY.getFullYear(), TODAY.getMonth() - k, 1);
      months.push({
        label: MONTHS_SHORT[d.getMonth()],
        value: doneIn(iso(d), iso(new Date(d.getFullYear(), d.getMonth() + 1, 0))).reduce((s, a) => s + a.price, 0),
        partial: k === 0,
      });
    }

    // топ услуг за 90 дней
    const bySvc = {};
    doneIn(iso(dayOffset(-89)), t1).forEach((a) => {
      a.serviceIds.forEach((sid) => {
        bySvc[sid] = bySvc[sid] || { n: 0, sum: 0 };
        bySvc[sid].n++; bySvc[sid].sum += SVC[sid].price;
      });
    });

    return {
      revenue, revenuePrev, lost, lostSum, lostSumPrev, byReason,
      repeat, repeatPrev, noShowPct, noShowPrev,
      future, futureSum, months, bySvc,
      sparkRevenue, sparkLost, sparkRepeat, sparkNoShow,
    };
  }

  // ==================== Догоны ====================
  // Гостьям отеля — только операционные сообщения о её собственной записи.
  const MARKETING_TYPES = ['followup', 'sleeping', 'risk', 'birthday'];

  function retentionQueue() {
    const items = [];
    const push = (key, type, c, ctx, msg) => items.push({ key, type, client: c, ctx, msg, sent: !!saved.sentFollowups[key] });

    appointments().forEach((a) => {
      const c = clientById(a.clientId);
      if (!c) return;
      const fn = firstName(c.name);
      const svc = a.serviceIds.map((s) => SVC[s].short.toLowerCase()).join(' + ');
      const svcMsg = a.serviceIds.map((s) => SVC[s].msg).join(' и ');
      const master = MB[a.master] ? MB[a.master].short : 'мастер';
      const off = daysFromToday(a.date);
      const k = apptKey(a);

      if (a.status === 'pending' && off === 1)
        push('confirm|' + k, 'confirm', c, `Завтра в ${a.time} · ${svc} · ${money(a.price)}`,
          `${fn}, добрый вечер! Напоминаю: завтра, ${dateHuman(a.date)} в ${a.time}, ${master} ждёт вас на ${svcMsg}. Всё в силе? Если планы поменялись — напишите, спокойно подберём другое время.`);

      if ((a.status === 'confirmed' || a.status === 'pending') && off === 0)
        push('remind|' + k, 'remind', c, `Сегодня в ${a.time} · ${svc}`,
          `${fn}, доброе утро! Сегодня в ${a.time} ${master} ждёт вас на ${svcMsg}. Мы в салоне при отеле, если что — я на связи. До встречи!`);

      if (a.status === 'done' && off === -1 && !c.tourist)
        push('followup|' + k, 'followup', c, `Была вчера · ${svc}`,
          `${fn}, здравствуйте! Как вам результат? Если всё нравится — буду очень благодарна за отзыв, это помогает нам больше, чем любая реклама. И напишите, если что-то захочется поправить — сделаем бесплатно.`);

      if (a.status === 'no_show' && off >= -3 && off <= 0) {
        const when = off === 0 ? 'Сегодня' : off === -1 ? 'Вчера' : cap(dateHuman(a.date));
        push('noshow|' + k, 'noshow', c, `Не пришла ${dateRel(a.date)} · ${svc}`,
          `${fn}, добрый день! ${when} у нас не получилось встретиться — ничего страшного, бывает. Давайте подберём новое время? Напишите, когда удобно, — найду для вас окно.`);
      }
    });

    clients().forEach((c) => {
      if (c.tourist) return; // маркетинговые догоны гостьям не готовим вовсе
      const st = clientStats(c);
      const fn = firstName(c.name);
      const master = masterOfClient(c).short;

      if (st.segment === 'sleeping' && st.lastVisit) {
        const svc = SVC[c.favs[0]].msg;
        push('sleep|' + c.id, 'sleeping', c, `Не была ${st.daysSince} ${plural(st.daysSince, 'день', 'дня', 'дней')}`,
          `${fn}, здравствуйте! Это ${master} из «Велюра». Соскучилась по вам — вы не были у нас с ${dateHuman(st.lastVisit)}. Возвращайтесь: на ближайший визит дам −15% на ${svc}. Подобрать вам время на этой неделе?`);
      }

      if (st.segment === 'risk' && st.lastVisit) {
        const svc = SVC[c.favs[0]].msg;
        push('risk|' + c.id, 'risk', c, `Цикл ${c.interval} дн., прошло ${st.daysSince}`,
          `${fn}, привет! По моим записям с вашего последнего визита прошло уже ${st.daysSince} ${plural(st.daysSince, 'день', 'дня', 'дней')} — обычно к этому времени вы обновляете ${svc}. Записать вас на удобное время?`);
      }

      if (c.birthday) {
        const [m, d] = c.birthday.split('-').map(Number);
        let bd = new Date(TODAY.getFullYear(), m - 1, d);
        if (bd < TODAY) bd = new Date(TODAY.getFullYear() + 1, m - 1, d);
        const inDays = Math.round((bd - TODAY) / MS_DAY);
        if (inDays >= 0 && inDays <= 7) {
          const msg = inDays === 0
            ? `${fn}, с днём рождения вас! Пусть всё складывается легко и красиво. Наш подарок — укрепление ногтей к любой услуге весь этот месяц. Забронировать вам праздничный слот?`
            : `${fn}, с наступающим вас! В честь дня рождения весь месяц действует ваш личный подарок — укрепление ногтей к любой услуге. Забронировать вам праздничный слот?`;
          push('bday|' + c.id + '|' + iso(bd), 'birthday', c, inDays === 0 ? 'День рождения сегодня' : `День рождения ${dateHuman(iso(bd))}`, msg);
        }
      }
    });

    const ORDER = ['remind', 'confirm', 'followup', 'noshow', 'birthday', 'risk', 'sleeping'];
    // Один «возвратный» догон на клиентку: неявка важнее просроченного цикла, тот — важнее спящей
    const RETURN_TYPES = ['noshow', 'risk', 'sleeping'];
    const byClient = {};
    const deduped = [];
    items.forEach((it) => {
      if (!RETURN_TYPES.includes(it.type)) { deduped.push(it); return; }
      const prev = byClient[it.client.id];
      if (!prev) { byClient[it.client.id] = it; deduped.push(it); return; }
      if (ORDER.indexOf(it.type) < ORDER.indexOf(prev.type)) {
        deduped[deduped.indexOf(prev)] = it;
        byClient[it.client.id] = it;
      }
    });
    deduped.sort((a, b) => ORDER.indexOf(a.type) - ORDER.indexOf(b.type));
    return deduped;
  }

  const RET_META = {
    remind: { title: 'Напомнить о сегодняшних', why: 'визит сегодня — напоминание утром снижает неявки вдвое' },
    confirm: { title: 'Подтвердить завтрашние', why: 'запись завтра ещё не подтверждена' },
    followup: { title: 'После визита', why: 'были вчера — спросить впечатления и попросить отзыв' },
    noshow: { title: 'Вернуть после неявки', why: 'не пришли за последние 3 дня — мягко вернуть без упрёка' },
    birthday: { title: 'Дни рождения', why: 'ближайшие 7 дней — повод написать с подарком' },
    risk: { title: 'Просрочен цикл визита', why: 'обычный интервал превышен, записи нет — догнать до ухода в другой салон' },
    sleeping: { title: 'Разбудить спящих', why: 'не были 60+ дней — вернуть офером' },
  };

  const retMsgByKey = (key) => retentionQueue().find((x) => x.key === key);

  // ==================== Графики ====================
  function areaChart(points) {
    const W = 640, H = 230, PL = 46, PR = 14, PT = 16, PB = 30;
    const iw = W - PL - PR, ih = H - PT - PB;
    const max = Math.max(...points.map((p) => p.value)) * 1.15 || 1;
    const x = (i) => PL + (iw * i) / (points.length - 1);
    const y = (v) => PT + ih - (ih * v) / max;

    let path = '';
    points.forEach((p, i) => {
      path += (i ? ' L' : 'M') + x(i).toFixed(1) + ' ' + y(p.value).toFixed(1);
    });
    const area = path + ` L${(PL + iw).toFixed(1)} ${PT + ih} L${PL} ${PT + ih} Z`;

    // Текущий месяц ещё идёт — его сегмент пунктиром, чтобы «спад» не читался как факт
    const lastPartial = points[points.length - 1].partial;
    const n = points.length - 1;
    const solidPath = lastPartial
      ? points.slice(0, n).map((p, i) => (i ? ' L' : 'M') + x(i).toFixed(1) + ' ' + y(p.value).toFixed(1)).join('')
      : path;
    const dashPath = lastPartial
      ? `M${x(n - 1).toFixed(1)} ${y(points[n - 1].value).toFixed(1)} L${x(n).toFixed(1)} ${y(points[n].value).toFixed(1)}`
      : '';

    const gridLines = [0.25, 0.5, 0.75, 1].map((f) => {
      const gy = y(max * f);
      return `<line class="grid-line" x1="${PL}" y1="${gy}" x2="${W - PR}" y2="${gy}"/>
        <text class="axis-label" x="${PL - 8}" y="${gy + 3.5}" text-anchor="end">${Math.round(max * f / 1000)}к</text>`;
    }).join('');
    const labels = points.map((p, i) =>
      `<text class="axis-label" x="${x(i)}" y="${H - 8}" text-anchor="middle">${p.label}</text>`).join('');
    const dots = points.map((p, i) =>
      `<circle class="pt" data-i="${i}" cx="${x(i)}" cy="${y(p.value)}" r="3.5" fill="var(--canvas)" stroke="var(--accent)" stroke-width="2" opacity="${i === points.length - 1 ? 1 : 0}"/>`).join('');

    return {
      html: `<div class="chart-box chart-draw" id="rev-chart">
        <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Выручка за 6 месяцев">
          <defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#C9566B" stop-opacity="0.2"/>
            <stop offset="1" stop-color="#C9566B" stop-opacity="0"/>
          </linearGradient></defs>
          ${gridLines}
          <path d="${area}" fill="url(#ag)"/>
          <path class="line-main" d="${solidPath}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round"/>
          ${dashPath ? `<path d="${dashPath}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-dasharray="5 6" opacity="0.75"/>` : ''}
          <line id="rev-guide" x1="0" y1="${PT}" x2="0" y2="${PT + ih}" stroke="var(--ink-3)" stroke-width="1" stroke-dasharray="3 3" opacity="0"/>
          ${dots}${labels}
          <rect id="rev-hover" x="${PL}" y="${PT}" width="${iw}" height="${ih}" fill="transparent"/>
        </svg>
        <div class="chart-tip" id="rev-tip"></div>
      </div>`,
      bind() {
        const box = document.getElementById('rev-chart');
        if (!box) return;
        const svg = box.querySelector('svg');
        const tip = document.getElementById('rev-tip');
        const guide = document.getElementById('rev-guide');
        const dotEls = box.querySelectorAll('.pt');
        const line = box.querySelector('.line-main');
        if (line) { const len = line.getTotalLength(); line.style.setProperty('--len', len); }
        const move = (ev) => {
          const r = svg.getBoundingClientRect();
          const mx = ((ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left) * (W / r.width);
          let best = 0, bd = 1e9;
          points.forEach((p, i) => { const d = Math.abs(x(i) - mx); if (d < bd) { bd = d; best = i; } });
          const p = points[best];
          guide.setAttribute('x1', x(best)); guide.setAttribute('x2', x(best));
          guide.setAttribute('opacity', '1');
          dotEls.forEach((d, i) => d.setAttribute('opacity', i === best ? 1 : 0));
          tip.innerHTML = `<b>${money(p.value)}</b><br><span class="tip-sub">${p.label}${p.partial ? ' · идёт сейчас' : ''}</span>`;
          tip.style.left = (x(best) / W * 100) + '%';
          tip.style.top = (y(p.value) / H * 100) + '%';
          tip.style.opacity = 1;
        };
        const leave = () => {
          tip.style.opacity = 0; guide.setAttribute('opacity', '0');
          dotEls.forEach((d, i) => d.setAttribute('opacity', i === points.length - 1 ? 1 : 0));
        };
        svg.addEventListener('mousemove', move);
        svg.addEventListener('touchstart', move, { passive: true });
        svg.addEventListener('mouseleave', leave);
      },
    };
  }

  function sparkline(values, color) {
    const W = 140, H = 34, P = 2;
    const max = Math.max(...values), min = Math.min(...values);
    const x = (i) => P + (W - 2 * P) * i / (values.length - 1);
    const y = (v) => H - P - (H - 2 * P) * ((v - min) / ((max - min) || 1));
    const pts = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
    return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
      <polygon points="${P},${H - P} ${pts} ${W - P},${H - P}" fill="${color}" opacity="0.1"/>
      <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" opacity="0.75"/>
    </svg>`;
  }

  function donut(rows, centerTop, centerSub) {
    const total = rows.reduce((s, r) => s + r.value, 0) || 1;
    const R = 54, C = 2 * Math.PI * R;
    let acc = 0;
    const segs = rows.map((r, i) => {
      const frac = r.value / total;
      const len = Math.max(frac * C - 2.5, 0.6);
      const off = C / 4 - acc * C;
      acc += frac;
      return `<circle class="donut-seg" r="${R}" cx="75" cy="75" fill="none" stroke="${r.color}" stroke-width="17"
        stroke-dasharray="${len.toFixed(1)} ${(C - len).toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"
        style="animation-delay:${150 + i * 80}ms"><title>${esc(r.label)}: ${esc(r.fmt)}</title></circle>`;
    }).join('');
    return `<div class="donut-wrap">
      <svg width="150" height="150" viewBox="0 0 150 150" role="img" aria-label="${esc(centerSub)}">
        ${segs}
        <text x="75" y="73" text-anchor="middle" class="donut-center-val">${esc(centerTop)}</text>
        <text x="75" y="89" text-anchor="middle" class="donut-center-sub">${esc(centerSub)}</text>
      </svg>
      <div class="legend">
        ${rows.map((r) => `<div class="lg-row"><i style="background:${r.color}"></i>
          <span class="lg-label" title="${esc(r.label)}">${esc(r.label)}</span>
          <span class="lg-val">${esc(r.fmt)}</span></div>`).join('')}
      </div>
    </div>`;
  }

  // Горизонтальные бары: одна мера → один цвет; идентичность — подписью
  function hbars(rows, { color = 'var(--accent)', unit = '', anim = true } = {}) {
    const max = Math.max(...rows.map((r) => r.value)) || 1;
    return rows.map((r, i) => `
      <div class="hb-row">
        <div class="hb-label" title="${esc(r.label)}">${esc(r.label)}</div>
        <div class="hb-track">
          <div class="hb-fill ${anim && !REDUCED ? 'bar-anim' : ''}" style="width:${(r.value / max * 100).toFixed(1)}%;background:${r.color || color};animation-delay:${120 + i * 70}ms;"></div>
        </div>
        <div class="hb-val">${r.fmt || (nf.format(r.value) + unit)}</div>
      </div>`).join('');
  }

  // ==================== Рендер ====================
  const view = () => document.getElementById('view');

  function revealAll() {
    const els = view().querySelectorAll('.reveal');
    els.forEach((el, i) => el.style.setProperty('--d', Math.min(i * 55, 440) + 'ms'));
    requestAnimationFrame(() => requestAnimationFrame(() => els.forEach((el) => el.classList.add('in'))));
  }

  function countUp(el) {
    const target = +el.dataset.val;
    const suffix = el.dataset.suffix || '';
    const frac = el.dataset.frac === '1';
    const fmt = (v) => (frac ? (Math.round(v * 10) / 10).toLocaleString('ru-RU') : nf.format(Math.round(v))) + suffix;
    if (REDUCED) { el.textContent = fmt(target); return; }
    const t0 = performance.now(), dur = 750;
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(target * e);
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  function statCard(cls, label, valueHtml, footHtml, icon, sparkHtml) {
    return `<div class="card stat ${cls} reveal">
      ${icon ? `<span class="stat-ico">${icon}</span>` : ''}
      <div class="stat-label">${label}</div>
      <div class="stat-value">${valueHtml}</div>
      <div class="stat-foot">${footHtml}</div>
      ${sparkHtml ? `<div class="spark">${sparkHtml}</div>` : ''}
    </div>`;
  }

  function deltaChip(cur, prev) {
    if (!prev) return '';
    const d = Math.round((cur - prev) / prev * 100);
    if (!isFinite(d) || d === 0) return '';
    const up = d > 0;
    return `<span class="delta ${up ? 'up' : 'down'}">${up ? ICONS.up : ICONS.down}${Math.abs(d)}%</span>`;
  }
  function ppChip(cur, prev, goodWhenUp) {
    const d = Math.round((cur - prev) * 10) / 10;
    if (!d) return '';
    const up = d > 0;
    const good = goodWhenUp ? up : !up;
    return `<span class="delta ${good ? 'up' : 'down'}">${up ? ICONS.up : ICONS.down}${Math.abs(d)} п.п.</span>`;
  }

  function birthdaysSoon() {
    return clients().filter((c) => {
      if (!c.birthday || c.tourist) return false;
      const [m, d] = c.birthday.split('-').map(Number);
      let bd = new Date(TODAY.getFullYear(), m - 1, d);
      if (bd < TODAY) bd = new Date(TODAY.getFullYear() + 1, m - 1, d);
      const inDays = Math.round((bd - TODAY) / MS_DAY);
      return inDays >= 0 && inDays <= 7;
    });
  }

  // ---------- Дашборд ----------
  function renderDashboard() {
    const a = analytics();
    const q = retentionQueue().filter((it) => !it.sent);
    const todayApps = appointments().filter((x) => x.date === D.todayIso && x.status !== 'cancelled')
      .sort((x, y) => x.time.localeCompare(y.time));
    const todaySum = todayApps.filter((x) => x.status !== 'no_show').reduce((s, x) => s + x.price, 0);
    const hour = new Date().getHours();
    const hello = hour < 5 ? 'Доброй ночи' : hour < 12 ? 'Доброе утро' : hour < 18 ? 'Добрый день' : 'Добрый вечер';

    const CAT = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)'];
    const reasons = Object.entries(a.byReason).sort((x, y) => y[1].sum - x[1].sum)
      .map(([label, v], i) => ({ label, value: v.sum, fmt: `${money(v.sum)} · ${v.n}`, color: CAT[i % 5] }));

    const upcoming = appointments()
      .filter((x) => daysFromToday(x.date) >= 0 && (x.status === 'pending' || x.status === 'confirmed'))
      .sort((x, y) => (x.date + x.time).localeCompare(y.date + y.time))
      .slice(0, 6);

    const tiers = { Silver: 0, Gold: 0, VIP: 0 };
    clients().forEach((c) => tiers[clientStats(c).tier]++);
    const bdays = birthdaysSoon();

    const chart = areaChart(a.months);

    view().innerHTML = `
      <div class="page-head reveal">
        <div>
          <div class="page-kicker">${WEEKDAYS[TODAY.getDay()]}, ${dateHuman(D.todayIso)}</div>
          <h1 class="page-title">${hello}!</h1>
          <p class="page-sub">Сегодня ${todayApps.length} ${plural(todayApps.length, 'запись', 'записи', 'записей')} на ${money(todaySum)}${q.length ? ` · ${q.length} ${plural(q.length, 'догон ждёт', 'догона ждут', 'догонов ждут')} отправки` : ''}.</p>
        </div>
        <div class="head-actions">
          <button class="btn btn-primary" data-act="new-appt">Новая запись <span class="btn-orb">${ICONS.arrow}</span></button>
        </div>
      </div>

      <div class="grid-stats">
        ${statCard('money', 'Выручка · 30 дней', `<span class="count-up" data-val="${a.revenue}"></span> <small>₽</small>`,
    `${deltaChip(a.revenue, a.revenuePrev)} к прошлым 30 дням`, ICONS.wallet, sparkline(a.sparkRevenue, '#1B8A5A'))}
        ${statCard('loss', 'Потери · 30 дней', `<span class="count-up" data-val="${a.lostSum}"></span> <small>₽</small>`,
    `${a.lost.length} ${plural(a.lost.length, 'отмена или неявка', 'отмены и неявки', 'отмен и неявок')}`, ICONS.trendDown, sparkline(a.sparkLost, '#B23330'))}
        ${statCard('', 'Повторные записи', `<span class="count-up" data-val="${a.repeat}" data-suffix="%"></span>`,
    `${ppChip(a.repeat, a.repeatPrev, true)} доля визитов от вернувшихся`, ICONS.refresh, sparkline(a.sparkRepeat, '#B5485C'))}
        ${statCard('', 'Не дошли на процедуру', `<span class="count-up" data-val="${a.noShowPct}" data-suffix="%" data-frac="1"></span>`,
    `${ppChip(a.noShowPct, a.noShowPrev, false)} от всех записей за 30 дней`, ICONS.userX, sparkline(a.sparkNoShow, '#A8791A'))}
      </div>

      <div class="grid-2">
        <div class="card reveal">
          <div class="card-head"><div><div class="card-title">Динамика выручки</div><div class="card-hint">завершённые визиты · наведите на график</div></div></div>
          ${chart.html}
        </div>
        <div class="card reveal">
          <div class="card-head"><div><div class="card-title">Почему клиентки не доходят</div><div class="card-hint">отмены и неявки · 30 дней · в деньгах</div></div></div>
          ${reasons.length ? donut(reasons, String(a.lost.length), plural(a.lost.length, 'случай', 'случая', 'случаев')) : '<div class="empty"><span class="empty-orn">◦</span>Потерь нет — так держать</div>'}
          <p style="font-size:12px;color:var(--ink-3);margin-top:12px;">Возвращайте эти деньги на вкладке «Догоны» — тексты уже готовы.</p>
        </div>
      </div>

      <div class="grid-2b">
        <div class="card reveal">
          <div class="card-head">
            <div><div class="card-title">Предстоящие записи</div><div class="card-hint">ближайшие визиты · ${a.future.length} в записи на ${money(a.futureSum)}</div></div>
            <a class="btn btn-ghost btn-sm" href="#/calendar">Календарь</a>
          </div>
          ${upcoming.map((x) => {
      const c = clientById(x.clientId);
      return `<div class="up-row">
              <span class="up-t">${dateRel(x.date)}, ${x.time}</span>
              <span class="ava sm ${avaClass(c.id)}" data-open-client="${c.id}" style="cursor:pointer;">${initials(c.name)}</span>
              <div class="up-main"><b data-open-client="${c.id}" tabindex="0" role="button" style="cursor:pointer;">${esc(c.name)}</b>
              <span class="up-svc">${x.serviceIds.map((s) => SVC[s].short).join(' + ')} · ${MB[x.master] ? MB[x.master].short : ''}</span></div>
              <span class="status ${x.status}">${STATUS_LABEL[x.status]}</span>
            </div>`;
    }).join('') || '<div class="empty"><span class="empty-orn">◦</span>Будущих записей нет</div>'}
        </div>
        <div>
          <div class="card reveal" style="margin-bottom:12px;">
            <div class="card-head">
              <div><div class="card-title">Догоны ждут <span class="live-dot" style="margin-left:2px;"></span></div><div class="card-hint">сообщения, которые вернут деньги</div></div>
              <a class="btn btn-ghost btn-sm" href="#/retention">Все догоны</a>
            </div>
            ${q.slice(0, 3).map((it) => `
              <div class="up-row">
                <span class="ava sm ${avaClass(it.client.id)}" data-open-client="${it.client.id}" style="cursor:pointer;">${initials(it.client.name)}</span>
                <div class="up-main"><b data-open-client="${it.client.id}" tabindex="0" role="button" style="cursor:pointer;">${esc(it.client.name)}</b>
                <span class="up-svc">${RET_META[it.type].title} · ${esc(it.ctx)}</span></div>
              </div>`).join('') || '<div class="empty">Все догоны отправлены</div>'}
          </div>
          <div class="promo reveal">
            <span class="promo-ico">${ICONS.gift}</span>
            <div style="flex:1;">
              <b>${bdays.length ? `${bdays.length} ${plural(bdays.length, 'день рождения', 'дня рождения', 'дней рождения')} на этой неделе` : 'Дни рождения — лучший повод написать'}</b>
              <p>Поздравление с подарком — самый тёплый догон: почти всегда конвертируется в запись.</p>
              <a class="btn btn-accent btn-sm" href="#/retention">Открыть поздравления</a>
            </div>
          </div>
          <div class="card reveal" style="margin-top:12px;">
            <div class="card-head">
              <div><div class="card-title">Лояльность</div><div class="card-hint">уровни базы</div></div>
              <a class="btn btn-ghost btn-sm" href="#/loyalty">Подробнее</a>
            </div>
            ${[['Silver', 'silver', 5], ['Gold', 'gold', 10], ['VIP', 'vip', 15]].map(([t, cls, cb]) => `
              <div class="up-row"><span class="tag ${cls === 'vip' ? 'vip' : cls}">${t}</span>
                <div class="up-main" style="font-size:12.5px;color:var(--ink-2);">кешбэк ${cb}%</div>
                <b class="num" style="font-size:13px;">${tiers[t]} ${plural(tiers[t], 'клиентка', 'клиентки', 'клиенток')}</b></div>`).join('')}
          </div>
        </div>
      </div>`;

    chart.bind();
    view().querySelectorAll('.count-up').forEach(countUp);
    revealAll();
  }

  // ---------- Клиентки ----------
  let clientFilter = 'all', clientSearch = '';

  function renderClients() {
    const all = clients().map((c) => ({ c, st: clientStats(c) }));
    const seg = (s) => all.filter((x) => x.st.segment === s).length;
    const chips = [
      ['all', 'Все', all.length], ['vip', 'VIP', seg('vip')], ['regular', 'Постоянные', seg('regular')],
      ['new', 'Новые', seg('new')], ['risk', 'В зоне риска', seg('risk')], ['sleeping', 'Спящие', seg('sleeping')],
      ['tourist', 'Гостьи отеля', seg('tourist')],
    ];
    let rows = all;
    if (clientFilter !== 'all') rows = rows.filter((x) => x.st.segment === clientFilter);
    if (clientSearch) {
      const qq = clientSearch.toLowerCase();
      rows = rows.filter((x) => x.c.name.toLowerCase().includes(qq) || x.c.phone.replace(/[^\d]/g, '').includes(qq.replace(/[^\d]/g, '') || '§'));
    }
    rows.sort((a, b) => b.st.ltv - a.st.ltv);

    const renderedRows = rows.map(({ c, st }) => {
      const reco = recommendations(c, st)[0];
      const services = c.favs.map((s) => SVC[s].short).join(', ');
      const lastVisit = st.lastVisit ? dateRel(st.lastVisit) : '—';
      const nextVisit = st.future.length ? `${dateRel(st.future[0].date)}, ${st.future[0].time}` : '—';

      return {
        desktop: `<tr data-client-row="${c.id}" tabindex="0" aria-label="Открыть карточку ${esc(c.name)}">
          <td><div class="cell-name"><span class="ava ${avaClass(c.id)}">${initials(c.name)}</span>
            <span>${esc(c.name)}<span class="sub">${esc(c.phone)}</span></span></div></td>
          <td><span class="tag ${st.segment}">${SEGMENT_LABEL[st.segment]}</span></td>
          <td class="client-services">${services}</td>
          <td class="num">${st.visits}</td>
          <td class="num client-ltv">${money(st.ltv)}</td>
          <td>${lastVisit}</td>
          <td>${st.future.length ? nextVisit : '<span class="muted-dash">—</span>'}</td>
          <td>${reco ? `<button class="btn btn-ghost btn-sm" data-act="copy-offer" data-client="${c.id}" title="${esc(reco.t)}">${esc(reco.t.length > 26 ? reco.t.slice(0, 25) + '…' : reco.t)}</button>` : '<span class="muted-dash">—</span>'}</td>
        </tr>`,
        mobile: `<button class="client-mobile-row" type="button" data-client-row="${c.id}" aria-label="Открыть карточку ${esc(c.name)}">
          <span class="client-mobile-top">
            <span class="cell-name"><span class="ava ${avaClass(c.id)}">${initials(c.name)}</span>
              <span>${esc(c.name)}<span class="sub">${esc(c.phone)}</span></span></span>
            <span class="client-mobile-side"><span class="tag ${st.segment}">${SEGMENT_LABEL[st.segment]}</span>${ICONS.chevR}</span>
          </span>
          <span class="client-mobile-metrics">
            <span><small>Последний визит</small><b>${lastVisit}</b></span>
            <span><small>Следующая запись</small><b>${nextVisit}</b></span>
            <span><small>LTV</small><b class="num">${money(st.ltv)}</b></span>
          </span>
          <span class="client-mobile-service"><span>${services}</span>${reco ? `<em>${esc(reco.t)}</em>` : ''}</span>
        </button>`,
      };
    });

    view().innerHTML = `
      <div class="page-head reveal">
        <div>
          <div class="page-kicker">база · ${all.length} ${plural(all.length, 'клиентка', 'клиентки', 'клиенток')}</div>
          <h1 class="page-title">Клиентки</h1>
        </div>
        <div class="head-actions">
          <label class="searchbox">${ICONS.search}<input id="cl-search" type="text" placeholder="Имя или телефон" value="${esc(clientSearch)}"></label>
          <button class="btn btn-primary" data-act="new-client">Добавить <span class="btn-orb">${ICONS.plus}</span></button>
        </div>
      </div>
      <div class="chips client-filters reveal">
        ${chips.map(([k, l, n]) => `<button class="chip ${clientFilter === k ? 'active' : ''}" data-seg="${k}">${l}<b>${n}</b></button>`).join('')}
      </div>
      <div class="card clients-shell reveal">
        <div class="table-wrap clients-desktop">
        <table class="clients">
          <thead><tr><th>Клиентка</th><th>Сегмент</th><th>Любимое</th><th>Визитов</th><th>LTV</th><th>Последний визит</th><th>Следующая запись</th><th>Предложить</th></tr></thead>
          <tbody>
            ${renderedRows.map((row) => row.desktop).join('')}
          </tbody>
        </table>
        </div>
        <div class="clients-mobile">${renderedRows.map((row) => row.mobile).join('')}</div>
        ${rows.length ? '' : '<div class="empty"><span class="empty-orn">◦</span>Никого не нашлось</div>'}
      </div>`;

    view().querySelectorAll('[data-seg]').forEach((b) => b.addEventListener('click', () => { clientFilter = b.dataset.seg; renderClients(); }));
    const si = document.getElementById('cl-search');
    si.addEventListener('input', () => {
      clientSearch = si.value;
      const pos = si.selectionStart;
      renderClients();
      const ni = document.getElementById('cl-search');
      ni.focus(); ni.setSelectionRange(pos, pos);
    });
    view().querySelectorAll('[data-client-row]').forEach((row) => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('[data-act]')) return;
        openSheet(row.dataset.clientRow);
      });
      row.addEventListener('keydown', (e) => {
        if (row.tagName !== 'TR' || (e.key !== 'Enter' && e.key !== ' ')) return;
        e.preventDefault();
        openSheet(row.dataset.clientRow);
      });
    });
    revealAll();
  }

  // ---------- Панель клиентки ----------
  function openSheet(id) {
    const c = clientById(id);
    if (!c) return;
    const st = clientStats(c);
    const recos = recommendations(c, st);
    const note = saved.notes[id] !== undefined ? saved.notes[id] : c.note;
    const nextTier = st.tier === 'Silver' ? { need: 5 - st.visits, label: 'до уровня Gold' }
      : st.tier === 'Gold' ? { need: 10 - st.visits, label: 'до уровня VIP' } : null;
    const perks = st.tier === 'VIP'
      ? ['Кешбэк 15% баллами', 'Приоритетные окна записи', 'Персональные предложения', 'Подарок в день рождения']
      : st.tier === 'Gold'
        ? ['Кешбэк 10% баллами', 'Перенос записи без штрафа', 'Подарок в день рождения']
        : ['Кешбэк 5% баллами', 'Скидка 10% на первую новую услугу'];
    const history = [...st.done].reverse().slice(0, 8);

    const el = document.getElementById('sheet');
    el.innerHTML = `
      <div class="sheet-mobile-bar">
        <button class="btn-icon" data-act="close-sheet" aria-label="Назад к клиенткам">${ICONS.chevL}</button>
        <strong>Карточка клиентки</strong>
        <span aria-hidden="true"></span>
      </div>
      <button class="btn-icon sheet-close" data-act="close-sheet" aria-label="Закрыть карточку">${ICONS.close}</button>
      <div class="sheet-head" id="sheet-profile">
        <span class="ava lg ${avaClass(c.id)}">${initials(c.name)}</span>
        <div>
          <h2>${esc(c.name)}</h2>
          <p class="sheet-contacts">${esc(c.phone)} · ${esc(c.tg)}</p>
          <div class="sheet-tags">
            <span class="tag ${st.segment}">${SEGMENT_LABEL[st.segment]}</span>
            ${SEGMENT_LABEL[st.segment] !== st.tier ? `<span class="tag ${st.tier === 'Gold' ? 'gold' : st.tier === 'VIP' ? 'vip' : 'tourist'}">${st.tier}</span>` : ''}
            ${st.noShows ? `<span class="tag risk">${st.noShows} ${plural(st.noShows, 'неявка', 'неявки', 'неявок')}</span>` : ''}
          </div>
        </div>
      </div>
      <div class="sheet-actions">
        <button class="btn btn-primary btn-sm" data-act="new-appt" data-client="${c.id}">Записать <span class="btn-orb">${ICONS.arrow}</span></button>
        <button class="btn btn-ghost btn-sm" data-act="copy-hello" data-client="${c.id}">${ICONS.copy} Написать</button>
        <button class="btn btn-ghost btn-sm" data-act="toggle-tourist" data-client="${c.id}">${ICONS.plane} ${c.tourist ? 'Снять метку «гостья»' : 'Гостья отеля'}</button>
      </div>
      <div class="sheet-tabs" aria-label="Разделы карточки">
        <button class="active" type="button" data-sheet-jump="sheet-profile">Профиль</button>
        <button type="button" data-sheet-jump="client-notes">Заметки</button>
        <button type="button" data-sheet-jump="client-history">История</button>
      </div>
      ${c.tourist ? `<p style="font-size:12px;color:var(--silver);background:var(--silver-soft);border-radius:10px;padding:9px 12px;">Гостья отеля: напоминания о её записях приходят, маркетинговые догоны (возвраты, поздравления) — отключены.</p>` : ''}

      <div class="sheet-section">
        <h4>Деньги</h4>
        <div class="kv-grid">
          <div class="kv"><div class="k">LTV — принесла всего</div><div class="v">${money(st.ltv)}</div></div>
          <div class="kv"><div class="k">Средний чек</div><div class="v">${money(st.avgCheck)}</div></div>
          <div class="kv"><div class="k">Визитов</div><div class="v">${st.visits}</div></div>
          <div class="kv"><div class="k">Цикл визита</div><div class="v">~${c.interval} <small>${plural(c.interval, 'день', 'дня', 'дней')}</small></div></div>
        </div>
      </div>

      <div class="sheet-section">
        <h4>Лояльность</h4>
        <div class="loyal-box">
          <div class="lb-top"><span class="lb-tier">${st.tier}</span><span class="lb-pts">${nf.format(st.points)} ${plural(st.points, 'балл', 'балла', 'баллов')}</span></div>
          <div class="progress"><i style="--p:${nextTier ? Math.min(1, st.visits / (st.tier === 'Silver' ? 5 : 10)).toFixed(2) : 1}"></i></div>
          <div class="lb-next">${nextTier && nextTier.need > 0 ? `Ещё ${nextTier.need} ${plural(nextTier.need, 'визит', 'визита', 'визитов')} ${nextTier.label}` : 'Максимальный уровень'} · кешбэк ${st.rate}%</div>
          <ul style="list-style:none;margin-top:10px;display:flex;flex-direction:column;gap:5px;">
            ${perks.map((p) => `<li style="font-size:12px;color:var(--ink-2);display:flex;gap:8px;align-items:center;">${ICONS.check.replace('<svg', '<svg style="width:12px;height:12px;color:var(--accent);flex:0 0 auto"')}${p}</li>`).join('')}
          </ul>
        </div>
      </div>

      ${recos.length ? `<div class="sheet-section">
        <h4>Что предложить</h4>
        ${recos.map((r) => `<div class="reco">${ICONS.spark}<div><b>${esc(r.t)}</b><span>${esc(r.w)}</span></div></div>`).join('')}
      </div>` : ''}

      <div class="sheet-section" id="client-notes">
        <h4>Заметки</h4>
        <textarea class="note-area" id="note-area" placeholder="Предпочтения, аллергии, темы разговора…">${esc(note)}</textarea>
      </div>

      <div class="sheet-section" id="client-history">
        <h4>История визитов</h4>
        ${history.map((a) => `<div class="visit-item">
            <span class="vd">${dateHuman(a.date)}</span>
            <span class="vs">${a.serviceIds.map((s) => SVC[s].short).join(' + ')}</span>
            <span class="vp">${money(a.price)}</span>
          </div>`).join('') || '<div class="empty" style="padding:18px;">Ещё не было визитов</div>'}
      </div>`;

    document.getElementById('sheet-veil').classList.add('open');
    el.classList.add('open');
    document.body.classList.add('sheet-open');
    el.scrollTop = 0;
    el.querySelectorAll('[data-sheet-jump]').forEach((button) => button.addEventListener('click', () => {
      const target = el.querySelector(`#${button.dataset.sheetJump}`);
      if (!target) return;
      el.querySelectorAll('[data-sheet-jump]').forEach((item) => item.classList.toggle('active', item === button));
      target.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'start' });
    }));
    document.getElementById('note-area').addEventListener('change', (e) => {
      saved.notes[id] = e.target.value; persist(); toast('Заметка сохранена');
    });
  }

  function closeSheet() {
    document.getElementById('sheet-veil').classList.remove('open');
    document.getElementById('sheet').classList.remove('open');
    document.body.classList.remove('sheet-open');
  }

  // ---------- Календарь ----------
  let calShift = 0; // сдвиг месяца от текущего
  let selectedDay = D.todayIso;

  const STATUS_LABEL = { done: 'Была', confirmed: 'Подтверждена', pending: 'Ждёт ответа', cancelled: 'Отменена', no_show: 'Неявка' };

  function slotRow(a, { compact = false } = {}) {
    const c = clientById(a.clientId);
    const svc = a.serviceIds.map((s) => SVC[s].short).join(' + ');
    const isPast = a.status === 'done' || a.status === 'cancelled' || a.status === 'no_show';
    const k = apptKey(a);
    const actions = compact ? '' : `
      <div class="slot-actions">
        ${a.status === 'pending' ? `<button class="btn btn-ghost btn-sm" data-act="appt-confirm" data-key="${k}">Подтвердить</button>` : ''}
        ${(a.status === 'pending' || a.status === 'confirmed') && daysFromToday(a.date) <= 0 ? `<button class="btn btn-accent btn-sm" data-act="appt-done" data-key="${k}">Пришла</button>
          <button class="btn btn-ghost btn-sm" data-act="appt-noshow" data-key="${k}">Не пришла</button>` : ''}
        ${(a.status === 'pending' || a.status === 'confirmed') ? `<button class="btn-icon" data-act="appt-cancel" data-key="${k}" title="Отменить">${ICONS.close}</button>` : ''}
      </div>`;
    return `<div class="slot-row ${isPast ? 'past' : ''}">
      <span class="slot-time">${a.time}</span>
      <span class="ava ${avaClass(c.id)}" data-open-client="${c.id}" style="cursor:pointer;">${initials(c.name)}</span>
      <div class="slot-info"><b data-open-client="${c.id}" tabindex="0" role="button" style="cursor:pointer;">${esc(c.name)}</b>
        <span>${svc} · ${MB[a.master] ? MB[a.master].short : '—'}${a.reason ? ` · ${esc(a.reason)}` : ''}${c.tourist ? ' · гостья отеля' : ''}</span></div>
      <span class="slot-price">${money(a.price)}</span>
      <span class="status ${a.status}">${STATUS_LABEL[a.status]}</span>
      ${actions}
    </div>`;
  }

  function renderCalendar() {
    const base = new Date(TODAY.getFullYear(), TODAY.getMonth() + calShift, 1);
    const y = base.getFullYear(), m = base.getMonth();
    let monthTitle = new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' }).format(base).replace(' г.', '');

    // Карта записей по датам (без отменённых — они не занимают время)
    const byDate = {};
    appointments().forEach((a) => {
      if (a.status === 'cancelled') return;
      (byDate[a.date] = byDate[a.date] || []).push(a);
    });
    Object.values(byDate).forEach((list) => list.sort((a, b) => a.time.localeCompare(b.time)));

    const startDow = (new Date(y, m, 1).getDay() + 6) % 7;
    const cells = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(y, m, 1 - startDow + i);
      cells.push(d);
    }
    // если последняя неделя целиком из другого месяца — отрезаем
    const cells6 = cells.slice(35).every((d) => d.getMonth() !== m) ? cells.slice(0, 35) : cells;

    const monthApps = appointments().filter((a) => {
      const d = parseIso(a.date);
      return d.getMonth() === m && d.getFullYear() === y && (a.status === 'pending' || a.status === 'confirmed');
    });
    const monthSum = monthApps.reduce((s, a) => s + a.price, 0);

    const future = appointments().filter((a) => daysFromToday(a.date) >= 0 && (a.status === 'pending' || a.status === 'confirmed'));
    const futureSum = future.reduce((s, a) => s + a.price, 0);

    const dayApps = (byDate[selectedDay] || []).concat(
      appointments().filter((a) => a.date === selectedDay && a.status === 'cancelled')
    ).sort((a, b) => a.time.localeCompare(b.time));
    const daySum = dayApps.filter((a) => a.status !== 'cancelled' && a.status !== 'no_show').reduce((s, a) => s + a.price, 0);

    view().innerHTML = `
      <div class="page-head reveal">
        <div>
          <div class="page-kicker">${WEEKDAYS[TODAY.getDay()]}, ${dateHuman(D.todayIso)}</div>
          <h1 class="page-title">Записи</h1>
          <p class="page-sub">Всего в записи ${future.length} ${plural(future.length, 'визит', 'визита', 'визитов')} на ${money(futureSum)} · листайте календарь на месяцы вперёд.</p>
        </div>
        <div class="head-actions"><button class="btn btn-primary" data-act="new-appt" data-date="${selectedDay}">Новая запись <span class="btn-orb">${ICONS.arrow}</span></button></div>
      </div>

      <div class="card reveal" style="margin-bottom:12px;">
        <div class="cal-toolbar">
          <div class="cal-nav">
            <button class="btn-icon" data-cal-nav="-1" title="Предыдущий месяц">${ICONS.chevL}</button>
            <span class="cal-month">${monthTitle}</span>
            <button class="btn-icon" data-cal-nav="1" title="Следующий месяц">${ICONS.chevR}</button>
          </div>
          <button class="chip ${calShift === 0 ? 'active' : ''}" data-cal-today>Сегодня</button>
          <span style="font-size:12px;color:var(--ink-3);">${monthApps.length ? `в этом месяце ${monthApps.length} ${plural(monthApps.length, 'активная запись', 'активные записи', 'активных записей')} на ${money(monthSum)}` : 'в этом месяце активных записей нет'}</span>
          <div class="cal-legend"><span><i style="background:var(--accent);"></i>записи</span></div>
        </div>
        <div class="cal-grid">
          ${DOW_SHORT.map((d) => `<div class="cal-dow">${d}</div>`).join('')}
          ${cells6.map((d) => {
      const dIso = iso(d);
      const other = d.getMonth() !== m;
      const list = byDate[dIso] || [];
      const active = list.filter((a) => a.status !== 'no_show');
      const sum = active.reduce((s, a) => s + a.price, 0);
      const shown = list.slice(0, 2);
      return `<button class="cal-cell ${other ? 'other' : ''} ${dIso === D.todayIso ? 'today' : ''} ${dIso === selectedDay ? 'selected' : ''}" data-day="${dIso}">
              <span class="cal-num">${d.getDate()}</span>
              ${shown.map((a) => {
        const c = clientById(a.clientId);
        return `<span class="cal-evt"><span class="t">${a.time}</span>${esc(firstName(c.name))}</span>`;
      }).join('')}
              ${list.length > 2 ? `<span class="cal-more">+${list.length - 2} ещё</span>` : ''}
              <span class="cal-dots">${'<i></i>'.repeat(Math.min(list.length, 4))}</span>
              ${sum && !other ? `<span class="cal-sum">${nf.format(sum)} ₽</span>` : ''}
            </button>`;
    }).join('')}
        </div>
      </div>

      <div class="card reveal">
        <div class="card-head">
          <div>
            <div class="card-title">${cap(dateRel(selectedDay))} · ${WEEKDAYS[parseIso(selectedDay).getDay()]}</div>
            <div class="card-hint">${dayApps.length ? `${dayApps.length} ${plural(dayApps.length, 'запись', 'записи', 'записей')}${daySum ? ` · ${money(daySum)}` : ''}` : 'записей нет'}</div>
          </div>
          <button class="btn btn-ghost btn-sm" data-act="new-appt" data-date="${selectedDay}">${ICONS.plus} Записать на этот день</button>
        </div>
        ${dayApps.map((a) => slotRow(a)).join('') || '<div class="empty"><span class="empty-orn">◦</span>День свободен — время для догонов</div>'}
      </div>`;

    view().querySelectorAll('[data-cal-nav]').forEach((b) => b.addEventListener('click', () => {
      calShift += +b.dataset.calNav;
      renderCalendar();
    }));
    const todayBtn = view().querySelector('[data-cal-today]');
    if (todayBtn) todayBtn.addEventListener('click', () => { calShift = 0; selectedDay = D.todayIso; renderCalendar(); });
    view().querySelectorAll('[data-day]').forEach((b) => b.addEventListener('click', () => {
      selectedDay = b.dataset.day;
      const d = parseIso(selectedDay);
      calShift = (d.getFullYear() - TODAY.getFullYear()) * 12 + d.getMonth() - TODAY.getMonth();
      renderCalendar();
    }));
    revealAll();
  }

  // ---------- Догоны ----------
  function renderRetention() {
    const q = retentionQueue();
    const unsent = q.filter((x) => !x.sent);
    // Потенциал возврата — только «возвратные» поводы, по уникальным клиенткам
    const uniqReturn = new Map();
    unsent.filter((it) => ['noshow', 'risk', 'sleeping'].includes(it.type))
      .forEach((it) => {
        if (!uniqReturn.has(it.client.id)) uniqReturn.set(it.client.id, clientStats(it.client).avgCheck || 2000);
      });
    const potential = [...uniqReturn.values()].reduce((s, v) => s + v, 0);

    const groups = {};
    q.forEach((it) => { (groups[it.type] = groups[it.type] || []).push(it); });

    view().innerHTML = `
      <div class="page-head reveal">
        <div>
          <h1 class="page-title">Догоны</h1>
          <p class="page-sub">Система сама находит повод написать каждой клиентке и готовит текст. Вы просто копируете и отправляете в WhatsApp или Telegram — ничего не уходит без вашего решения. Гостьям отеля маркетинговые догоны не готовятся.</p>
        </div>
      </div>
      <div class="grid-stats grid-3">
        ${statCard('', 'Ждут отправки', `<span class="count-up" data-val="${unsent.length}"></span>`, plural(unsent.length, 'сообщение готово', 'сообщения готовы', 'сообщений готово'), ICONS.send)}
        ${statCard('money', 'Потенциал возврата', `<span class="count-up" data-val="${potential}"></span> <small>₽</small>`, 'неявки, просроченные и спящие — по их среднему чеку', ICONS.wallet)}
        ${statCard('', 'Отправлено', `<span class="count-up" data-val="${q.length - unsent.length}"></span>`, 'за всё время в демо', ICONS.check)}
      </div>
      ${Object.entries(groups).map(([type, items]) => `
        <div class="ret-group reveal">
          <div class="ret-group-head">
            <h3>${RET_META[type].title}</h3>
            <span class="cnt">${items.filter((x) => !x.sent).length}</span>
            <span class="why">${RET_META[type].why}</span>
          </div>
          <div class="ret-grid">
            ${items.map((it) => `
              <div class="card ret-card ${it.sent ? 'sent' : ''}">
                <div class="ret-who">
                  <span class="ava ${avaClass(it.client.id)}" data-open-client="${it.client.id}" style="cursor:pointer;">${initials(it.client.name)}</span>
                  <div style="flex:1;min-width:0;"><b data-open-client="${it.client.id}" tabindex="0" role="button" style="cursor:pointer;">${esc(it.client.name)}</b><span>${esc(it.ctx)}</span></div>
                </div>
                <div class="ret-msg">${esc(it.msg)}</div>
                <div class="ret-foot">
                  ${it.sent ? `<span class="sent-mark">${ICONS.check} Отправлено</span>` : `
                    <button class="btn btn-ghost btn-sm" data-act="ret-copy" data-key="${esc(it.key)}">${ICONS.copy} Копировать</button>
                    <button class="btn btn-accent btn-sm" data-act="ret-sent" data-key="${esc(it.key)}">${ICONS.send} Отправлено</button>`}
                  <span class="spacer"></span>
                  <span style="font-size:11.5px;color:var(--ink-3);">${esc(it.client.tg)}</span>
                </div>
              </div>`).join('')}
          </div>
        </div>`).join('') || '<div class="card reveal"><div class="empty"><span class="empty-orn">◦</span>Очередь пуста — все поводы отработаны</div></div>'}`;

    view().querySelectorAll('.count-up').forEach(countUp);
    revealAll();
  }

  // ---------- Аналитика ----------
  function renderAnalytics() {
    const a = analytics();
    const CAT = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)'];
    const top = Object.entries(a.bySvc).sort((x, y) => y[1].sum - x[1].sum)
      .map(([sid, v], i) => ({ label: SVC[sid].short, value: v.sum, fmt: `${money(v.sum)} · ${v.n}`, color: CAT[i % 5] }));

    const all = clients().map((c) => ({ c, st: clientStats(c) }));
    const segRows = ['vip', 'regular', 'new', 'risk', 'sleeping', 'tourist'].map((s) => ({
      label: SEGMENT_LABEL[s], value: all.filter((x) => x.st.segment === s).length,
      fmt: String(all.filter((x) => x.st.segment === s).length),
    }));

    // выручка по мастерам за 30 дней
    const m0 = iso(dayOffset(-29)), m1 = iso(TODAY);
    const byMaster = {};
    doneIn(m0, m1).forEach((x) => {
      byMaster[x.master] = byMaster[x.master] || 0;
      byMaster[x.master] += x.price;
    });
    const masterRows = D.masters.map((mm, i) => ({
      label: mm.short + ' · ' + mm.role, value: byMaster[mm.id] || 0, fmt: money(byMaster[mm.id] || 0), color: CAT[i % 5],
    })).sort((x, y) => y.value - x.value);

    // визиты по дням недели за 90 дней
    const dowCount = [0, 0, 0, 0, 0, 0, 0];
    doneIn(iso(dayOffset(-89)), m1).forEach((x) => { dowCount[(parseIso(x.date).getDay() + 6) % 7]++; });
    const dowRows = DOW_SHORT.map((d, i) => ({ label: d, value: dowCount[i], fmt: String(dowCount[i]) }));

    const topLtv = [...all].sort((x, y) => y.st.ltv - x.st.ltv).slice(0, 5);

    view().innerHTML = `
      <div class="page-head reveal">
        <div>
          <h1 class="page-title">Аналитика</h1>
          <p class="page-sub">Что приносит деньги, кто их приносит и где салон их теряет.</p>
        </div>
      </div>
      <div class="grid-2b">
        <div class="card reveal">
          <div class="card-head"><div><div class="card-title">Топ услуг</div><div class="card-hint">по выручке · 90 дней · количество визитов</div></div></div>
          ${hbars(top)}
        </div>
        <div class="card reveal">
          <div class="card-head"><div><div class="card-title">Выручка по мастерам</div><div class="card-hint">завершённые визиты · 30 дней</div></div></div>
          ${hbars(masterRows)}
        </div>
      </div>
      <div class="grid-2b">
        <div class="card reveal">
          <div class="card-head"><div><div class="card-title">Сегменты базы</div><div class="card-hint">считаются автоматически по поведению</div></div></div>
          ${hbars(segRows)}
        </div>
        <div class="card reveal">
          <div class="card-head"><div><div class="card-title">Визиты по дням недели</div><div class="card-hint">завершённые · 90 дней</div></div></div>
          ${hbars(dowRows)}
        </div>
      </div>
      <div class="card reveal">
        <div class="card-head"><div><div class="card-title">Топ клиенток по LTV</div><div class="card-hint">на них держится касса — берегите их в первую очередь</div></div></div>
        ${topLtv.map(({ c, st }) => `
          <div class="up-row">
            <span class="ava sm ${avaClass(c.id)}" data-open-client="${c.id}" style="cursor:pointer;">${initials(c.name)}</span>
            <div class="up-main"><b data-open-client="${c.id}" tabindex="0" role="button" style="cursor:pointer;">${esc(c.name)}</b>
            <span class="up-svc">${st.visits} ${plural(st.visits, 'визит', 'визита', 'визитов')} · средний чек ${money(st.avgCheck)}</span></div>
            <b class="num" style="font-size:13px;">${money(st.ltv)}</b>
          </div>`).join('')}
      </div>`;
    revealAll();
  }

  // ---------- Лояльность ----------
  function renderLoyalty() {
    const all = clients().map((c) => ({ c, st: clientStats(c) }));
    const byTier = { Silver: 0, Gold: 0, VIP: 0 };
    all.forEach((x) => byTier[x.st.tier]++);
    const almost = all
      .filter((x) => (x.st.tier === 'Silver' && x.st.visits >= 3) || (x.st.tier === 'Gold' && x.st.visits >= 8))
      .sort((a, b) => b.st.visits - a.st.visits).slice(0, 6);
    const richPts = all.filter((x) => x.st.points >= 1200).sort((a, b) => b.st.points - a.st.points).slice(0, 6);

    view().innerHTML = `
      <div class="page-head reveal">
        <div>
          <h1 class="page-title">Лояльность</h1>
          <p class="page-sub">Три уровня, кешбэк баллами и поводы для личных предложений. Уровень считается автоматически по визитам и LTV.</p>
        </div>
      </div>
      <div class="tier-grid">
        <div class="card tier-card silver reveal">
          <span class="tier-cb">кешбэк 5%</span>
          <div class="tier-name">${ICONS.spark} Silver</div>
          <div class="tier-cond">старт для каждой клиентки</div>
          <ul>
            <li>${ICONS.check}Кешбэк 5% баллами с каждого визита</li>
            <li>${ICONS.check}Скидка 10% на первую новую услугу</li>
            <li>${ICONS.check}Напоминания и забота в мессенджере</li>
          </ul>
        </div>
        <div class="card tier-card gold reveal">
          <span class="tier-cb">кешбэк 10%</span>
          <div class="tier-name">${ICONS.spark} Gold</div>
          <div class="tier-cond">от 5 визитов</div>
          <ul>
            <li>${ICONS.check}Кешбэк 10% баллами</li>
            <li>${ICONS.check}Перенос записи без штрафа</li>
            <li>${ICONS.check}Подарок в день рождения</li>
          </ul>
        </div>
        <div class="card tier-card viptier reveal">
          <span class="tier-cb">кешбэк 15%</span>
          <div class="tier-name">${ICONS.spark} VIP</div>
          <div class="tier-cond">от 10 визитов или 35 000 ₽ LTV</div>
          <ul>
            <li>${ICONS.check}Кешбэк 15% баллами</li>
            <li>${ICONS.check}Приоритетные окна — запись раньше всех</li>
            <li>${ICONS.check}Именные акции и закрытые новинки</li>
          </ul>
        </div>
      </div>
      <div class="grid-2b">
        <div class="card reveal">
          <div class="card-head"><div><div class="card-title">Уровни базы</div><div class="card-hint">сколько клиенток на каждом уровне</div></div></div>
          ${hbars(Object.entries(byTier).map(([label, n]) => ({ label, value: n, fmt: String(n) })))}
        </div>
        <div class="card reveal">
          <div class="card-head"><div><div class="card-title">Почти на новом уровне</div><div class="card-hint">скажите им об этом — это мотивирует дойти</div></div></div>
          ${almost.map(({ c, st }) => `
            <div class="up-row">
              <span class="ava sm ${avaClass(c.id)}" data-open-client="${c.id}" style="cursor:pointer;">${initials(c.name)}</span>
              <div class="up-main"><b data-open-client="${c.id}" tabindex="0" role="button" style="cursor:pointer;">${esc(c.name)}</b>
              <span class="up-svc">${st.visits} ${plural(st.visits, 'визит', 'визита', 'визитов')} · ${st.tier} → ${st.tier === 'Gold' ? 'VIP' : 'Gold'}</span></div>
              <span class="tag gold">ещё ${(st.tier === 'Gold' ? 10 : 5) - st.visits}</span>
            </div>`).join('') || '<div class="empty">Пока никого близко</div>'}
        </div>
      </div>
      <div class="card reveal">
        <div class="card-head"><div><div class="card-title">Накопили баллы — повод предложить списание</div><div class="card-hint">списание ощущается как подарок — отличный повод для личного сообщения</div></div></div>
        ${richPts.map(({ c, st }) => `
          <div class="up-row">
            <span class="ava sm ${avaClass(c.id)}" data-open-client="${c.id}" style="cursor:pointer;">${initials(c.name)}</span>
            <div class="up-main"><b data-open-client="${c.id}" tabindex="0" role="button" style="cursor:pointer;">${esc(c.name)}</b>
            <span class="up-svc">${st.tier} · кешбэк ${st.rate}%</span></div>
            <b class="num" style="font-size:13px;">${nf.format(st.points)} б.</b>
          </div>`).join('')}
      </div>`;
    revealAll();
  }

  // ==================== Модалки ====================
  const modalVeil = () => document.getElementById('modal-veil');

  function openModal(html) {
    modalVeil().innerHTML = `<div class="modal">${html}</div>`;
    modalVeil().classList.add('open');
    document.body.classList.add('modal-open');
  }
  function closeModal() {
    modalVeil().classList.remove('open');
    document.body.classList.remove('modal-open');
  }

  function modalNewClient() {
    openModal(`
      <h3>Новая клиентка</h3>
      <div class="field"><label for="f-name">Имя и фамилия</label><input id="f-name" type="text" placeholder="Мария Иванова"></div>
      <div class="field-row">
        <div class="field"><label for="f-phone">Телефон</label><input id="f-phone" type="tel" placeholder="+7 900 000-00-00"></div>
        <div class="field"><label for="f-bday">День рождения</label><input id="f-bday" type="date"></div>
      </div>
      <div class="field"><label for="f-note">Заметка</label><textarea id="f-note" rows="2" placeholder="Откуда пришла, предпочтения…"></textarea></div>
      <div class="field"><label class="field-check"><input type="checkbox" id="f-tourist"> Гостья отеля — не отправлять маркетинговые догоны</label></div>
      <div class="modal-foot">
        <button class="btn btn-ghost" data-act="modal-close">Отмена</button>
        <button class="btn btn-primary" data-act="save-client">Сохранить <span class="btn-orb">${ICONS.check}</span></button>
      </div>`);
  }

  function modalNewAppt(clientId, date) {
    const list = [...clients()].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    openModal(`
      <h3>Новая запись</h3>
      <div class="field"><label for="f-client">Клиентка</label>
        <select id="f-client">${list.map((c) => `<option value="${c.id}" ${c.id === clientId ? 'selected' : ''}>${esc(c.name)}${c.tourist ? ' · гостья отеля' : ''}</option>`).join('')}</select></div>
      <div class="field"><label for="f-svc">Услуга</label>
        <select id="f-svc">${D.services.map((s) => `<option value="${s.id}">${esc(s.name)} — ${money(s.price)}</option>`).join('')}</select></div>
      <div class="field"><label for="f-master">Мастер</label>
        <select id="f-master">${D.masters.map((mm) => `<option value="${mm.id}">${esc(mm.name)} — ${esc(mm.role)}</option>`).join('')}</select></div>
      <div class="field-row">
        <div class="field"><label for="f-date">Дата</label><input id="f-date" type="date" value="${date || iso(dayOffset(1))}" min="${D.todayIso}"></div>
        <div class="field"><label for="f-time">Время</label>
          <select id="f-time">${['10:00', '12:00', '14:00', '16:00', '18:00'].map((t) => `<option>${t}</option>`).join('')}</select></div>
      </div>
      <div class="modal-foot">
        <button class="btn btn-ghost" data-act="modal-close">Отмена</button>
        <button class="btn btn-primary" data-act="save-appt">Записать <span class="btn-orb">${ICONS.check}</span></button>
      </div>`);
    // мастер по умолчанию — «домашний» для услуги
    const svcSel = document.getElementById('f-svc');
    const mSel = document.getElementById('f-master');
    const sync = () => { mSel.value = homeMasterId(svcSel.value); };
    svcSel.addEventListener('change', sync);
    sync();
  }

  function modalCancel(key) {
    openModal(`
      <h3>Отмена записи</h3>
      <div class="field"><label for="f-reason">Причина — попадёт в аналитику потерь</label>
        <select id="f-reason">${D.cancelReasons.map((r) => `<option>${esc(r)}</option>`).join('')}</select></div>
      <div class="modal-foot">
        <button class="btn btn-ghost" data-act="modal-close">Назад</button>
        <button class="btn btn-accent" data-act="confirm-cancel" data-key="${esc(key)}">Отменить запись</button>
      </div>`);
  }

  // ==================== Тосты ====================
  function toast(text) {
    const box = document.getElementById('toasts');
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `${ICONS.check}<span>${esc(text)}</span>`;
    box.appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 300); }, 2600);
  }

  function copyText(text, okMsg) {
    const done = () => toast(okMsg || 'Скопировано — отправьте в WhatsApp или Telegram');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, done));
    } else fallbackCopy(text, done);
  }
  function fallbackCopy(text, done) {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); done(); } catch (e) { toast('Не удалось скопировать'); }
    ta.remove();
  }

  // ==================== Роутер ====================
  const ROUTES = {
    '#/dashboard': renderDashboard,
    '#/clients': renderClients,
    '#/calendar': renderCalendar,
    '#/schedule': renderCalendar,
    '#/retention': renderRetention,
    '#/analytics': renderAnalytics,
    '#/loyalty': renderLoyalty,
  };

  function currentRoute() {
    if (location.hash === '#/schedule') return '#/calendar';
    return ROUTES[location.hash] ? location.hash : '#/dashboard';
  }

  function render() {
    const r = currentRoute();
    document.querySelectorAll('.nav-item[data-route]').forEach((n) => n.classList.toggle('active', n.getAttribute('href') === r));
    closeSheet();
    ROUTES[r]();
    updateNavCount();
    window.scrollTo({ top: 0 });
  }

  function updateNavCount() {
    const n = retentionQueue().filter((x) => !x.sent).length;
    ['ret-count', 'ret-count-m'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) { el.textContent = n; el.style.display = n ? '' : 'none'; }
    });
  }

  // ==================== Глобальные события ====================
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-act], [data-open-client]');
    if (!t) return;

    if (t.dataset.openClient) { openSheet(t.dataset.openClient); return; }

    const act = t.dataset.act;
    if (act === 'close-sheet') closeSheet();
    if (act === 'modal-close') closeModal();
    if (act === 'new-client') modalNewClient();
    if (act === 'new-appt') { closeSheet(); modalNewAppt(t.dataset.client, t.dataset.date); }

    if (act === 'copy-hello') {
      const c = clientById(t.dataset.client);
      copyText(`${firstName(c.name)}, здравствуйте! Это ${masterOfClient(c).short} из «Велюра».`);
    }
    if (act === 'copy-offer') {
      const c = clientById(t.dataset.client);
      const reco = recommendations(c, clientStats(c))[0];
      if (reco) copyText(`${firstName(c.name)}, здравствуйте! Это ${masterOfClient(c).short} из «Велюра». ${reco.offer}`);
    }
    if (act === 'toggle-tourist') {
      const id = t.dataset.client;
      const c = clientById(id);
      saved.flags[id] = Object.assign({}, saved.flags[id], { tourist: !c.tourist });
      persist();
      toast(!c.tourist ? 'Отмечена как гостья отеля — маркетинговые догоны отключены' : 'Метка снята — клиентка снова участвует в догонах');
      openSheet(id);
      updateNavCount();
    }

    if (act === 'save-client') {
      const name = document.getElementById('f-name').value.trim();
      if (!name) { toast('Укажите имя'); return; }
      const bd = document.getElementById('f-bday').value;
      saved.addedClients.push({
        id: 'u' + Date.now(),
        name,
        phone: document.getElementById('f-phone').value.trim() || '—',
        tg: '@—',
        birthday: bd ? bd.slice(5) : null,
        note: document.getElementById('f-note').value.trim(),
        tourist: document.getElementById('f-tourist').checked,
        cohort: 'new', favs: ['man'], interval: 30, joined: D.todayIso,
      });
      persist(); closeModal(); toast('Клиентка добавлена');
      if (currentRoute() === '#/clients') renderClients();
    }

    if (act === 'save-appt') {
      const cid = document.getElementById('f-client').value;
      const sid = document.getElementById('f-svc').value;
      const masterId = document.getElementById('f-master').value;
      const date = document.getElementById('f-date').value;
      const time = document.getElementById('f-time').value;
      if (!date) { toast('Выберите дату'); return; }
      if (date < D.todayIso) { toast('Дата уже прошла — выберите день начиная с сегодняшнего'); return; }
      const clash = appointments().some((a) => a.date === date && a.time === time && a.master === masterId && (a.status === 'pending' || a.status === 'confirmed'));
      if (clash) { toast(`У мастера ${MB[masterId].short} этот слот занят — выберите другое время`); return; }
      saved.addedAppointments.push({
        id: 'u' + Date.now(), clientId: cid, serviceIds: [sid],
        price: SVC[sid].price, date, time, status: 'pending', reason: null, master: masterId,
      });
      persist(); closeModal(); toast('Запись создана — не забудьте подтвердить');
      selectedDay = date;
      const selectedDate = parseIso(date);
      calShift = (selectedDate.getFullYear() - TODAY.getFullYear()) * 12 + selectedDate.getMonth() - TODAY.getMonth();
      render();
    }

    if (act === 'appt-confirm') { saved.statusOverrides[t.dataset.key] = { status: 'confirmed' }; persist(); toast('Запись подтверждена'); render(); }
    if (act === 'appt-done') {
      const a = appointments().find((x) => apptKey(x) === t.dataset.key);
      saved.statusOverrides[t.dataset.key] = { status: 'done' };
      persist();
      const c = clientById(a.clientId); const st = clientStats(c);
      const pts = Math.round(a.price * st.rate / 100);
      toast(`Визит завершён: +${money(a.price)} · +${nf.format(pts)} ${plural(pts, 'балл', 'балла', 'баллов')}`);
      render();
    }
    if (act === 'appt-noshow') { saved.statusOverrides[t.dataset.key] = { status: 'no_show', reason: 'Не пришла без предупреждения' }; persist(); toast('Отмечена неявка — догон уже в очереди'); render(); }
    if (act === 'appt-cancel') modalCancel(t.dataset.key);
    if (act === 'confirm-cancel') {
      const reason = document.getElementById('f-reason').value;
      saved.statusOverrides[t.dataset.key] = { status: 'cancelled', reason };
      persist(); closeModal(); toast('Запись отменена'); render();
    }

    if (act === 'ret-copy') {
      const it = retMsgByKey(t.dataset.key);
      if (it) copyText(it.msg);
    }
    if (act === 'ret-sent') {
      saved.sentFollowups[t.dataset.key] = Date.now();
      persist(); toast('Отмечено как отправленное'); renderRetention(); updateNavCount();
    }
  });

  document.getElementById('sheet-veil').addEventListener('click', closeSheet);
  modalVeil().addEventListener('click', (e) => { if (e.target === modalVeil()) closeModal(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeSheet(); closeModal(); return; }
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('[data-open-client]')) {
      e.preventDefault();
      e.target.click();
    }
  });

  window.addEventListener('hashchange', render);
  render();
})();
