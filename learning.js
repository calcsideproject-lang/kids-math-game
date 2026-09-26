'use strict';
// 保護者向け分析の調整値。時間は制限ではなく、観察のためだけに使う。
const LEARNING = { history: 8, days: 14, sample: 5, minimum: 3, fastRun: 3,
  fastMs: 3000, comfortableMs: 10000, excludedMs: 30000, accuracy: 0.8, compareMinimum: 10 };
const freshLearning = () => ({ problems: {}, days: {} });
const problemKey = q => `${q.op}:${q.a}:${q.b}`;
function parseProblem(key) {
  const match = /^(addition|subtraction):(\d{1,2}):(\d{1,2})$/.exec(key);
  if (!match) return null;
  const [, op, left, right] = match, a = Number(left), b = Number(right);
  const answer = op === 'addition' ? a + b : a - b;
  return a <= 20 && b <= 20 && answer >= 0 && answer <= 20 ? { op, a, b, answer } : null;
}
const equationLabel = key => { const q = parseProblem(key); return `${q.a} ${q.op === 'addition' ? '+' : '−'} ${q.b}`; };
function dateOffset(date, amount) { const d = new Date(date); d.setDate(d.getDate() + amount); return dayKey(d); }
function pruneLearning(data, now = new Date()) {
  const oldest = dateOffset(now, 1 - LEARNING.days), today = dayKey(now);
  Object.keys(data.days).forEach(day => { if (!validDay(day) || day < oldest || day > today) delete data.days[day]; });
  return data;
}
function normalizeLearning(value) {
  const data = freshLearning();
  const samples = list => Array.isArray(list) ? list.filter(s => s && typeof s.correct === 'boolean').slice(-LEARNING.history).map(s => ({
    correct: s.correct, ms: Number.isFinite(s.ms) && s.ms >= 0 && s.ms < LEARNING.excludedMs ? s.ms : null,
    at: Number.isFinite(s.at) ? s.at : 0, answer: Number.isInteger(s.answer) ? s.answer : null
  })) : [];
  for (const [key, item] of Object.entries(value?.problems || {})) {
    if (!parseProblem(key) || !item) continue;
    data.problems[key] = { shown: safeCount(item.shown), correct: safeCount(item.correct), wrong: safeCount(item.wrong),
      lastShown: Number.isFinite(item.lastShown) ? item.lastShown : 0, history: samples(item.history) };
  }
  for (const [day, item] of Object.entries(value?.days || {})) {
    if (!validDay(day) || !item) continue;
    const entry = { plays: { addition: safeCount(item.plays?.addition), subtraction: safeCount(item.plays?.subtraction), mixed: safeCount(item.plays?.mixed) }, problems: {} };
    for (const [key, p] of Object.entries(item.problems || {})) if (parseProblem(key) && p) {
      entry.problems[key] = { n: safeCount(p.n), c: Math.min(safeCount(p.c), safeCount(p.n)), sum: safeCount(p.sum), t: Math.min(safeCount(p.t), safeCount(p.n)), tail: samples(p.tail).slice(-LEARNING.sample).map(s => ({ correct: s.correct, ms: s.ms })) };
    }
    data.days[day] = entry;
  }
  return pruneLearning(data);
}
function learningDay(date = new Date()) {
  pruneLearning(progressData.learning, date);
  return progressData.learning.days[dayKey(date)] ||= { plays: { addition: 0, subtraction: 0, mixed: 0 }, problems: {} };
}
let questionTimer = null;
let firstTiming = null;
function beginQuestionTiming(q, date = new Date()) {
  const key = problemKey(q);
  const record = progressData.learning.problems[key] ||= { shown: 0, correct: 0, wrong: 0, lastShown: 0, history: [] };
  record.shown++; record.lastShown = date.getTime();
  questionTimer = { start: performance.now(), wall: date.getTime(), interrupted: document.hidden };
  firstTiming = null;
  saveProgress();
}
function interruptQuestionTiming() {
  if (questionTimer && screen === 'game' && gameKind === 'math' && !answeredRecorded) questionTimer.interrupted = true;
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
  const sample = { correct, ms: firstTiming, at: date.getTime(), answer };
  record[correct ? 'correct' : 'wrong']++;
  record.history.push(sample); record.history = record.history.slice(-LEARNING.history);
  const day = learningDay(date);
  const summary = day.problems[key] ||= { n: 0, c: 0, sum: 0, t: 0, tail: [] };
  summary.n++; if (correct) summary.c++;
  if (sample.ms !== null) { summary.sum += sample.ms; summary.t++; }
  summary.tail.push({ correct: sample.correct, ms: sample.ms }); summary.tail = summary.tail.slice(-LEARNING.sample);
}
function mastery(history) {
  const recent = history.slice(-LEARNING.sample);
  if (recent.length < LEARNING.minimum) return 'collecting';
  const accuracy = recent.filter(s => s.correct).length / recent.length;
  const timed = recent.filter(s => s.ms !== null);
  if (accuracy < LEARNING.accuracy) return 'practice';
  if (timed.length < LEARNING.minimum) return 'collecting';
  if (recent.slice(-LEARNING.fastRun).every(s => s.correct && s.ms !== null && s.ms <= LEARNING.fastMs)) return 'fast';
  return timed.reduce((sum, s) => sum + s.ms, 0) / timed.length <= LEARNING.comfortableMs ? 'steady' : 'practice';
}
const masteryLabels = { collecting: 'データ収集中', fast: '◎ パッとできる', steady: '○ できている', practice: '△ もう少し練習' };
function reviewCandidates(pool) {
  const needs = Object.entries(progressData.learning.problems).filter(([, p]) => mastery(p.history) === 'practice').map(([key]) => parseProblem(key));
  return pool.filter(q => needs.some(p => p.op === q.op && calculationType(p) === calculationType(q) && Math.abs(p.a - q.a) + Math.abs(p.b - q.b) <= 2));
}
function periodReport(filter, offset = 0, date = new Date()) {
  const start = dateOffset(date, -6 - offset), end = dateOffset(date, -offset);
  const result = { plays: 0, n: 0, c: 0, sum: 0, t: 0, fast: 0, start, end, history: {} };
  for (const [day, entry] of Object.entries(progressData.learning.days).sort(([a], [b]) => a.localeCompare(b))) {
    if (day < start || day > end) continue;
    result.plays += filter === 'all' ? Object.values(entry.plays).reduce((a, b) => a + b, 0) : entry.plays[filter] + entry.plays.mixed;
    for (const [key, p] of Object.entries(entry.problems)) {
      if (filter !== 'all' && parseProblem(key).op !== filter) continue;
      result.n += p.n; result.c += p.c; result.sum += p.sum; result.t += p.t;
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
    ['遊んだ回数', `${now.plays}回`], ['解いた問題', `${now.n}問`], ['初回正解', `${now.c}問`], ['正答率', rate(now)],
    ['平均回答時間', average(now)], ['パッとできる問題', `${now.fast}種類`]
  ].map(([label, value]) => reportCard(label, value)));
  byId('report-samples').textContent = `時間の参考にした回答：${now.t}問 ／ 参考外：${now.n - now.t}問。時間は正誤を問わず有効な初回回答の平均です。`;
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
  const list = Object.entries(progressData.learning.problems).filter(([key]) => filter === 'all' || parseProblem(key).op === filter).sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }));
  byId('problem-report').replaceChildren(...list.map(([key, p]) => {
    const details = document.createElement('details'); details.className = 'problem-detail';
    const summary = document.createElement('summary'); summary.textContent = `${equationLabel(key)}　${masteryLabels[mastery(p.history)]}`;
    const totals = document.createElement('p'); totals.textContent = `出題 ${p.shown}回 ／ 初回正解 ${p.correct}回 ／ 初回不正解 ${p.wrong}回`;
    const last = document.createElement('p'); last.textContent = `最後の出題：${new Date(p.lastShown).toLocaleString('ja-JP')}`;
    const history = document.createElement('ul');
    p.history.forEach(s => { const li = document.createElement('li'); li.textContent = `${new Date(s.at).toLocaleDateString('ja-JP')}　${s.correct ? '○' : '×'}　回答 ${s.answer ?? '—'}　${seconds(s.ms)}`; history.append(li); });
    const timed = p.history.filter(s => s.ms !== null);
    const avg = document.createElement('p'); avg.textContent = `最近${p.history.length}回の平均：${timed.length ? seconds(timed.reduce((sum, s) => sum + s.ms, 0) / timed.length) : 'データ収集中'}（参考外を除く）`;
    details.append(summary, totals, last, history, avg); return details;
  }));
  if (!list.length) byId('problem-report').textContent = 'データ収集中です。これから遊んだ計算が表示されます。';
}
