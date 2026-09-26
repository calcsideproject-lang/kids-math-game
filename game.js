'use strict';

const byId = id => document.getElementById(id);
const praise = ['せいかい！', 'すごい！', 'やったね！', 'よく できたね！', 'ばっちり！'];
let mode = 'addition';
let activeLevel = 1;
let gameKind = 'math';
const clockLevels = [
  { id: 1, title: '○じ ちょうど', minutes: [0], type: 'hour' },
  { id: 2, title: '○じ はん', minutes: [30], type: 'half' }
];
const freshClock = () => ({ enabled: [true, false], cleared: [], medal: false,
  stats: { plays: 0, answered: 0, correct: 0 }, errors: { hour: 0, half: 0 } });
let answeredRecorded = false;
const levels = [
  { id: 1, limit: 10, mode: 'addition', title: '10までの たしざん', icon: '🌱' },
  { id: 2, limit: 10, mode: 'subtraction', title: '10までの ひきざん', icon: '🌷' },
  { id: 3, limit: 20, mode: 'addition', title: '20までの たしざん', icon: '🌳' },
  { id: 4, limit: 20, mode: 'subtraction', title: '20までの ひきざん', icon: '⛰️' },
  { id: 5, limit: 20, mode: 'mixed', title: '20までの ミックス', icon: '🏰' }
];
const categoryNames = {
  'addition-small': '10以内のたし算', 'addition-large': '20以内のたし算（繰り上がりなし）',
  'addition-cross': '繰り上がりのあるたし算', 'subtraction-small': '10以内のひき算',
  'subtraction-large': '20以内のひき算（繰り下がりなし）', 'subtraction-cross': '繰り下がりのあるひき算'
};
let questions = [];
let questionIndex = 0;
let firstTryCorrect = 0;
let madeMistake = false;
let solved = false;
let input = '';
let replaceInput = false;
let screen = 'home';
let confettiTimer;
let parentVerified = false;
let parentQuestion = null;
let previousParentQuestion = '';

function clearCelebration() {
  window.clearTimeout(confettiTimer);
  byId('confetti').replaceChildren();
}

function showReward() {
  clearCelebration();
  const count = earnedStars(firstTryCorrect);
  const stars = byId('reward-stars');
  stars.setAttribute('aria-label', `ほしを ${count}こ もらったよ！`);
  stars.replaceChildren(...Array.from({ length: count }, (_, i) => {
    const star = document.createElement('span');
    star.className = 'reward-star';
    star.textContent = '⭐';
    star.setAttribute('aria-hidden', 'true');
    star.style.animationDelay = `${i * 350}ms`;
    return star;
  }));
  byId('perfect').hidden = firstTryCorrect !== 10;
  byId('reward-message').textContent = firstTryCorrect === 10
    ? 'パーフェクト！てんさい！🏆'
    : firstTryCorrect >= 8 ? 'すごい！あとちょっとでパーフェクト！🌟'
    : firstTryCorrect >= 5 ? 'よくがんばったね！✨'
    : 'さいごまでがんばったね！😊';

  // 動きを減らす設定では、星と特別なメッセージを静かに表示する。
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const colors = ['#e9b85c', '#eaa6a2', '#83baa3', '#aaa0ce'];
  const pieces = Array.from({ length: firstTryCorrect === 10 ? 28 : 16 }, (_, i) => {
    const piece = document.createElement('span');
    piece.className = 'confetti-piece';
    piece.style.left = `${3 + Math.random() * 94}%`;
    piece.style.backgroundColor = colors[i % colors.length];
    piece.style.animationDelay = `${Math.random() * 600}ms`;
    piece.style.setProperty('--drift', `${Math.random() * 100 - 50}px`);
    return piece;
  });
  byId('confetti').replaceChildren(...pieces);
  // 有限のCSSアニメーションと一度だけのタイマーで、要素も片付ける。
  confettiTimer = window.setTimeout(clearCelebration, 3600);
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// 最多でも2問だけを最近の傾向から選び、残りはランダムにする。
function calculationType(q) {
  const crossing = q.op === 'addition' ? q.a % 10 + q.b % 10 >= 10 : q.a % 10 < q.b % 10;
  return `${q.op}-${crossing ? 'cross' : Math.max(q.a, q.b, q.answer) <= 10 ? 'small' : 'large'}`;
}
function recentTrends() {
  const counts = {};
  progressData.recent.forEach(item => {
    if (!item.correct) counts[item.type] = (counts[item.type] || 0) + 1;
  });
  return Object.entries(counts).sort((a, b) => b[1] - a[1]);
}
function createQuestions(operation, limit = 10) {
  const pool = [];
  for (let a = 0; a <= limit; a++) for (let b = 0; b <= limit; b++) {
    if (operation !== 'subtraction' && a + b <= limit) pool.push({ a, b, op: 'addition', answer: a + b });
    if (operation !== 'addition' && a >= b) pool.push({ a, b, op: 'subtraction', answer: a - b });
  }
  const trend = recentTrends().find(([type, count]) => count >= 2 && pool.some(q => calculationType(q) === type));
  const review = reviewCandidates(pool);
  const selected = review.length ? shuffle(review).slice(0, 2) : trend ? shuffle(pool.filter(q => calculationType(q) === trend[0])).slice(0, 2) : [];
  const remaining = shuffle(pool.filter(q => !selected.includes(q)));
  if (operation === 'mixed') {
    // ミックスでは必ずたし算・ひき算を5問ずつ出す。
    for (const op of ['addition', 'subtraction']) selected.push(...remaining.filter(q => q.op === op).slice(0, 5 - selected.filter(q => q.op === op).length));
  } else selected.push(...remaining.slice(0, 10 - selected.length));
  return shuffle(selected);
}

function showScreen(name) {
  if (['settings', 'report'].includes(name) && !parentVerified) return;
  if (name === 'home') parentVerified = false;
  if (name !== 'result') clearCelebration();
  screen = name;
  ['home', 'game', 'result', 'collection', 'settings', 'report'].forEach(id => { byId(id).hidden = id !== name; });
  byId('open-settings').hidden = name !== 'home';
  if (name === 'home') renderHome();
  window.scrollTo(0, 0);
}

function startGame(selection) {
  const id = typeof selection === 'number' ? selection : selection === 'subtraction' ? 2 : 1;
  const level = levels.find(item => item.id === id);
  if (!level || !progressData.enabled[id - 1]) return;
  gameKind = 'math';
  activeLevel = id;
  mode = level.mode;
  questions = createQuestions(mode, level.limit);
  progressData.stats.plays++;
  learningDay().plays[mode]++;
  saveProgress();
  prepareAudio();
  questionIndex = 0;
  firstTryCorrect = 0;
  byId('game-title').textContent = `レベル ${activeLevel} ・ ${level.title}`;
  showScreen('game');
  renderQuestion();
}

function updateInput() {
  byId('answer').textContent = input || '？';
  byId('check').disabled = !input || solved;
}

function renderQuestion() {
  input = '';
  replaceInput = false;
  solved = false;
  madeMistake = false;
  answeredRecorded = false;
  const question = questions[questionIndex];
  const isClock = gameKind === 'clock';
  byId('clock-question').hidden = !isClock;
  byId('math-prompt').hidden = isClock;
  byId('math-equation').hidden = isClock;
  byId('keypad').hidden = isClock;
  if (isClock) renderClockQuestion(question);
  byId('problem').textContent = `${question.a} ${question.op === 'addition' ? '＋' : '−'} ${question.b}`;
  byId('question-count').textContent = `${questionIndex + 1} / 10 もん`;
  byId('progress').value = questionIndex;
  byId('progress').textContent = `${questionIndex} / 10`;
  byId('feedback').textContent = isClock ? 'こたえを えらんでね' : 'すうじを おしてね';
  byId('feedback').className = 'feedback';
  byId('check').hidden = isClock;
  byId('next').hidden = true;
  document.querySelectorAll('#keypad button').forEach(button => { button.disabled = false; });
  updateInput();
  if (!isClock) beginQuestionTiming(question);
}

function enterDigit(digit) {
  if (screen !== 'game' || solved || gameKind === 'clock') return;
  if (replaceInput || input === '0') input = '';
  replaceInput = false;
  if (input.length >= 2) return;
  input += digit;
  byId('feedback').textContent = '「こたえる」を おしてね';
  byId('feedback').className = 'feedback';
  updateInput();
}

function editInput(clearAll) {
  if (screen !== 'game' || solved || gameKind === 'clock') return;
  input = clearAll ? '' : input.slice(0, -1);
  replaceInput = false;
  updateInput();
}

function checkAnswer() {
  if (screen !== 'game' || solved || input === '') return;
  if (!answeredRecorded) {
    answeredRecorded = true;
    const correct = Number(input) === questions[questionIndex].answer;
    if (gameKind === 'clock') {
      progressData.clock.stats.answered++;
      if (correct) progressData.clock.stats.correct++;
      else progressData.clock.errors[questions[questionIndex].type]++;
    } else {
      recordLearningAnswer(questions[questionIndex], Number(input), correct);
      progressData.stats.answered++;
      if (correct) progressData.stats.correct++;
      progressData.recent.push({ type: calculationType(questions[questionIndex]), correct });
      progressData.recent = progressData.recent.slice(-60);
    }
    saveProgress();
  }
  if (Number(input) !== questions[questionIndex].answer) {
    madeMistake = true;
    replaceInput = true;
    byId('feedback').textContent = gameKind === 'clock' ? 'もういちど よくみてみよう！' : 'もういちど！';
    byId('feedback').className = 'feedback retry';
    return;
  }
  solved = true;
  playSound('correct');
  if (!madeMistake) firstTryCorrect++;
  const messages = gameKind === 'clock' ? ['せいかい！', 'とけいマスター！', 'よく みつけたね！'] : praise;
  byId('feedback').textContent = messages[Math.floor(Math.random() * messages.length)];
  if (gameKind === 'math' && !madeMistake && firstTiming !== null && firstTiming <= LEARNING.fastMs) byId('feedback').textContent = '⚡ パッとできた！';
  if (gameKind === 'clock') {
    byId('clock-face').classList.add('clock-success');
    document.querySelectorAll('#clock-choices button').forEach(button => { button.disabled = true; });
  }
  byId('feedback').className = 'feedback success';
  byId('progress').value = questionIndex + 1;
  byId('progress').textContent = `${questionIndex + 1} / 10`;
  document.querySelectorAll('#keypad button').forEach(button => { button.disabled = true; });
  byId('check').hidden = true;
  byId('next').textContent = questionIndex === 9 ? 'けっかを みる →' : 'つぎの もんだい →';
  byId('next').hidden = false;
  byId('next').focus({ preventScroll: true });
}

function nextQuestion() {
  if (screen !== 'game' || !solved) return;
  questionIndex++;
  if (questionIndex === 10) {
    byId('score').textContent = gameKind === 'clock' ? 'とけいマスター！ 🕰️✨' : 'きょうも ひとつ つよくなったね！';
    awardCompletion();
    showScreen('result');
    showReward();
    playSound('clear');
    byId('result-title').focus({ preventScroll: true });
  } else {
    renderQuestion();
    document.querySelector(gameKind === 'clock' ? '#clock-choices button' : '[data-digit="1"]').focus({ preventScroll: true });
  }
}

document.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => startGame(button.dataset.mode)));
document.querySelectorAll('[data-digit]').forEach(button => button.addEventListener('click', () => enterDigit(button.dataset.digit)));
byId('clear').addEventListener('click', () => editInput(true));
byId('backspace').addEventListener('click', () => editInput(false));
byId('check').addEventListener('click', checkAnswer);
byId('next').addEventListener('click', nextQuestion);
byId('again').addEventListener('click', () => gameKind === 'clock' ? startClock(activeLevel) : startGame(activeLevel));
byId('go-home').addEventListener('click', () => showScreen('home'));
byId('choose-mode').addEventListener('click', () => showScreen('home'));

// パソコンでは数字キー、Backspace、Enterでも操作できる。
document.addEventListener('keydown', event => {
  if (screen !== 'game' || gameKind === 'clock' || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
  if (/^[0-9]$/.test(event.key)) { event.preventDefault(); enterDigit(event.key); }
  else if (event.key === 'Backspace' || event.key === 'Delete') { event.preventDefault(); editInput(event.key === 'Delete'); }
  else if (event.key === 'Enter' && !event.repeat) {
    // ボタン上のEnterは標準のクリックに任せる（二重進行を防ぐ）。
    if (document.activeElement?.tagName === 'BUTTON') return;
    event.preventDefault();
    if (solved) nextQuestion(); else checkAnswer();
  }
});

// 星・日付・設定と、個人情報を含まない学習の集計を保存する。コレクションは星の合計から求める。
const STORAGE_KEY = 'kids-math-game.progress.v1';
const friends = [
  { stars: 5, icon: '🐣', name: 'ひよこ' },
  { stars: 10, icon: '🐰', name: 'うさぎ' },
  { stars: 20, icon: '🐼', name: 'パンダ' },
  { stars: 30, icon: '🦁', name: 'ライオン' },
  { stars: 50, icon: '👑', name: 'おうかん' }
];
const freshProgress = () => ({ stars: 0, lastDay: '', streak: 0, sound: false,
  enabled: [true, true, false, false, false], cleared: [],
  stats: { plays: 0, answered: 0, correct: 0 }, recent: [], clock: freshClock(), learning: freshLearning() });
const safeCount = value => Number.isSafeInteger(value) && value >= 0 ? value : 0;
function dayKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function yesterdayKey(date = new Date()) {
  const yesterday = new Date(date);
  yesterday.setDate(yesterday.getDate() - 1);
  return dayKey(yesterday);
}
function validDay(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00`);
  return !Number.isNaN(date.getTime()) && dayKey(date) === value;
}
function loadProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved || typeof saved !== 'object') return freshProgress();
    return {
      stars: Number.isSafeInteger(saved.stars) && saved.stars >= 0 ? saved.stars : 0,
      lastDay: validDay(saved.lastDay) ? saved.lastDay : '',
      streak: validDay(saved.lastDay) && Number.isSafeInteger(saved.streak) && saved.streak > 0 ? saved.streak : 0,
      sound: saved.sound === true,
      clock: normalizeClock(saved.clock),
      learning: normalizeLearning(saved.learning),
      enabled: levels.map((_, i) => typeof saved.enabled?.[i] === 'boolean' ? saved.enabled[i] : i < 2),
      cleared: Array.isArray(saved.cleared) ? [...new Set(saved.cleared.filter(id => levels.some(level => level.id === id)))] : [],
      stats: { plays: safeCount(saved.stats?.plays), answered: safeCount(saved.stats?.answered),
        correct: Math.min(safeCount(saved.stats?.correct), safeCount(saved.stats?.answered)) },
      recent: Array.isArray(saved.recent) ? saved.recent.filter(item => item && Object.hasOwn(categoryNames, item.type) && typeof item.correct === 'boolean').slice(-60).map(item => ({ type: item.type, correct: item.correct })) : []
    };
  } catch (_) { byId('storage-notice').hidden = false; return freshProgress(); }
}
let progressData = loadProgress();
function saveProgress() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(progressData)); byId('storage-notice').hidden = true; }
  catch (_) { byId('storage-notice').hidden = false; }
}
function earnedStars(score) { return score >= 8 ? 3 : score >= 5 ? 2 : 1; }
function renderHome(date = new Date()) {
  const today = dayKey(date);
  renderLevels();
  renderClockLevels();
  byId('total-stars').textContent = progressData.stars;
  byId('daily-message').textContent = progressData.lastDay === today ? 'きょうのチャレンジ クリア！' : 'きょうも さんすう やってみよう！';
  const continuing = progressData.lastDay === today || progressData.lastDay === yesterdayKey(date);
  byId('streak-message').textContent = continuing && progressData.streak > 0
    ? `🔥 ${progressData.streak}にち れんぞく！`
    : progressData.lastDay ? 'きょうから また はじめよう！' : '10もんで きょうのチャレンジ クリア！';
  byId('sound-toggle').textContent = progressData.sound ? '🔊 おと ON' : '🔇 おと OFF';
  byId('sound-toggle').setAttribute('aria-pressed', String(progressData.sound));
}
function awardCompletion(date = new Date()) {
  const previousStars = progressData.stars;
  const count = earnedStars(firstTryCorrect);
  const today = dayKey(date);
  const firstToday = progressData.lastDay !== today;
  progressData.stars += count;
  const firstClockClear = gameKind === 'clock' && !progressData.clock.medal;
  if (gameKind === 'clock') {
    progressData.clock.medal = true;
    if (!progressData.clock.cleared.includes(activeLevel)) progressData.clock.cleared.push(activeLevel);
  } else if (!progressData.cleared.includes(activeLevel)) progressData.cleared.push(activeLevel);
  if (firstToday) {
    progressData.streak = progressData.lastDay === yesterdayKey(date) ? progressData.streak + 1 : 1;
    progressData.lastDay = today;
  }
  saveProgress();
  byId('earned-stars').textContent = `すごい！ほしを ${count}こ ゲット！`;
  byId('daily-result').textContent = firstToday ? 'きょうのチャレンジ クリア！' : 'また できたね！ ほしが ふえたよ！';
  const unlocked = friends.filter(friend => previousStars < friend.stars && progressData.stars >= friend.stars);
  byId('new-friends').replaceChildren(...unlocked.map(friend => {
    const card = document.createElement('div');
    card.className = 'new-friend';
    const icon = document.createElement('span'); icon.className = 'friend-icon'; icon.textContent = friend.icon;
    const message = document.createElement('p'); message.textContent = `やったー！あたらしい なかま！ ${friend.name}`;
    card.append(icon, message); return card;
  }));
  if (firstClockClear) {
    const medal = document.createElement('div'); medal.className = 'new-friend';
    medal.textContent = '🕰️ やったー！ とけいメダルを ゲット！';
    byId('new-friends').append(medal);
  }
  const latestFriend = friends.filter(friend => friend.stars <= progressData.stars).at(-1);
  // 毎回要素を作り直し、連続プレイでもアニメーションを再生する。
  const character = document.createElement('span'); character.textContent = latestFriend ? latestFriend.icon : '🐰';
  byId('celebration-character').replaceChildren(character);
}
function renderCollection() {
  byId('collection-total').textContent = `⭐ あつめたほし：${progressData.stars}こ`;
  byId('collection-grid').replaceChildren(...friends.map(friend => {
    const unlocked = progressData.stars >= friend.stars;
    const card = document.createElement('div'); card.className = 'friend-card';
    const icon = document.createElement('span'); icon.className = 'friend-icon'; icon.textContent = unlocked ? friend.icon : '？';
    const name = document.createElement('strong'); name.textContent = unlocked ? friend.name : 'おたのしみ';
    const caption = document.createElement('p'); caption.textContent = unlocked ? 'なかまに なったよ！' : `あと ${friend.stars - progressData.stars}この ほしで ゲット！`;
    card.append(icon, name, caption); return card;
  }));
  const medal = document.createElement('div'); medal.className = 'friend-card';
  const icon = document.createElement('span'); icon.className = 'friend-icon'; icon.textContent = progressData.clock.medal ? '🕰️' : '？';
  const name = document.createElement('strong'); name.textContent = 'とけいメダル';
  const text = document.createElement('p'); text.textContent = progressData.clock.medal ? 'とけいマスター！' : 'とけいを 10もん クリアで ゲット！';
  medal.append(icon, name, text); byId('collection-grid').append(medal);
}

let audioContext;
const activeSounds = new Set();
function stopSounds() {
  activeSounds.forEach(oscillator => { try { oscillator.stop(); } catch (_) {} });
  activeSounds.clear();
}
function prepareAudio() {
  if (!progressData.sound) return;
  try {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) throw new Error('Audio unavailable');
    if (!audioContext) audioContext = new Context();
    if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
  } catch (_) {
    progressData.sound = false; saveProgress(); renderHome();
    byId('sound-toggle').textContent = '🔇 おとは つかえません';
  }
}
function playSound(kind) {
  if (!progressData.sound || document.hidden) return;
  prepareAudio();
  if (!audioContext || audioContext.state !== 'running') return;
  const notes = kind === 'clear' ? [523.25, 659.25, 783.99, 1046.5] : [659.25, 880];
  try {
    notes.forEach((frequency, index) => {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const start = audioContext.currentTime + index * 0.13;
      oscillator.type = 'sine'; oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.055, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.18);
      oscillator.connect(gain); gain.connect(audioContext.destination);
      activeSounds.add(oscillator);
      oscillator.onended = () => { activeSounds.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
      oscillator.start(start); oscillator.stop(start + 0.2);
    });
  } catch (_) { stopSounds(); }
}
byId('sound-toggle').addEventListener('click', () => {
  progressData.sound = !progressData.sound;
  saveProgress(); renderHome();
  if (progressData.sound) prepareAudio(); else stopSounds();
});
// 音の初期化はユーザー操作時だけ行い、ページを開いただけでは鳴らさない。
document.querySelectorAll('[data-mode], #again').forEach(button => button.addEventListener('click', prepareAudio));
byId('open-collection').addEventListener('click', () => { renderCollection(); showScreen('collection'); });
byId('collection-home').addEventListener('click', () => showScreen('home'));
byId('open-settings').addEventListener('click', openParentGate);
byId('settings-home').addEventListener('click', () => showScreen('home'));
let resetScope = 'all';
function requestReset(scope) {
  resetScope = scope;
  byId('reset-description').textContent = scope === 'learning' ? '計算・時計の学習記録とレポートを消します。星・仲間・メダル・連続記録・クリア状況・設定は残ります。元には戻せません。' : '星・仲間・メダル・連続記録・クリア状況・学習記録をすべて消します。音と遊べるレベルの設定は残ります。元には戻せません。';
  byId('reset-confirm').hidden = false; byId('reset-cancel').focus();
}
byId('reset-request').addEventListener('click', () => requestReset('all'));
byId('learning-reset-request').addEventListener('click', () => requestReset('learning'));
byId('reset-cancel').addEventListener('click', () => { byId('reset-confirm').hidden = true; byId('reset-request').focus(); });
byId('reset-confirm-button').addEventListener('click', () => {
  if (resetScope === 'learning') {
    progressData.learning = freshLearning(); progressData.recent = []; progressData.stats = { plays: 0, answered: 0, correct: 0 };
    progressData.clock.stats = { plays: 0, answered: 0, correct: 0 }; progressData.clock.errors = { hour: 0, half: 0 };
  } else {
  progressData = { ...freshProgress(), sound: progressData.sound, enabled: [...progressData.enabled], clock: { ...freshClock(), enabled: [...progressData.clock.enabled] } };
  }
  saveProgress(); clearCelebration();
  byId('reset-confirm').hidden = true;
  byId('reset-status').textContent = 'リセットしました。また たのしく あそぼう！';
  byId('reset-request').focus(); renderHome(); renderSettings();
});
window.addEventListener('focus', () => { if (screen === 'home') renderHome(); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { stopSounds(); interruptQuestionTiming(); } else if (screen === 'home') renderHome();
});
function renderLevels() {
  byId('level-cards').replaceChildren(...levels.map(level => {
    const button = document.createElement('button');
    button.className = `level-card ${level.mode === 'subtraction' ? 'subtraction' : 'addition'}`;
    button.disabled = !progressData.enabled[level.id - 1];
    const title = document.createElement('strong'); title.textContent = `${level.icon} レベル ${level.id}`;
    const name = document.createElement('span'); name.textContent = level.title;
    const status = document.createElement('small');
    status.textContent = progressData.cleared.includes(level.id) ? '⭐ クリア！' : button.disabled ? 'おうちの ひとと そうだん' : 'あそぶ →';
    button.append(title, name, status);
    button.addEventListener('click', () => startGame(level.id));
    return button;
  }));
  byId('levels-empty').hidden = progressData.enabled.some(Boolean);
}
function renderSettings() {
  renderClockSettings();
  byId('level-settings').replaceChildren(...levels.map(level => {
    const label = document.createElement('label');
    const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = progressData.enabled[level.id - 1];
    const text = document.createElement('span'); text.textContent = `レベル${level.id}：${level.title}`;
    checkbox.addEventListener('change', () => { progressData.enabled[level.id - 1] = checkbox.checked; saveProgress(); });
    label.append(checkbox, text); return label;
  }));
  byId('learning-stats').replaceChildren();
  for (const [label, value] of [['遊んだ回数（開始した回数）', progressData.stats.plays], ['解いた問題数', progressData.stats.answered], ['正解数（最初の回答）', progressData.stats.correct]]) {
    const term = document.createElement('dt'); term.textContent = label;
    const count = document.createElement('dd'); count.textContent = value;
    byId('learning-stats').append(term, count);
  }
  const trends = recentTrends();
  byId('learning-trends').replaceChildren(...(trends.length ? trends.map(([type, count]) => `${categoryNames[type]}：${count}問`) : ['まだ記録はありません。']).map(text => {
    const item = document.createElement('li'); item.textContent = text; return item;
  }));
}
// 時刻は「時・分」の組で扱い、将来の分単位レベルも追加できる。
function normalizeClock(saved) {
  const data = saved && typeof saved === 'object' ? saved : {};
  return {
    enabled: clockLevels.map((_, i) => typeof data.enabled?.[i] === 'boolean' ? data.enabled[i] : i === 0),
    cleared: Array.isArray(data.cleared) ? [...new Set(data.cleared.filter(id => clockLevels.some(level => level.id === id)))] : [],
    medal: data.medal === true,
    stats: { plays: safeCount(data.stats?.plays), answered: safeCount(data.stats?.answered), correct: Math.min(safeCount(data.stats?.correct), safeCount(data.stats?.answered)) },
    errors: { hour: safeCount(data.errors?.hour), half: safeCount(data.errors?.half) }
  };
}
function clockLabel(hour, minute) {
  return minute === 0 ? `${hour}じ` : minute === 30 ? `${hour}じ はん` : `${hour}じ ${minute}ふん`;
}
function createClockQuestions(level) {
  const pool = [];
  for (let hour = 1; hour <= 12; hour++) for (const minute of level.minutes) {
    pool.push({ hour, minute, answer: hour * 60 + minute, type: level.type });
  }
  return shuffle(pool).slice(0, 10);
}
function startClock(id) {
  const level = clockLevels.find(item => item.id === id);
  if (!level || !progressData.clock.enabled[id - 1]) return;
  gameKind = 'clock'; activeLevel = id;
  questions = createClockQuestions(level);
  questionIndex = 0; firstTryCorrect = 0;
  progressData.clock.stats.plays++; saveProgress(); prepareAudio();
  byId('game-title').textContent = `とけい ${id} ・ ${level.title}`;
  showScreen('game'); renderQuestion();
}
function svgElement(name, attrs, text) {
  const element = document.createElementNS('http://www.w3.org/2000/svg', name);
  Object.entries(attrs).forEach(([key, value]) => element.setAttribute(key, String(value)));
  if (text !== undefined) element.textContent = text;
  return element;
}
function drawClock(hour, minute) {
  const svg = svgElement('svg', { viewBox: '0 0 300 300', role: 'img', 'aria-label': `みじかい はりは ${hour}と ${hour % 12 + 1}の ${minute === 0 ? 'うち はじめの すうじ' : 'あいだ'}、ながい はりは ${minute / 5 || 12}を さす とけい` });
  svg.append(svgElement('circle', { cx: 150, cy: 150, r: 139, fill: '#fffefb', stroke: '#dfcdaa', 'stroke-width': 6 }));
  for (let number = 1; number <= 12; number++) {
    const angle = number * Math.PI / 6;
    svg.append(svgElement('line', { x1: 150 + Math.sin(angle) * 127, y1: 150 - Math.cos(angle) * 127, x2: 150 + Math.sin(angle) * 132, y2: 150 - Math.cos(angle) * 132, stroke: '#8c806d', 'stroke-width': 3 }));
    svg.append(svgElement('text', { x: 150 + Math.sin(angle) * 106, y: 150 - Math.cos(angle) * 106, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': 25, 'font-weight': 800, fill: '#423e38' }, number));
  }
  svg.append(svgElement('line', { 'data-hand': 'hour', x1: 150, y1: 150, x2: 150, y2: 83, stroke: '#b45e36', 'stroke-width': 12, 'stroke-linecap': 'round', transform: `rotate(${(hour % 12) * 30 + minute * 0.5} 150 150)` }));
  svg.append(svgElement('line', { 'data-hand': 'minute', x1: 150, y1: 150, x2: 150, y2: 56, stroke: '#33778a', 'stroke-width': 7, 'stroke-linecap': 'round', transform: `rotate(${minute * 6} 150 150)` }));
  svg.append(svgElement('circle', { cx: 150, cy: 150, r: 8, fill: '#423e38' }));
  byId('clock-face').classList.remove('clock-success');
  byId('clock-face').replaceChildren(svg);
  const sparkle = document.createElement('span'); sparkle.className = 'clock-sparkle'; sparkle.textContent = '✨'; sparkle.setAttribute('aria-hidden', 'true');
  byId('clock-face').append(sparkle);
}
function renderClockQuestion(question) {
  drawClock(question.hour, question.minute);
  const hours = shuffle([question.hour === 1 ? 12 : question.hour - 1, question.hour, question.hour === 12 ? 1 : question.hour + 1]);
  byId('clock-choices').replaceChildren(...hours.map(hour => {
    const button = document.createElement('button'); button.className = 'clock-choice';
    button.textContent = clockLabel(hour, question.minute);
    button.dataset.answer = hour * 60 + question.minute;
    button.addEventListener('click', () => {
      if (screen !== 'game' || gameKind !== 'clock' || solved) return;
      input = button.dataset.answer; checkAnswer();
      if (!solved) { button.disabled = true; button.classList.add('tried'); }
      else button.classList.add('chosen');
    });
    return button;
  }));
}
function renderClockLevels() {
  byId('clock-level-cards').replaceChildren(...clockLevels.map(level => {
    const button = document.createElement('button'); button.className = 'level-card clock-card';
    button.disabled = !progressData.clock.enabled[level.id - 1];
    const name = document.createElement('strong'); name.textContent = `🕰️ レベル ${level.id}`;
    const title = document.createElement('span'); title.textContent = level.title;
    const status = document.createElement('small'); status.textContent = progressData.clock.cleared.includes(level.id) ? '⭐ クリア！' : button.disabled ? 'おうちの ひとと そうだん' : 'あそぶ →';
    button.append(name, title, status); button.addEventListener('click', () => startClock(level.id)); return button;
  }));
}
function renderClockSettings() {
  byId('clock-settings').replaceChildren(...clockLevels.map(level => {
    const label = document.createElement('label'); const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = progressData.clock.enabled[level.id - 1];
    checkbox.addEventListener('change', () => { progressData.clock.enabled[level.id - 1] = checkbox.checked; saveProgress(); });
    const text = document.createElement('span'); text.textContent = `とけいレベル${level.id}：${level.title}`;
    label.append(checkbox, text); return label;
  }));
  byId('clock-stats').replaceChildren();
  for (const [name, value] of [['遊んだ回数', progressData.clock.stats.plays], ['解いた問題数', progressData.clock.stats.answered], ['正解数（最初の回答）', progressData.clock.stats.correct]]) {
    const term = document.createElement('dt'); term.textContent = name; const count = document.createElement('dd'); count.textContent = value;
    byId('clock-stats').append(term, count);
  }
  byId('clock-trends').replaceChildren(...clockLevels.map(level => {
    const item = document.createElement('li'); item.textContent = `${level.title}：初回回答の間違い ${progressData.clock.errors[level.type]}問`; return item;
  }));
}
renderHome();

// 誤操作を防ぐ簡易確認。問題と答えはメモリ内だけに保持する。
function openParentGate() {
  parentVerified = false;
  const candidates = [];
  for (let a = 2; a <= 9; a++) for (let b = 2; b <= 9; b++) {
    if (a * b >= 12 && `${a}:${b}` !== previousParentQuestion) candidates.push({ a, b });
  }
  parentQuestion = candidates[Math.floor(Math.random() * candidates.length)];
  previousParentQuestion = `${parentQuestion.a}:${parentQuestion.b}`;
  byId('parent-question').textContent = `${parentQuestion.a} × ${parentQuestion.b} = ？`;
  byId('parent-answer').value = '';
  byId('parent-answer').removeAttribute('aria-invalid');
  byId('gate-status').textContent = '';
  byId('parent-gate').showModal();
  byId('parent-answer').focus();
}
byId('parent-form').addEventListener('submit', event => {
  event.preventDefault();
  if (!byId('parent-gate').open || !parentQuestion) return;
  const answer = byId('parent-answer').value.trim().replace(/[０-９]/g, char => String.fromCharCode(char.charCodeAt(0) - 0xfee0));
  if (!/^[0-9]{1,3}$/.test(answer) || Number(answer) !== parentQuestion.a * parentQuestion.b) {
    byId('gate-status').textContent = 'もういちど かくにんしてね';
    byId('parent-answer').setAttribute('aria-invalid', 'true');
    byId('parent-answer').focus(); byId('parent-answer').select();
    return;
  }
  parentVerified = true;
  parentQuestion = null;
  byId('parent-gate').close();
  byId('reset-confirm').hidden = true; byId('reset-status').textContent = '';
  renderSettings(); showScreen('settings'); byId('open-report').focus();
});
function clearParentQuestion() { parentQuestion = null; byId('parent-answer').value = ''; }
byId('parent-gate').addEventListener('close', () => { if (!byId('parent-gate').open) clearParentQuestion(); });
byId('parent-gate').addEventListener('cancel', clearParentQuestion);
byId('parent-cancel').addEventListener('click', () => { clearParentQuestion(); byId('parent-gate').close(); });
byId('open-report').addEventListener('click', () => { renderReport(); showScreen('report'); });
byId('report-filter').addEventListener('change', renderReport);
byId('report-back').addEventListener('click', () => { renderSettings(); showScreen('settings'); });
window.addEventListener('blur', () => { interruptQuestionTiming(); });
window.addEventListener('pagehide', interruptQuestionTiming);
