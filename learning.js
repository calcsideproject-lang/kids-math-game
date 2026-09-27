'use strict';
// 保護者向け分析の調整値。時間は制限ではなく、観察のためだけに使う。
const LEARNING = { history: 8, days: 14, sample: 5, minimum: 3, fastRun: 3,
  fastMs: 3000, comfortableMs: 10000, excludedMs: 30000, accuracy: 0.8, compareMinimum: 10 };
const freshLearning = () => ({ problems: {}, days: {} });
const problemKey = q => q.operationType === 'three-number'
  ? `three-number:${q.a}:${q.op}:${q.b}:${q.op2}:${q.c}` : `${q.op}:${q.a}:${q.b}`;
const subtractionBorrowing = q => q.op === 'subtraction' && q.a % 10 < q.b % 10;
const calculateStep = (a, op, b) => op === 'addition' ? a + b : a - b;
function threeNumber(a, op, b, op2, c) {
  const middle = calculateStep(a, op, b), answer = calculateStep(middle, op2, c);
  return { operationType: 'three-number', a, b, c, op, op2, answer,
    firstStep: { a, op, b, answer: middle }, secondStep: { a: middle, op: op2, b: c, answer } };
}
function questionMetadata(q) {
  return { operationType: q.operationType || q.op, answer: q.answer,
    subtractionBorrowing: q.operationType === 'three-number'
      ? subtractionBorrowing(q.firstStep) || subtractionBorrowing(q.secondStep) : subtractionBorrowing(q),
    ...(q.operationType === 'three-number' ? { firstStep: q.firstStep, secondStep: q.secondStep } : {}) };
}
const stepLabel = q => `${q.a} ${q.op === 'addition' ? '+' : '−'} ${q.b}`;
const questionLabel = q => stepLabel(q) + (q.operationType === 'three-number' ? ` ${q.op2 === 'addition' ? '+' : '−'} ${q.c}` : '');
function matchesReport(q, filter) {
  if (filter === 'all') return true;
  if (filter === 'three-number') return q.operationType === filter;
  if (q.operationType === 'three-number') return false;
  return filter === 'borrowing' ? subtractionBorrowing(q) : q.op === filter;
}
function parseProblem(key) {
  const triple = /^three-number:(\d{1,2}):(addition|subtraction):(\d{1,2}):(addition|subtraction):(\d{1,2})$/.exec(key);
  if (triple) {
    const q = threeNumber(+triple[1], triple[2], +triple[3], triple[4], +triple[5]);
    return [q.a, q.b, q.c, q.firstStep.answer, q.answer].every(n => n >= 0 && n <= 20) ? q : null;
  }
  const match = /^(addition|subtraction):(\d{1,2}):(\d{1,2})$/.exec(key);
  if (!match) return null;
  const [, op, left, right] = match, a = Number(left), b = Number(right);
  const answer = op === 'addition' ? a + b : a - b;
  return a <= 20 && b <= 20 && answer >= 0 && answer <= 20 ? { op, a, b, answer } : null;
}
const equationLabel = key => questionLabel(parseProblem(key));
function dateOffset(date, amount) { const d = new Date(date); d.setDate(d.getDate() + amount); return dayKey(d); }
function pruneLearning(data, now = new Date()) {
  const oldest = dateOffset(now, 1 - LEARNING.days), today = dayKey(now);
  Object.keys(data.days).forEach(day => { if (!validDay(day) || day < oldest || day > today) delete data.days[day]; });
  return data;
}
function normalizeLearning(value) {
  const data = freshLearning();
  const samples = list => Array.isArray(list) ? list.filter(s => s && typeof s.correct === 'boolean').slice(-LEARNING.history).map(s => ({
    source: s.source === 'drive' ? 'drive' : 'math', hintUsed: s.hintUsed === true, correct: s.correct, ms: Number.isFinite(s.ms) && s.ms >= 0 && s.ms < LEARNING.excludedMs ? s.ms : null,
    at: Number.isFinite(s.at) ? s.at : 0, answer: Number.isInteger(s.answer) ? s.answer : null
  })) : [];
  for (const [key, item] of Object.entries(value?.problems || {})) {
    if (!parseProblem(key) || !item) continue;
    data.problems[key] = { ...questionMetadata(parseProblem(key)), shown: safeCount(item.shown), correct: safeCount(item.correct), wrong: safeCount(item.wrong),
      lastShown: Number.isFinite(item.lastShown) ? item.lastShown : 0, history: samples(item.history) };
  }
  for (const [day, item] of Object.entries(value?.days || {})) {
    if (!validDay(day) || !item) continue;
    const entry = { plays: { addition: safeCount(item.plays?.addition), subtraction: safeCount(item.plays?.subtraction), mixed: safeCount(item.plays?.mixed), 'three-number': safeCount(item.plays?.['three-number']) }, problems: {} };
    for (const [key, p] of Object.entries(item.problems || {})) if (parseProblem(key) && p) {
      entry.problems[key] = { hints: safeCount(p.hints), n: safeCount(p.n), c: Math.min(safeCount(p.c), safeCount(p.n)), sum: safeCount(p.sum), t: Math.min(safeCount(p.t), safeCount(p.n)), driveSum: safeCount(p.driveSum), driveT: safeCount(p.driveT), driveN: safeCount(p.driveN), tail: samples(p.tail).slice(-LEARNING.sample).map(s => ({ source: s.source === 'drive' ? 'drive' : 'math', hintUsed: s.hintUsed === true, correct: s.correct, ms: s.ms })) };
    }
    data.days[day] = entry;
  }
  return pruneLearning(data);
}
function learningDay(date = new Date()) {
  pruneLearning(progressData.learning, date);
  return progressData.learning.days[dayKey(date)] ||= { plays: { addition: 0, subtraction: 0, mixed: 0, 'three-number': 0 }, problems: {} };
}
let questionTimer = null;
let firstTiming = null;
let hintUsed = false;
let hintStage = 0;
function beginQuestionTiming(q, date = new Date()) {
  const key = problemKey(q);
  const record = progressData.learning.problems[key] ||= { shown: 0, correct: 0, wrong: 0, lastShown: 0, history: [] };
  Object.assign(record, questionMetadata(q));
  hintUsed = false; hintStage = 0;
  record.shown++; record.lastShown = date.getTime();
  questionTimer = { start: performance.now(), wall: date.getTime(), interrupted: document.hidden };
  firstTiming = null;
  saveProgress();
}
function interruptQuestionTiming() {
  if (questionTimer && ['game', 'drive'].includes(screen) && ['math', 'drive'].includes(gameKind) && !answeredRecorded) questionTimer.interrupted = true;
}
function readQuestionTiming(now = performance.now(), wall = Date.now()) {
  if (!questionTimer) return null;
  const elapsed = now - questionTimer.start, realElapsed = wall - questionTimer.wall;
  if (questionTimer.interrupted || document.hidden || elapsed < 0 || elapsed >= LEARNING.excludedMs || realElapsed < 0 || realElapsed >= LEARNING.excludedMs || Math.abs(realElapsed - elapsed) > 2000) return null;
  return Math.round(elapsed);
}
function recordLearningAnswer(q, answer, correct, date = new Date()) {
  const key = problemKey(q), record = progressData.learning.problems[key];
  firstTiming = readQuestionTiming(performance.now(), date.getTime());
  const sample = { source: gameKind === 'drive' ? 'drive' : 'math', hintUsed, correct, ms: firstTiming, at: date.getTime(), answer };
  record[correct ? 'correct' : 'wrong']++;
  record.history.push(sample); record.history = record.history.slice(-LEARNING.history);
  const day = learningDay(date);
  const summary = day.problems[key] ||= { n: 0, c: 0, sum: 0, t: 0, tail: [] };
  summary.hints = (summary.hints || 0) + Number(hintUsed);
  summary.n++; if (correct) summary.c++;
  if (sample.source === 'drive') {
    summary.driveN = (summary.driveN || 0) + 1;
    if (sample.ms !== null) { summary.driveSum = (summary.driveSum || 0) + sample.ms; summary.driveT = (summary.driveT || 0) + 1; }
  } else if (sample.ms !== null) { summary.sum += sample.ms; summary.t++; }
  summary.tail.push({ correct: sample.correct, ms: sample.ms, source: sample.source, hintUsed: sample.hintUsed }); summary.tail = summary.tail.slice(-LEARNING.sample);
}
function mastery(history) {
  const recent = history.slice(-LEARNING.sample);
  if (recent.length < LEARNING.minimum) return 'collecting';
  const accuracy = recent.filter(s => s.correct).length / recent.length;
  const normal = history.filter(s => s.source !== 'drive').slice(-LEARNING.sample);
  const timed = normal.filter(s => s.ms !== null);
  if (accuracy < LEARNING.accuracy) return 'practice';
  if (timed.length < LEARNING.minimum) return 'collecting';
  if (normal.slice(-LEARNING.fastRun).every(s => !s.hintUsed && s.correct && s.ms !== null && s.ms <= LEARNING.fastMs)) return 'fast';
  return timed.reduce((sum, s) => sum + s.ms, 0) / timed.length <= LEARNING.comfortableMs ? 'steady' : 'practice';
}
const masteryLabels = { collecting: 'データ収集中', fast: '◎ パッとできる', steady: '○ できている', practice: '△ もう少し練習' };
function reviewCandidates(pool) {
  const needs = Object.entries(progressData.learning.problems).filter(([, p]) => mastery(p.history) === 'practice').map(([key]) => parseProblem(key));
  return pool.filter(q => needs.some(p => p.op === q.op && calculationType(p) === calculationType(q) && p.op2 === q.op2 && Math.abs(p.a - q.a) + Math.abs(p.b - q.b) + Math.abs((p.c || 0) - (q.c || 0)) <= 2));
}
function periodReport(filter, offset = 0, date = new Date()) {
  const start = dateOffset(date, -6 - offset), end = dateOffset(date, -offset);
  const result = { plays: 0, hints: 0, n: 0, c: 0, sum: 0, t: 0, fast: 0, driveSum: 0, driveT: 0, driveN: 0, start, end, history: {} };
  for (const [day, entry] of Object.entries(progressData.learning.days).sort(([a], [b]) => a.localeCompare(b))) {
    if (day < start || day > end) continue;
    result.plays += filter === 'all' ? Object.values(entry.plays).reduce((a, b) => a + b, 0) : filter === 'borrowing' ? 0 : (entry.plays[filter] || 0) + (['addition', 'subtraction'].includes(filter) ? entry.plays.mixed || 0 : 0);
    for (const [key, p] of Object.entries(entry.problems)) {
      if (!matchesReport(parseProblem(key), filter)) continue;
      result.hints += p.hints || 0;
      result.n += p.n; result.c += p.c; result.sum += p.sum; result.t += p.t; result.driveSum += p.driveSum || 0; result.driveT += p.driveT || 0; result.driveN += p.driveN || 0;
      result.history[key] = [...(result.history[key] || []), ...p.tail].slice(-LEARNING.sample);
    }
  }
  result.fast = Object.values(result.history).filter(h => mastery(h) === 'fast').length;
  return result;
}
const seconds = ms => ms === null ? '参考外' : `${(ms / 1000).toFixed(1)}秒`;
const rate = p => p.n ? `${Math.round(p.c / p.n * 100)}%` : 'データ収集中';
const average = p => p.t ? seconds(p.sum / p.t) : 'データ収集中';
function reportCard(label, value) {
  const card = document.createElement('div'); card.className = 'report-stat';
  const name = document.createElement('span'); name.textContent = label;
  const number = document.createElement('strong'); number.textContent = value;
  card.append(name, number); return card;
}
function renderReport() {
  const filter = byId('report-filter').value;
  const now = periodReport(filter), before = periodReport(filter, 7);
  byId('report-period').textContent = `${now.start} 〜 ${now.end}（今日を含む7日間）`;
  byId('report-summary').replaceChildren(...[
    [filter === 'borrowing' ? '集計対象' : '遊んだ回数', filter === 'borrowing' ? 'くり下がりのひき算' : `${now.plays}回`], ['解いた問題', `${now.n}問`], ['初回正解', `${now.c}問`], ['正答率', rate(now)],
    ['平均回答時間', average(now)], ['パッとできる問題', `${now.fast}種類`]
  ].map(([label, value]) => reportCard(label, value)));
  byId('report-samples').textContent = `ヒント使用：${now.hints}回。時間の参考にした回答：${now.t}問 ／ 通常の参考外：${now.n - now.driveN - now.t}問。平均回答時間・速度判定は通常モードのみ。ドライブ：${now.driveN}問、平均 ${now.driveT ? seconds(now.driveSum / now.driveT) : 'データ収集中'}（有効${now.driveT}問）。`;
  const enough = now.n >= LEARNING.compareMinimum && before.n >= LEARNING.compareMinimum;
  byId('report-comparison').replaceChildren();
  byId('report-growth').textContent = 'もう少し遊ぶと成長の変化が表示されます。';
  if (enough) {
    byId('report-comparison').append(reportCard('正答率：前の7日 → 最近7日', `${rate(before)} → ${rate(now)}`));
    if (now.t >= LEARNING.compareMinimum && before.t >= LEARNING.compareMinimum) {
      byId('report-comparison').append(reportCard('平均時間：前 → 最近', `${average(before)} → ${average(now)}`));
    }
    const collected = p => Object.values(p.history).filter(h => mastery(h) !== 'collecting').length;
    if (collected(now) && collected(before)) byId('report-comparison').append(reportCard('パッとできる種類：前 → 最近', `${before.fast} → ${now.fast}`));
    byId('report-growth').textContent = collected(now) && collected(before) && now.fast > before.fast
      ? `最近7日間は、パッとできる問題が${now.fast - before.fast}種類多く記録されています。`
      : '自分のペースで積み重ねています。出題された問題が違うため、数値は観察の目安です。';
  }
  const list = Object.entries(progressData.learning.problems).filter(([key]) => matchesReport(parseProblem(key), filter)).sort(([a, pa], [b, pb]) => ['borrowing', 'three-number'].includes(filter) ? pb.lastShown - pa.lastShown : a.localeCompare(b, undefined, { numeric: true }));
  byId('problem-report').replaceChildren(...list.map(([key, p]) => {
    const details = document.createElement('details'); details.className = 'problem-detail';
    const summary = document.createElement('summary'); summary.textContent = `${equationLabel(key)}　${masteryLabels[mastery(p.history)]}`;
    const totals = document.createElement('p'); totals.textContent = `出題 ${p.shown}回 ／ 初回正解 ${p.correct}回 ／ 初回不正解 ${p.wrong}回`;
    const last = document.createElement('p'); last.textContent = `最後の出題：${new Date(p.lastShown).toLocaleString('ja-JP')}`;
    const history = document.createElement('ul');
    p.history.forEach(s => { const li = document.createElement('li'); li.textContent = `${new Date(s.at).toLocaleDateString('ja-JP')}　${s.source === 'drive' ? 'ドライブ' : '通常'}　${s.correct ? '○' : '×'}　回答 ${s.answer ?? '—'}　${seconds(s.ms)}${s.hintUsed ? ' ／ ヒントあり' : ''}`; history.append(li); });
    const timed = p.history.filter(s => s.source !== 'drive' && s.ms !== null);
    const driven = p.history.filter(s => s.source === 'drive' && s.ms !== null);
    const avg = document.createElement('p'); avg.textContent = `最近${p.history.length}回の平均：${timed.length ? seconds(timed.reduce((sum, s) => sum + s.ms, 0) / timed.length) : 'データ収集中'}（通常のみ・参考外を除く）。ドライブ平均：${driven.length ? seconds(driven.reduce((sum, s) => sum + s.ms, 0) / driven.length) : 'データ収集中'}`;
    details.append(summary, totals, last, history, avg); return details;
  }));
  if (!list.length) byId('problem-report').textContent = 'データ収集中です。これから遊んだ計算が表示されます。';
}
