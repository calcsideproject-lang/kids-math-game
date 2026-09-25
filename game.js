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
  const count = firstTryCorrect >= 8 ? 3 : firstTryCorrect >= 5 ? 2 : 1;
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
  if (firstTryCorrect !== 10 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const colors = ['#e9b85c', '#eaa6a2', '#83baa3', '#aaa0ce'];
  const pieces = Array.from({ length: 28 }, (_, i) => {
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
  ['home', 'game', 'result'].forEach(id => { byId(id).hidden = id !== name; });
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
    showScreen('result');
    showReward();
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
