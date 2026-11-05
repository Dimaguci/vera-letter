import test from 'node:test';
import assert from 'node:assert/strict';
import { isWeddingDate, isKissDay, isDinnerCorrect, shuffle, readState, SAVE_KEY, nextHint } from '../game-logic.js';

test('дата свадьбы принимается в привычных форматах, включая текст с телефона', () => {
  for (const value of ['31.10.2020', '31/10/2020', '31-10-20', '2020-10-31', '31 октября 2020 года', '31 Октября 2020 г.', '31102020']) assert.ok(isWeddingDate(value), value);
  for (const value of ['', '30.10.2020', '31.10.2021', '12.08.2016', '2020']) assert.equal(isWeddingDate(value), false, value);
});

test('день поцелуя допускает число, дату и название месяца', () => {
  for (const value of ['12', '12.08', '12 августа', '12 августа 2016', '12.08.2016']) assert.ok(isKissDay(value), value);
  for (const value of ['11', '13 августа', '12.09.2016']) assert.equal(isKissDay(value), false, value);
});

test('ужин требует оба любимых блюда без лишних продуктов', () => {
  assert.ok(isDinnerCorrect(['eggs', 'dumplings']));
  assert.ok(isDinnerCorrect(['dumplings', 'eggs']));
  assert.equal(isDinnerCorrect(['eggs']), false);
  assert.equal(isDinnerCorrect(['eggs', 'dumplings', 'salad']), false);
});

test('перемешивание сохраняет все пары и исходный массив', () => {
  const input = ['Дима', 'Дима', 'Вера', 'Вера', 'Сашка', 'Сашка', 'Евочка', 'Евочка'];
  const result = shuffle(input, () => 0.25);
  assert.deepEqual([...result].sort(), [...input].sort());
  assert.notDeepEqual(result, input);
  assert.equal(input[0], 'Дима');
});

test('повреждённое или недоступное сохранение не ломает приключение', () => {
  assert.equal(readState({ getItem: () => '{' }).stage, 'home');
  assert.equal(readState({ getItem: () => { throw new Error('storage blocked'); } }).stage, 'home');
  assert.equal(readState({ getItem: () => JSON.stringify({ stage: 'unknown' }) }).stage, 'home');
  const state = readState({ getItem: key => key === SAVE_KEY ? JSON.stringify({ stage: 'dinner', keys: [0, 0, 1, 99], foods: ['eggs', 'unknown'], attempts: null }) : null });
  assert.deepEqual(state.keys, [0, 1]);
  assert.deepEqual(state.foods, ['eggs']);
  assert.deepEqual(state.attempts, {});
});

test('подсказки заканчиваются ответом и остаются доступны без ограничений', () => {
  const hints = ['вспомни день', '31 октября 2020'];
  assert.deepEqual(nextHint(0, hints), { index: 1, text: hints[0] });
  assert.deepEqual(nextHint(1, hints), { index: 2, text: hints[1] });
  assert.deepEqual(nextHint(20, hints), { index: 2, text: hints[1] });
});
