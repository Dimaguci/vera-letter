import { KEY_COUNT, SAVE_KEY, freshState, readState, isWeddingDate, isKissDay, isDinnerCorrect, shuffle, nextHint } from './game-logic.js';

const app = document.querySelector('#app');
const announcer = document.querySelector('#announcer');
const effects = document.querySelector('#effects');
const restartDialog = document.querySelector('#restart-dialog');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let state;
try { state = readState(window.localStorage); } catch { state = freshState(); }
let soundEnabled = false;
try { soundEnabled = localStorage.getItem('dima-vera-sound') === 'true'; } catch { /* A letter still works with private storage disabled. */ }
let audioContext;
const timers = new Set();
let memoryDeck = [];
let flipped = [];
let memoryBusy = false;

const icon = (name, extra = '') => `<svg class="icon ${extra}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
const sticker = (extra = '') => `<img class="vera-sticker ${extra}" src="./assets/vera-sticker.png" width="59" height="64" alt="Тот самый розовый персонаж из твоего стикера" draggable="false" />`;
const arrow = icon('arrow');
const heart = icon('heart');

const victories = {
  password: { title: 'Тот самый день. То самое «да».', text: '31 октября 2020 года мы стали семьёй. А я стал мужем самой любимой девушки на свете.', note: 'первый ключ — наше «навсегда»', next: 'camp', button: 'Вернуться в наше лето' },
  camp: { title: 'Лето 2016. Лагерь «Чайка».', text: 'Там началась наша история. И, по совершенно беспристрастной версии твоего мужа, ты за мной бегала. Ну… почти всё время 😏', note: 'второй ключ — наша встреча', next: 'kiss', button: 'А что было дальше?' },
  kiss: { title: '12 августа. У конгазской церкви.', text: 'Прошло всего два дня — и я проявил инициативу. Наш первый поцелуй. Такой маленький момент, из которого выросла такая большая история.', note: 'третий ключ — первый поцелуй', next: 'dinner', button: 'Кажется, котик проголодался' },
  dinner: { title: 'Котик накормлен. Семья спасена.', text: 'Жареные яйца и пельмени — мой проверенный план. А ты — моя любимая компания за любым столом.', note: 'четвёртый ключ — рецепт счастья', next: 'joke', button: 'Теперь можно и пошутить' },
  joke: { title: '«В смысле где? Ты же тут».', text: 'Кажется, за такую шутку сейчас прилетит тот самый стикер. Ладно-ладно, соску ребёнка тоже поищу 😇', note: 'пятый ключ — наш особенный юмор', next: 'family', button: 'Осталось самое дорогое', sticker: true },
  family: { title: 'Вот она. Наша команда.', text: 'Дима, Вера, Сашка и Евочка. Мы уже добились многого. И впереди ещё столько всего — ведь мы есть друг у друга.', note: 'шестой ключ — наш дом', next: 'envelope', button: 'Теперь можно открыть письмо' },
};

const letterParagraphs = [
  'Малыш,',
  'Я хотел подарить тебе немного тепла. Чтобы ты на несколько минут остановилась среди всех дел, улыбнулась и почувствовала, как сильно я тебя люблю.',
  'Иногда я думаю о том лете в «Чайке». В 2016 году мы ещё не знали, сколько всего у нас впереди. А потом были 12 августа, поцелуй возле конгазской церкви, наша свадьба. И целая жизнь, которую мы строим вместе.',
  'Да, я ещё много раз буду шутить, что ты за мной бегала. Но инициативу тогда проявил я. И как же я рад, что сделал этот шаг к тебе.',
  'Я люблю твою нежность. Люблю то, как сильно ты любишь меня. И особенно люблю видеть, какая ты прекрасная мама для Сашки и Евочки. Спасибо за наше тепло, за наших детей, за нашу семью.',
  'Даже когда мы ругаемся, мне хочется поскорее с тобой помириться. Обнять, почувствовать тебя рядом и снова быть в нашем обычном, тёплом «мы». Потому что ты для меня всё.',
  'Мы вместе уже добились многого. И я верю, что дальше будет ещё больше: наших планов, маленьких радостей, больших побед и обычных вечеров рядом. У нас есть ты и я. И наши прекрасные детишки. С таким богатством хочется идти дальше.',
  'Я хочу и дальше смешить тебя своими шутками, обнимать после трудного дня, мириться, мечтать и жить с тобой эту жизнь. И снова выбирать тебя — мою Веру.',
  'Я очень тебя люблю. И прямо сейчас, пока ты читаешь это письмо, тоже.',
];

function later(callback, delay) {
  const timer = window.setTimeout(() => { timers.delete(timer); callback(); }, delay);
  timers.add(timer);
  return timer;
}

function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch { /* Progress may live in memory only. */ }
}

function say(text) {
  announcer.textContent = '';
  requestAnimationFrame(() => { announcer.textContent = text; });
}

function chime(kind = 'success') {
  if (!soundEnabled) return;
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    void audioContext.resume().catch(() => {});
    const notes = kind === 'tap' ? [523.25] : [523.25, 659.25, 783.99];
    notes.forEach((frequency, index) => {
      const start = audioContext.currentTime + index * 0.11;
      const oscillator = audioContext.createOscillator();
      const volume = audioContext.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      volume.gain.setValueAtTime(0, start);
      volume.gain.linearRampToValueAtTime(0.035, start + 0.025);
      volume.gain.exponentialRampToValueAtTime(0.001, start + 0.6);
      oscillator.connect(volume).connect(audioContext.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.65);
      oscillator.onended = () => { oscillator.disconnect(); volume.disconnect(); };
    });
  } catch { /* Sound is an optional extra. */ }
}

function burst() {
  if (reducedMotion.matches) return;
  for (let i = 0; i < 22; i += 1) {
    const particle = document.createElement('span');
    particle.className = 'heart-particle';
    particle.textContent = i % 4 === 0 ? '✧' : '♥';
    particle.style.setProperty('--x', `${8 + Math.random() * 84}vw`);
    particle.style.setProperty('--drift', `${(Math.random() - 0.5) * 220}px`);
    particle.style.setProperty('--turn', `${Math.random() * 300 - 150}deg`);
    particle.style.setProperty('--delay', `${Math.random() * 0.3}s`);
    particle.style.setProperty('--size', `${13 + Math.random() * 18}px`);
    effects.append(particle);
    particle.addEventListener('animationend', () => particle.remove(), { once: true });
  }
}

function go(stage) {
  timers.forEach(timer => clearTimeout(timer));
  timers.clear();
  effects.replaceChildren();
  flipped = [];
  memoryBusy = false;
  state.stage = stage;
  save();
  render();
  window.scrollTo({ top: 0, behavior: 'instant' });
  app.focus({ preventScroll: true });
}

function complete(stage, key) {
  if (!state.completed.includes(stage)) state.completed.push(stage);
  if (!state.keys.includes(key)) state.keys.push(key);
  save();
  render();
  chime();
  burst();
  say(`Правильно. ${victories[stage].note}. Собрано ключей: ${state.keys.length} из ${KEY_COUNT}.`);
}

function feedback(text, target = '#feedback') {
  const box = app.querySelector(target);
  if (!box) return;
  box.textContent = text;
  box.classList.remove('is-shaking');
  void box.offsetWidth;
  box.classList.add('is-shaking');
}

function attempt(stage) {
  state.attempts[stage] = (Number(state.attempts[stage]) || 0) + 1;
  save();
  return state.attempts[stage];
}

function progress() {
  const names = ['Наше «да»', 'Наша встреча', 'Первый поцелуй', 'Рецепт счастья', 'Наш юмор', 'Наш дом'];
  return `<div class="progress-wrap"><div class="progress-label"><span>Ключи к твоему письму</span><span>${state.keys.length}<span class="progress-total"> / ${KEY_COUNT}</span></span></div><ol class="key-progress" aria-label="Собрано ${state.keys.length} из ${KEY_COUNT} ключей">${names.map((name, index) => `<li class="${state.keys.includes(index) ? 'is-collected' : ''}" aria-label="${name}: ${state.keys.includes(index) ? 'найден' : 'ещё впереди'}"><span>${state.keys.includes(index) ? heart : '0' + (index + 1)}</span><small>${name}</small></li>`).join('')}</ol></div>`;
}

function envelope(extra = '') {
  return `<div class="envelope-scene ${extra}" aria-hidden="true"><div class="envelope-halo"></div><span class="envelope-spark spark-one">✧</span><span class="envelope-spark spark-two">✧</span><span class="envelope-spark spark-three">♡</span><div class="envelope"><div class="envelope-back"></div><div class="letter-peek"><span>кое-что очень личное</span><b>Вере ♡</b><i>от того самого котика</i></div><div class="envelope-flap"></div><div class="envelope-front"></div><div class="envelope-address"><small>КОМУ</small><strong>Моей Вере</strong><span>лично в руки, прямо в сердце</span></div><div class="wax-seal">${heart}</div><div class="envelope-stamp"><span>LOVE</span>${heart}<span>POST</span></div><div class="postmark"><span>спецдоставка</span><i>ДИМА → ВЕРА</i><span>с любовью</span></div></div><div class="envelope-shadow"></div></div>`;
}

function lovePals(extra = '') {
  return `<div class="love-pals ${extra}" aria-hidden="true"><span class="pal-heart">♡</span><svg viewBox="0 0 260 170" fill="none"><ellipse cx="130" cy="151" rx="87" ry="8" fill="#513025" opacity=".07"/><g class="pal pal-left"><path d="M38 102C30 81 40 57 58 53L66 30 82 47C104 41 128 57 130 83L132 133C109 152 63 154 42 136Z" fill="#E8AFAD" stroke="#95425A" stroke-width="2"/><path d="m62 53 6-14 11 12" fill="#D78791"/><path d="M61 86q6-8 12 0m20 0q6-8 12 0" stroke="#6A3944" stroke-width="2.5" stroke-linecap="round"/><path d="m79 97 5 4 5-4m-5 4v4m0 0q-6 6-10 0m10 0q6 6 10 0" stroke="#6A3944" stroke-width="2" stroke-linecap="round"/><ellipse cx="59" cy="99" rx="9" ry="5" fill="#D97C89" opacity=".6"/><ellipse cx="105" cy="99" rx="9" ry="5" fill="#D97C89" opacity=".6"/><path d="M115 115q24 0 27 16" stroke="#95425A" stroke-width="2" stroke-linecap="round"/></g><g class="pal pal-right"><path d="M222 105C228 83 221 60 202 54L194 31 179 48C153 43 131 58 130 84L128 133C150 152 197 153 217 136Z" fill="#EEE1C9" stroke="#9E8067" stroke-width="2"/><path d="m199 54-6-14-11 12" fill="#D5B7A3"/><path d="M156 88q6-8 12 0m20 0q6-8 12 0" stroke="#6A5145" stroke-width="2.5" stroke-linecap="round"/><path d="m174 98 5 4 5-4m-5 4v4m0 0q-6 6-10 0m10 0q6 6 10 0" stroke="#6A5145" stroke-width="2" stroke-linecap="round"/><ellipse cx="153" cy="100" rx="9" ry="5" fill="#D99C91" opacity=".6"/><ellipse cx="203" cy="100" rx="9" ry="5" fill="#D99C91" opacity=".6"/><path d="M145 115q-24 0-27 16" stroke="#9E8067" stroke-width="2" stroke-linecap="round"/></g><path class="pals-heart" d="M130 130c-22-12-21-28-10-28 5 0 8 4 10 7 2-3 5-7 10-7 11 0 12 16-10 28Z" fill="#B53B54"/></svg></div>`;
}

function aside(kind, line, subline) {
  const illustrations = {
    camp: `<svg viewBox="0 0 250 180" class="postcard-art" aria-hidden="true"><circle cx="192" cy="45" r="23" fill="#DAB981"/><path d="m10 140 61-81 64 81" fill="#D8DCB8"/><path d="m99 140 58-64 77 64" fill="#A8B49B"/><path d="m67 146 60-92 60 92Z" fill="#BF685C"/><path d="m127 54-4 92h35Z" fill="#E6A590"/><path d="m105 146 22-40 21 40Z" fill="#814840"/><path d="M14 151h220M167 38q9-10 18 0m-58-13q8-8 16 0" stroke="#63775F" stroke-width="2" stroke-linecap="round"/></svg>`,
    kiss: `<svg viewBox="0 0 250 180" class="postcard-art" aria-hidden="true"><path d="M29 150h192" stroke="#B8A68C" stroke-width="2"/><path d="M86 147V81h78v66" fill="#E9D4BB"/><path d="m75 83 50-39 50 39Z" fill="#B8746D"/><path d="M113 46V28q12-18 24 0v18" fill="#D3AA74"/><path d="M125 17V5m-6 6h12" stroke="#9C7652" stroke-width="2"/><path d="M113 148v-28q12-20 24 0v28" fill="#AF8C7A"/><path d="M104 93v16m43-16v16" stroke="#B09B81" stroke-width="7"/><path d="M55 77c-17-11-7-25 2-14 9-11 19 3-2 14Zm143 27c-17-11-7-25 2-14 9-11 19 3-2 14Z" fill="#C97884"/></svg>`,
    food: `<div class="postcard-emoji" aria-hidden="true">🥚<span>♡</span>🥟</div>`,
    joke: `<div class="postcard-sticker">${sticker('sticker-dance')}</div>`,
    family: lovePals('small-pals'),
    date: `<div class="calendar-art" aria-hidden="true"><span>октябрь</span><strong>31</strong><small>наше «да»</small></div>`,
  };
  // The wedding answer stays inside the success state.
  const art = kind === 'date' && !state.completed.includes('password') ? `<div class="lock-illustration">${icon('lock')}<span>♡</span></div>` : illustrations[kind];
  return `<aside class="quest-aside"><div class="memory-postcard"><span class="tape"></span>${art}<p>${line}</p><small>${subline}</small></div><span class="aside-scribble">у нас с тобой<br>ещё столько впереди ♡</span></aside>`;
}

function victory(stage) {
  const item = victories[stage];
  return `<div class="victory-content"><div class="victory-icon">${item.sticker ? sticker('sticker-dance') : heart}</div><span class="eyebrow">ключ найден</span><h2>${item.title}</h2><p>${item.text}</p><span class="collected-note">${icon('check')}${item.note}</span><button class="button" data-go="${item.next}">${item.button}${arrow}</button></div>`;
}

function quest({ number, eyebrow, title, lead, body, side }) {
  return `<section class="quest-page">${progress()}<div class="quest-grid"><div class="quest-main"><div class="chapter-label"><span>ГЛАВА ${number.toString().padStart(2, '0')}</span><i></i><span>${eyebrow}</span></div><h1>${title}</h1><p class="quest-lead">${lead}</p><div class="challenge-content">${state.completed.includes(state.stage) ? victory(state.stage) : body}</div></div>${side}</div><div class="quest-bottom"><span>${icon('heart')} Здесь можно ошибаться. Любовь от этого не уменьшается.</span><span>Д + В</span></div></section>`;
}

function hintsFor(stage) {
  const hints = {
    password: ['Это дата одного очень важного «да» в нашей жизни.', 'День, когда мы стали мужем и женой. Осень 2020 года.', 'Наша свадьба была в последний день октября 2020 года.', '31 октября 2020 года. Можно написать 31.10.2020 — конверт пропустит ♡'],
    camp: ['Вспомни летнюю школу в 2016 году.', 'Название лагеря — как птица. Это «Чайка» ♡'],
    kiss: ['Мы начали встречаться спустя два дня. Это было в августе.', 'Наш первый поцелуй — 12 августа. А место — возле конгазской церкви ♡'],
    dinner: ['Котик любит два простых блюда. Одно жарят на сковороде, второе варят.', 'Выбери только яичницу и пельмени. Вот и всё любимое меню ♡'],
    joke: ['Твой муж сейчас точно не упустит возможность тебя подколоть.', 'Его ответ: «В смысле где? Ты же тут» 😏'],
  };
  return hints[stage] || [];
}

function hintMarkup(stage) {
  const index = Number(state.hints[stage]) || 0;
  const hints = hintsFor(stage);
  return `<div class="help-area"><button class="text-button hint-button" data-action="hint">${icon('spark')}${index ? 'Ещё немного помощи' : 'Можно маленькую подсказку?'}</button><p id="hint-text" class="hint-text" aria-live="polite">${index ? hints[Math.min(index, hints.length) - 1] : ''}</p></div>`;
}

function showHint() {
  const result = nextHint(Number(state.hints[state.stage]) || 0, hintsFor(state.stage));
  state.hints[state.stage] = result.index;
  save();
  const text = app.querySelector('#hint-text');
  if (text) text.textContent = result.text;
  const label = app.querySelector('.hint-button');
  if (label) label.innerHTML = `${icon('spark')}${result.index === hintsFor(state.stage).length ? 'Вот и весь секрет ♡' : 'Ещё немного помощи'}`;
}

function homeView() {
  return `<section class="home-page"><div class="hero-copy"><div class="eyebrow hero-eyebrow"><span class="tiny-line"></span> личная доставка счастья</div><h1>Вера,<br>это всё<br><em>для тебя.</em><span class="title-star" aria-hidden="true">✧</span></h1><p>Одно маленькое приключение.<br>Одна большая любовь.</p><button class="button hero-button" data-go="prologue">Забрать моё письмо${arrow}</button><div class="hero-meta"><span>${icon('lock')} только для одной девочки</span><span>7–10 минут ♡</span></div></div><div class="hero-art"><span class="handwritten top-note">тебе кое-что пришло…</span><button class="envelope-button" data-go="prologue" aria-label="Взять письмо для Веры">${envelope()}</button><div class="hero-bottom-note"><span class="curved-arrow" aria-hidden="true">⤴</span><p>от мужа,<br>который всё ещё влюблён</p>${sticker('hero-sticker')}</div></div><div class="hero-footnote"><span>НАША ИСТОРИЯ ПРОДОЛЖАЕТСЯ</span><div class="mini-thread"></div><span>С 2016 ГОДА</span></div></section>`;
}

function prologueView() {
  return `<section class="center-page prologue-page"><span class="eyebrow">перед тем как мы начнём</span>${lovePals()}<h1>Малыш,<br>выдели минутку <em>для нас.</em></h1><p class="center-lead">Среди всех дел, забот и «где детская соска?»<br class="desktop-only"> мне захотелось напомнить тебе кое-что важное.</p><p class="prologue-note">Ты — моя любимая. Моя семья. Мой человек.<br>И у меня есть для тебя письмо.</p><div class="little-divider">♡</div><p class="small-copy">Я спрятал его за шестью ключами из нашей истории.<br>Давай вспомним, как всё начиналось?</p><button class="button" data-go="gate">Давай, я готова${arrow}</button><span class="under-button">муж обещает вести себя хорошо. почти.</span></section>`;
}

function gateView() {
  if (state.gateResult) {
    const disaster = state.gateResult === 'catastrophe';
    return `<section class="center-page gate-result"><span class="eyebrow">${disaster ? 'ой. кажется, случилось непоправимое' : 'личность подтверждена'}</span>${disaster ? `<div class="disaster-sticker">${sticker('sticker-dance')}<span>♥</span><span>♥</span><span>♥</span></div>` : lovePals()}<h1>${disaster ? 'Муж влюбился<br>в тебя <em>ещё сильнее.</em>' : 'Так и знал,<br>моя <em>любимая.</em>'}</h1><p class="center-lead">${disaster ? 'Процесс необратим. Придётся теперь жить с очень любящим Димой.' : 'Котик довольно урчит. А письмо ждёт, пока ты найдёшь все шесть ключей.'}</p><div class="small-paper-note">${disaster ? 'Побочные эффекты: объятия, поцелуи<br>и шутки очень сомнительного качества.' : 'Подсказки есть. Попытки бесконечны.<br>Чувства настоящие.'}</div><button class="button" data-go="password">Иду за первым ключом${arrow}</button></section>`;
  }
  return `<section class="center-page gate-page"><span class="eyebrow">очень серьёзная проверка</span><div class="mini-heart-character" aria-hidden="true"><span>♥</span><i>• ‿ •</i></div><h1>Твой муж —<br>твой любимый <em>котик?</em></h1><p class="center-lead">Подумай хорошенько. Тут всё очень официально.</p><div class="runaway-arena ${state.noAttempts >= 5 ? 'no-resigned' : ''}"><button class="button yes-button" data-action="yes">Конечно, котик${heart}</button><button class="button button-soft no-button" id="no-button" data-action="no">${state.noAttempts >= 5 ? 'Нет. Я рискну 😏' : 'Нет'}</button><span class="arena-doodle" aria-hidden="true">♡</span></div><div class="runaway-caption" id="runaway-caption" role="status">${noCaption()}</div><p class="under-button">${state.noAttempts >= 5 ? 'Теперь кнопка честно даст себя нажать.' : 'P. S. У кнопки «Нет», кажется, свои планы.'}</p></section>`;
}

function noCaption() {
  return ['Ответ принимается исключительно по любви.', 'Ой, не туда. Бывает 😇', 'Кнопка тоже знает, какой ответ правильный.', 'Малыш, ты серьёзно решила её поймать?', 'Ты настойчивая. Это мы ещё с «Чайки» помним 😏', 'Ладно, нажимай «Нет». Но будь готова: случится непоправимое…'][state.noAttempts];
}

function passwordView() {
  return quest({ number: 1, eyebrow: 'дата, которая всё изменила', title: 'У каждого «навсегда»<br>есть <em>своё начало.</em>', lead: 'Первый ключ спрятан в одной важной дате. Вспомни её и напиши пароль.', body: `<form id="password-form" class="answer-form" novalidate><label for="date-input">Секретный пароль</label><div class="input-row"><input id="date-input" name="date" type="text" placeholder="Та самая дата…" autocomplete="off" maxlength="48" aria-describedby="date-description feedback" required /><button class="button input-submit" type="submit" aria-label="Проверить пароль">${arrow}</button></div><small id="date-description">Можно цифрами или словами. Сердце поймёт.</small></form><p id="feedback" class="feedback" role="status"></p>${hintMarkup('password')}`, side: aside('date', 'Некоторые дни<br>меняют всю жизнь.', 'один из них — точно наш') });
}

function campView() {
  return quest({ number: 2, eyebrow: 'отмотать время назад', title: 'Помнишь наше<br><em>первое лето?</em>', lead: '2016 год. Два человека ещё не знают, что однажды станут целой семьёй. Где мы познакомились?', body: `<div class="place-options"><button class="place-option" data-action="camp" data-value="cinema"><span class="option-art cinema-art" aria-hidden="true">🎞</span><strong>В кино</strong><small>романтика последнего ряда</small></button><button class="place-option" data-action="camp" data-value="chaika"><span class="option-art camp-option-art" aria-hidden="true">⛺</span><strong>В лагере «Чайка»</strong><small>на летней школе</small></button><button class="place-option" data-action="camp" data-value="space"><span class="option-art planet-art" aria-hidden="true">🪐</span><strong>На другой планете</strong><small>чувства-то космические</small></button></div><p id="feedback" class="feedback" role="status"></p>${hintMarkup('camp')}`, side: aside('camp', 'Одно лето.<br>А воспоминаний — навсегда.', 'наша история, первая страница') });
}

function kissView() {
  const body = state.kissDateKnown === true ? `<div class="date-confirmed"><span>${icon('check')} Дату сердце вспомнило</span><strong>12 августа</strong></div><p class="inline-question">А где случился наш первый поцелуй?</p><div class="stacked-options"><button class="answer-option" data-action="kiss-place" data-value="park"><span>01</span> На скамейке в парке${arrow}</button><button class="answer-option" data-action="kiss-place" data-value="church"><span>02</span> У конгазской церкви${arrow}</button><button class="answer-option" data-action="kiss-place" data-value="bus"><span>03</span> На автобусной остановке${arrow}</button></div>` : `<form id="kiss-form" class="answer-form" novalidate><label for="kiss-input">Какого числа в августе мы впервые поцеловались?</label><div class="input-row"><input id="kiss-input" name="kiss" type="text" inputmode="numeric" placeholder="Число или дата…" autocomplete="off" maxlength="40" aria-describedby="feedback" required /><button class="button input-submit" type="submit" aria-label="Проверить дату первого поцелуя">${arrow}</button></div></form>`;
  return quest({ number: 3, eyebrow: 'тот самый шаг навстречу', title: 'А потом случился<br><em>первый поцелуй.</em>', lead: 'Да-да, кто за кем бегал — обсудим отдельно. Но инициативу в итоге проявил я 😏', body: `${body}<p id="feedback" class="feedback" role="status"></p>${hintMarkup('kiss')}`, side: aside('kiss', 'С одного поцелуя<br>началось наше «мы».', 'есть моменты, которые с нами всегда') });
}

const foods = [ { id: 'eggs', emoji: '🍳', name: 'Жареные яйца' }, { id: 'sushi', emoji: '🍣', name: 'Суши' }, { id: 'dumplings', emoji: '🥟', name: 'Пельмени' }, { id: 'broccoli', emoji: '🥦', name: 'Брокколи' }, { id: 'salad', emoji: '🥗', name: 'Салат' } ];

function dinnerView() {
  return quest({ number: 4, eyebrow: 'мужская кулинарная классика', title: 'Любовь любовью,<br>а котик <em>хочет есть.</em>', lead: 'Если ничего не приготовлено, Дима всегда знает, что поесть. Собери его легендарный ужин из двух блюд.', body: `<div class="dinner-game"><div class="dinner-plate" id="dinner-plate" aria-live="polite">${plateContent()}</div><div class="food-options">${foods.map(food => `<button class="food-chip ${state.foods.includes(food.id) ? 'is-selected' : ''}" data-action="food" data-value="${food.id}" aria-pressed="${state.foods.includes(food.id)}"><span aria-hidden="true">${food.emoji}</span>${food.name}${icon('check')}</button>`).join('')}</div></div><button class="button" id="dinner-submit" data-action="serve" ${state.foods.length ? '' : 'disabled'}>Котик, кушать подано${arrow}</button><p id="feedback" class="feedback" role="status"></p>${hintMarkup('dinner')}`, side: aside('food', 'Секретный рецепт:<br>чтобы рядом была ты.', 'а еда — дело поправимое') });
}

function plateContent() {
  return state.foods.length ? `<div class="plated-foods">${foods.filter(food => state.foods.includes(food.id)).map(food => `<span title="${food.name}">${food.emoji}</span>`).join('')}</div><span class="plate-note">${state.foods.length} из 2 любимых блюд</span>` : `<span class="empty-plate-heart">♡</span><span class="plate-note">выбери два любимых блюда</span>`;
}

function jokeView() {
  return quest({ number: 5, eyebrow: 'без папиной шутки никуда', title: '«Дим,<br><em>где соска?»</em>', lead: 'Знакомая семейная ситуация. Ребёнку нужна соска, а у мужа уже готов ответ. Какой?', body: `<div class="speech-bubble"><span class="speech-label">твоя версия за мужа</span><div class="stacked-options"><button class="answer-option" data-action="joke" data-value="search"><span>01</span> «Сейчас всё найду, любимая»${arrow}</button><button class="answer-option" data-action="joke" data-value="here"><span>02</span> «В смысле где? Ты же тут»${arrow}</button><button class="answer-option" data-action="joke" data-value="cat"><span>03</span> «А ты у котика спрашивала?»${arrow}</button></div></div><p id="feedback" class="feedback" role="status"></p>${hintMarkup('joke')}`, side: aside('joke', 'У этой шутки<br>есть знакомое лицо.', 'кажется, ты уже хочешь его отправить') });
}

function familyView() {
  if (memoryDeck.length === 0) memoryDeck = shuffle(['Дима', 'Дима', 'Вера', 'Вера', 'Сашка', 'Сашка', 'Евочка', 'Евочка']);
  return quest({ number: 6, eyebrow: 'самое дорогое — рядом', title: 'Собери тех,<br>кто делает нас <em>семьёй.</em>', lead: 'Под сердечками спрятаны наши имена. Найди четыре пары — и вся наша команда будет вместе.', body: `<div class="memory-toolbar"><span id="memory-counter">Найдено ${state.memoryMatched.length} из 4 пар</span><button class="text-button" data-action="peek">${icon('spark')} Подсмотреть</button></div><div class="memory-grid">${memoryDeck.map((name, index) => { const matched = state.memoryMatched.includes(name); return `<button class="memory-card ${matched ? 'is-flipped is-matched' : ''}" data-action="flip" data-index="${index}" aria-label="${matched ? name + '. Пара найдена' : 'Карточка ' + (index + 1) + '. Открыть'}" ${matched ? 'disabled' : ''}><span class="memory-back" aria-hidden="true">${heart}<small>Д + В</small></span><span class="memory-front" aria-hidden="true"><span>${name === 'Дима' ? '☀' : name === 'Вера' ? '♡' : name === 'Сашка' ? '✦' : '✿'}</span><strong>${name}</strong><small>${name === 'Дима' ? 'твой котик' : name === 'Вера' ? 'сердце семьи' : name === 'Сашка' ? 'наше счастье' : 'наша радость'}</small></span></button>`; }).join('')}</div><p class="memory-caption" id="memory-caption" role="status">Здесь никто не торопит. Мы всё равно найдём друг друга.</p>`, side: aside('family', 'Ты. Я.<br>И наши прекрасные детишки.', 'Сашка и Евочка ♡') });
}

function envelopeView() {
  return `<section class="center-page envelope-page"><span class="eyebrow">все шесть ключей у тебя</span><h1>Теперь это письмо<br><em>только твоё.</em></h1><p class="center-lead">Спасибо, что прошла со мной по нашей истории.<br>А теперь — то, ради чего всё это было.</p>${envelope('final-envelope')}<button class="button" data-action="open-letter">Открыть письмо${icon('mail')}</button><span class="under-button">осторожно: внутри очень много любви</span></section>`;
}

function letterView() {
  return `<section class="letter-page"><div class="letter-topline"><span class="eyebrow">личное. настоящее. твоё.</span><span>ДИМА → ВЕРА</span></div><article class="love-letter"><div class="letter-corner" aria-hidden="true">♡</div><span class="letter-label">ПИСЬМО МОЕЙ ЛЮБИМОЙ ЖЕНЕ</span><h1>Моя <em>Вера.</em></h1><div class="letter-body">${letterParagraphs.map((p, index) => `<p class="${index === 0 ? 'letter-salutation' : ''}">${p}</p>`).join('')}</div><div class="letter-signature"><span>Твой</span><strong>Дима</strong><span class="signature-heart">♡</span></div><div class="letter-ps">P. S. Пельмени у нас ещё есть? Шучу. Сейчас важнее обнять тебя.</div></article><div class="letter-after"><span class="handwritten">и ещё кое-что…</span><button class="button" data-go="wish">У меня для тебя сюрприз${icon('gift')}</button><button class="text-button" data-action="save-letter">${icon('mail')} Сохранить письмо себе</button></div></section>`;
}

function wishView() {
  return `<section class="center-page wish-page"><span class="eyebrow">последний конверт — с настоящей магией</span><h1>Одно желание.<br><em>Любое твоё.</em></h1><p class="center-lead">А теперь самое важное происходит по ту сторону экрана.</p><div class="wish-ticket"><div class="ticket-top"><span>ОСОБЕННЫЙ ПОДАРОК ДЛЯ ВЕРЫ</span>${icon('gift')}</div><div class="ticket-main"><span class="ticket-number">№ 001 · ЕДИНСТВЕННОЙ И ЛЮБИМОЙ</span><h2>Сертификат<br>на <em>любое желание</em></h2><p>Подойди ко мне в другую комнату,<br>загадай любое желание — и я его исполню.</p><div class="ticket-details"><div><small>ИСПОЛНИТЕЛЬ</small><strong>Твой Дима</strong></div><div><small>КОГДА ДЕЙСТВУЕТ</small><strong>Прямо сейчас ♡</strong></div></div></div><div class="ticket-tear"><span>ЗАВЕРЕНО ЛЮБЯЩИМ МУЖЕМ</span><b>Д + В</b></div></div><button class="button" data-go="ending">Иду к тебе${heart}</button><span class="under-button">подсказка: муж уже где-то совсем рядом</span></section>`;
}

function endingView() {
  return `<section class="center-page ending-page"><span class="eyebrow">приключение продолжается в другой комнате</span>${lovePals()}<h1>Я жду тебя,<br><em>моя Вера.</em></h1><p class="center-lead">Телефон можно отложить.<br>Теперь моя очередь исполнять желания.</p><div class="ending-heart" aria-hidden="true">♡</div><span class="handwritten">Люблю. Твой Дима.</span><button class="text-button ending-back" data-go="letter">Вернуться к письму</button></section>`;
}

function render() {
  const views = { home: homeView, prologue: prologueView, gate: gateView, password: passwordView, camp: campView, kiss: kissView, dinner: dinnerView, joke: jokeView, family: familyView, envelope: envelopeView, letter: letterView, wish: wishView, ending: endingView };
  app.innerHTML = views[state.stage]();
  document.body.dataset.stage = state.stage;
  document.querySelector('#restart-button').hidden = state.stage === 'home';
  document.title = state.stage === 'letter' ? 'Моя Вера. Письмо от Димы ♡' : 'Вера, это всё для тебя ♡';
  if (state.stage === 'gate' && !state.gateResult) setupRunaway();
}

function setupRunaway() {
  const button = app.querySelector('#no-button');
  button.addEventListener('pointerenter', event => { if (event.pointerType === 'mouse' && state.noAttempts < 5) moveNo(); });
}

function moveNo() {
  const button = app.querySelector('#no-button');
  const arena = app.querySelector('.runaway-arena');
  if (!button || state.noAttempts >= 5) return;
  state.noAttempts += 1;
  save();
  if (state.noAttempts === 5) {
    arena.classList.add('no-resigned');
    button.style.left = '';
    button.style.top = '';
    button.textContent = 'Нет. Я рискну 😏';
    app.querySelector('.under-button').textContent = 'Теперь кнопка честно даст себя нажать.';
  } else {
    const spots = [[0.76, 0.1], [0.06, 0.76], [0.76, 0.78], [0.06, 0.1]];
    const [x, y] = spots[state.noAttempts - 1];
    button.style.left = `${12 + x * Math.max(0, arena.clientWidth - button.offsetWidth - 24)}px`;
    button.style.top = `${12 + y * Math.max(0, arena.clientHeight - button.offsetHeight - 24)}px`;
  }
  app.querySelector('#runaway-caption').textContent = noCaption();
  chime('tap');
}

function chooseFood(button) {
  const value = button.dataset.value;
  state.foods = state.foods.includes(value) ? state.foods.filter(food => food !== value) : [...state.foods, value];
  save();
  button.classList.toggle('is-selected', state.foods.includes(value));
  button.setAttribute('aria-pressed', String(state.foods.includes(value)));
  app.querySelector('#dinner-plate').innerHTML = plateContent();
  app.querySelector('#dinner-submit').disabled = state.foods.length === 0;
  app.querySelector('#feedback').textContent = '';
  chime('tap');
}

function updateMemoryCard(index, open) {
  const card = app.querySelector(`.memory-card[data-index="${index}"]`);
  if (!card) return;
  card.classList.toggle('is-flipped', open);
  card.setAttribute('aria-label', open ? memoryDeck[index] : `Карточка ${index + 1}. Открыть`);
}

function flipCard(index) {
  if (memoryBusy || flipped.includes(index) || state.memoryMatched.includes(memoryDeck[index])) return;
  updateMemoryCard(index, true);
  flipped.push(index);
  chime('tap');
  if (flipped.length < 2) return;
  memoryBusy = true;
  const [first, second] = flipped;
  if (memoryDeck[first] === memoryDeck[second]) {
    later(() => {
      state.memoryMatched.push(memoryDeck[first]);
      [first, second].forEach(i => {
        const card = app.querySelector(`.memory-card[data-index="${i}"]`);
        card.classList.add('is-matched');
        card.disabled = true;
        card.setAttribute('aria-label', `${memoryDeck[i]}. Пара найдена`);
      });
      flipped = [];
      memoryBusy = false;
      app.querySelector('#memory-counter').textContent = `Найдено ${state.memoryMatched.length} из 4 пар`;
      app.querySelector('#memory-caption').textContent = `${memoryDeck[first]} — на месте ♡`;
      if (state.memoryMatched.length === 4) complete('family', 5);
      else { save(); chime(); }
    }, reducedMotion.matches ? 60 : 430);
  } else {
    app.querySelector('#memory-caption').textContent = 'Почти! Попробуем ещё. Кажется, кто-то спрятался очень хорошо.';
    later(() => {
      [first, second].forEach(i => updateMemoryCard(i, false));
      flipped = [];
      memoryBusy = false;
    }, reducedMotion.matches ? 700 : 1000);
  }
}

function peekMemory() {
  if (memoryBusy || flipped.length) {
    feedback('Сначала открой вторую карточку. А потом можно подсмотреть ♡', '#memory-caption');
    return;
  }
  memoryBusy = true;
  app.querySelector('[data-action="peek"]').disabled = true;
  memoryDeck.forEach((_, index) => updateMemoryCard(index, true));
  app.querySelector('#memory-caption').textContent = 'Смотри внимательно. Все наши здесь ♡';
  say(memoryDeck.map((name, index) => `Карточка ${index + 1}: ${name}`).join('. '));
  later(() => {
    memoryDeck.forEach((name, index) => updateMemoryCard(index, state.memoryMatched.includes(name)));
    memoryBusy = false;
    app.querySelector('[data-action="peek"]').disabled = false;
    app.querySelector('#memory-caption').textContent = 'Теперь попробуй найти пары. Подсмотреть можно ещё раз.';
  }, 2400);
}

app.addEventListener('submit', event => {
  event.preventDefault();
  if (event.target.id === 'password-form') {
    const input = app.querySelector('#date-input');
    if (isWeddingDate(input.value)) complete('password', 0);
    else {
      const count = attempt('password');
      input.setAttribute('aria-invalid', 'true');
      feedback(input.value.trim() ? 'Конверт пока не открылся. Вспомни ещё немного — я никуда не тороплюсь ♡' : 'Напиши дату, которую подсказывает сердце ♡');
      if (count >= 2) showHint();
      input.focus();
    }
  }
  if (event.target.id === 'kiss-form') {
    const input = app.querySelector('#kiss-input');
    if (isKissDay(input.value)) { state.kissDateKnown = true; save(); render(); chime('tap'); say('12 августа. Верно. А где случился наш первый поцелуй?'); }
    else {
      const count = attempt('kiss');
      input.setAttribute('aria-invalid', 'true');
      feedback('Это был другой день. Наш август ещё подождёт — попробуй снова ♡');
      if (count >= 2) showHint();
      input.focus();
    }
  }
});

app.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button || button.disabled) return;
  if (button.dataset.go) { chime('tap'); go(button.dataset.go); return; }
  switch (button.dataset.action) {
    case 'yes': state.gateResult = 'yes'; save(); render(); burst(); chime(); break;
    case 'no':
      if (state.noAttempts < 5) moveNo();
      else { state.gateResult = 'catastrophe'; save(); render(); burst(); chime(); }
      break;
    case 'hint': showHint(); break;
    case 'camp':
      if (button.dataset.value === 'chaika') complete('camp', 1);
      else { const count = attempt('camp'); feedback(button.dataset.value === 'space' ? 'Чувства космические, это правда. Но познакомились мы всё-таки на Земле 😏' : 'Красивый сценарий. Но у нашей истории было другое начало ♡'); if (count >= 2) showHint(); }
      break;
    case 'kiss-place':
      if (button.dataset.value === 'church') complete('kiss', 2);
      else { attempt('kiss'); feedback('Важное место было другим. Подсказка: конгазская церковь ♡'); }
      break;
    case 'food': chooseFood(button); break;
    case 'serve':
      if (isDinnerCorrect(state.foods)) complete('dinner', 3);
      else { const count = attempt('dinner'); feedback(state.foods.length > 2 ? 'Котик оценил размах. Но у секретного меню ровно два любимых блюда 😏' : 'Вкусно выглядит. А теперь вспомни мой самый надёжный план на ужин ♡'); if (count >= 2) showHint(); }
      break;
    case 'joke':
      if (button.dataset.value === 'here') complete('joke', 4);
      else { const count = attempt('joke'); feedback(button.dataset.value === 'search' ? 'Так тоже стоит ответить. Но мы же сейчас вспоминаем мою фирменную шутку 😏' : 'Котик тут и уже готовится пошутить. Ещё одна попытка?'); if (count >= 2) showHint(); }
      break;
    case 'flip': flipCard(Number(button.dataset.index)); break;
    case 'peek': peekMemory(); break;
    case 'open-letter':
      button.disabled = true;
      app.querySelector('.envelope-scene').classList.add('is-opening');
      burst(); chime();
      later(() => go('letter'), reducedMotion.matches ? 80 : 1150);
      break;
    case 'save-letter': {
      const text = `Моя Вера.\n\n${letterParagraphs.join('\n\n')}\n\nТвой Дима ♡\n\nP. S. Подойди ко мне в другую комнату и загадай любое желание — я его исполню.`;
      const url = URL.createObjectURL(new Blob(['\uFEFF', text], { type: 'text/plain;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url; link.download = 'Письмо для Веры от Димы.txt';
      document.body.append(link); link.click(); link.remove();
      later(() => URL.revokeObjectURL(url), 1500);
      say('Письмо сохранено с любовью.');
      break;
    }
  }
});

function updateSoundButton() {
  const button = document.querySelector('#sound-button');
  button.innerHTML = icon(soundEnabled ? 'volume' : 'muted');
  button.setAttribute('aria-pressed', String(soundEnabled));
  button.setAttribute('aria-label', soundEnabled ? 'Выключить нежные звуки' : 'Включить нежные звуки');
}

document.querySelector('#sound-button').addEventListener('click', () => {
  soundEnabled = !soundEnabled;
  try { localStorage.setItem('dima-vera-sound', String(soundEnabled)); } catch { /* Optional preference. */ }
  updateSoundButton();
  if (soundEnabled) chime();
});

function askRestart() {
  if (state.stage !== 'home') restartDialog.showModal();
}

document.querySelector('#restart-button').addEventListener('click', askRestart);
document.querySelector('.wordmark').addEventListener('click', event => { event.preventDefault(); askRestart(); });
restartDialog.addEventListener('close', () => {
  if (restartDialog.returnValue !== 'restart') return;
  state = freshState();
  memoryDeck = [];
  go('home');
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && state.stage === 'gate') say('Убежать от любви можно только кнопкой «Нет» ♡');
});

updateSoundButton();
render();
