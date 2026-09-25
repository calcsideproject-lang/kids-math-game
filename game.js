'use strict';

const byId = id => document.getElementById(id);
const praise = ['せいかい！', 'すごい！', 'やったね！', 'よく できたね！', 'ばっちり！'];
let mode = 'addition';
let questions = [];
let questionIndex = 0;
let firstTryCorrect = 0;
let madeMistake = false;
let solved = false;
let input = '';
let replaceInput = false;
let screen = 'home';
let confettiTimer;

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

// 両方の数と答えが0〜10の範囲になる問題を作り、重複せずに10問選ぶ。
function createQuestions(operation) {
  const pool = [];
  for (let a = 0; a <= 10; a++) {
    for (let b = 0; b <= 10; b++) {
      if (operation === 'addition' && a + b <= 10) pool.push({ a, b, answer: a + b });
      if (operation === 'subtraction' && a >= b) pool.push({ a, b, answer: a - b });
    }
  }
  return shuffle(pool).slice(0, 10);
}

function showScreen(name) {
  if (name !== 'result') clearCelebration();
  screen = name;
  ['home', 'game', 'result', 'collection', 'settings'].forEach(id => { byId(id).hidden = id !== name; });
  byId('open-settings').hidden = name !== 'home';
  if (name === 'home') renderHome();
  window.scrollTo(0, 0);
}

function startGame(operation) {
  mode = operation;
  questions = createQuestions(mode);
  questionIndex = 0;
  firstTryCorrect = 0;
  byId('game-title').textContent = mode === 'addition' ? 'たしざん' : 'ひきざん';
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
  const question = questions[questionIndex];
  byId('problem').textContent = `${question.a} ${mode === 'addition' ? '＋' : '−'} ${question.b}`;
  byId('question-count').textContent = `${questionIndex + 1} / 10 もん`;
  byId('progress').value = questionIndex;
  byId('progress').textContent = `${questionIndex} / 10`;
  byId('feedback').textContent = 'すうじを おしてね';
  byId('feedback').className = 'feedback';
  byId('check').hidden = false;
  byId('next').hidden = true;
  document.querySelectorAll('#keypad button').forEach(button => { button.disabled = false; });
  updateInput();
}

function enterDigit(digit) {
  if (screen !== 'game' || solved) return;
  if (replaceInput || input === '0') input = '';
  replaceInput = false;
  if (input.length >= 2) return;
  input += digit;
  byId('feedback').textContent = '「こたえる」を おしてね';
  byId('feedback').className = 'feedback';
  updateInput();
}

function editInput(clearAll) {
  if (screen !== 'game' || solved) return;
  input = clearAll ? '' : input.slice(0, -1);
  replaceInput = false;
  updateInput();
}

function checkAnswer() {
  if (screen !== 'game' || solved || input === '') return;
  if (Number(input) !== questions[questionIndex].answer) {
    madeMistake = true;
    replaceInput = true;
    byId('feedback').textContent = 'もういちど！';
    byId('feedback').className = 'feedback retry';
    return;
  }
  solved = true;
  playSound('correct');
  if (!madeMistake) firstTryCorrect++;
  byId('feedback').textContent = praise[Math.floor(Math.random() * praise.length)];
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
    byId('score').textContent = `10もんちゅう ${firstTryCorrect}もん せいかい！`;
    awardCompletion();
    showScreen('result');
    showReward();
    playSound('clear');
    byId('result-title').focus({ preventScroll: true });
  } else {
    renderQuestion();
    document.querySelector('[data-digit="1"]').focus({ preventScroll: true });
  }
}

document.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => startGame(button.dataset.mode)));
document.querySelectorAll('[data-digit]').forEach(button => button.addEventListener('click', () => enterDigit(button.dataset.digit)));
byId('clear').addEventListener('click', () => editInput(true));
byId('backspace').addEventListener('click', () => editInput(false));
byId('check').addEventListener('click', checkAnswer);
byId('next').addEventListener('click', nextQuestion);
byId('again').addEventListener('click', () => startGame(mode));
byId('go-home').addEventListener('click', () => showScreen('home'));
byId('choose-mode').addEventListener('click', () => showScreen('home'));

// パソコンでは数字キー、Backspace、Enterでも操作できる。
document.addEventListener('keydown', event => {
  if (screen !== 'game' || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
  if (/^[0-9]$/.test(event.key)) { event.preventDefault(); enterDigit(event.key); }
  else if (event.key === 'Backspace' || event.key === 'Delete') { event.preventDefault(); editInput(event.key === 'Delete'); }
  else if (event.key === 'Enter' && !event.repeat) {
    // ボタン上のEnterは標準のクリックに任せる（二重進行を防ぐ）。
    if (document.activeElement?.tagName === 'BUTTON') return;
    event.preventDefault();
    if (solved) nextQuestion(); else checkAnswer();
  }
});

// 保存するのは進捗と音の設定だけ。コレクションは星の合計から求める。
const STORAGE_KEY = 'kids-math-game.progress.v1';
const friends = [
  { stars: 5, icon: '🐣', name: 'ひよこ' },
  { stars: 10, icon: '🐰', name: 'うさぎ' },
  { stars: 20, icon: '🐼', name: 'パンダ' },
  { stars: 30, icon: '🦁', name: 'ライオン' },
  { stars: 50, icon: '👑', name: 'おうかん' }
];
const freshProgress = () => ({ stars: 0, lastDay: '', streak: 0, sound: false });
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
      sound: saved.sound === true
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
byId('open-settings').addEventListener('click', () => { byId('reset-confirm').hidden = true; byId('reset-status').textContent = ''; showScreen('settings'); });
byId('settings-home').addEventListener('click', () => showScreen('home'));
byId('reset-request').addEventListener('click', () => { byId('reset-confirm').hidden = false; byId('reset-cancel').focus(); });
byId('reset-cancel').addEventListener('click', () => { byId('reset-confirm').hidden = true; byId('reset-request').focus(); });
byId('reset-confirm-button').addEventListener('click', () => {
  progressData = { ...freshProgress(), sound: progressData.sound };
  saveProgress(); clearCelebration();
  byId('reset-confirm').hidden = true;
  byId('reset-status').textContent = 'リセットしました。また たのしく あそぼう！';
  byId('reset-request').focus(); renderHome();
});
window.addEventListener('focus', () => { if (screen === 'home') renderHome(); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopSounds(); else if (screen === 'home') renderHome();
});
renderHome();
