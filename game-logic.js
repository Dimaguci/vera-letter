export const KEY_COUNT = 6;
export const SAVE_KEY = 'dima-vera-love-letter-v1';
export const STAGES = ['home', 'prologue', 'gate', 'password', 'camp', 'kiss', 'dinner', 'joke', 'family', 'envelope', 'letter', 'wish', 'ending'];

export function normalize(value) {
  return String(value ?? '').toLowerCase().replaceAll('ё', 'е').replace(/[^а-яa-z0-9]/g, '');
}

export function isWeddingDate(value) {
  return ['31102020', '20201031', '311020', '31октября2020', '31октябрь2020', '31октября20', '31октября2020года', '31октября2020г'].includes(normalize(value));
}

export function isKissDay(value) {
  return ['12', '1208', '12082016', '20160812', '12августа', '12августа2016', '12августа2016года'].includes(normalize(value));
}

export function isDinnerCorrect(foods) {
  const selected = new Set(foods);
  return selected.size === 2 && selected.has('eggs') && selected.has('dumplings');
}

export function shuffle(values, random = Math.random) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

export function freshState() {
  return { stage: 'home', keys: [], attempts: {}, hints: {}, completed: [], foods: [], gateResult: '', noAttempts: 0, memoryMatched: [] };
}

export function readState(storage) {
  try {
    const saved = JSON.parse(storage.getItem(SAVE_KEY));
    if (!saved || !STAGES.includes(saved.stage)) return freshState();
    const state = { ...freshState(), ...saved };
    state.keys = [...new Set(Array.isArray(saved.keys) ? saved.keys.filter(k => Number.isInteger(k) && k >= 0 && k < KEY_COUNT) : [])];
    state.completed = Array.isArray(saved.completed) ? saved.completed.filter(s => STAGES.includes(s)) : [];
    state.foods = Array.isArray(saved.foods) ? saved.foods.filter(f => ['eggs', 'dumplings', 'salad', 'sushi', 'broccoli'].includes(f)) : [];
    state.memoryMatched = Array.isArray(saved.memoryMatched) ? saved.memoryMatched.filter(n => ['Дима', 'Вера', 'Сашка', 'Евочка'].includes(n)) : [];
    state.attempts = saved.attempts && typeof saved.attempts === 'object' && !Array.isArray(saved.attempts) ? saved.attempts : {};
    state.hints = saved.hints && typeof saved.hints === 'object' && !Array.isArray(saved.hints) ? saved.hints : {};
    state.noAttempts = Number.isInteger(saved.noAttempts) ? Math.min(5, Math.max(0, saved.noAttempts)) : 0;
    return state;
  } catch {
    return freshState();
  }
}

export function nextHint(current, hints) {
  return { index: Math.min(current + 1, hints.length), text: hints[Math.min(current, hints.length - 1)] };
}
