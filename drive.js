'use strict';
// 秒単位。子どもの様子に合わせてここでテンポを調整する。
const DRIVE_FREE_RUN_DURATION = 6;
const DRIVE_APPROACH_DURATION = 6;
const DRIVE_SUCCESS_DURATION = 1;
const DRIVE_GOAL_FREE_DURATION = 6;
const DRIVE_GOAL_APPROACH_DURATION = 5;
const DRIVE_CARS = [
  { id: 'sport', name: 'はやそうな くるま', color: '#e88963', width: 44, round: 16 },
  { id: 'family', name: 'おおきな くるま', color: '#72a5c4', width: 54, round: 9 },
  { id: 'small', name: 'ちいさな くるま', color: '#e4ba54', width: 48, round: 22 }
];
function freshDrive() { return { plays: 0, goals: 0, explained: false, car: 'sport' }; }
function normalizeDrive(value) {
  const data = value || {};
  return { plays: safeCount(data.plays), goals: safeCount(data.goals), explained: data.explained === true,
    car: DRIVE_CARS.some(car => car.id === data.car) ? data.car : 'sport' };
}
const driveState = { running: false, raf: 0, last: 0, phase: 'idle', age: 0, fork: 0, roadOffset: 0, sceneryOffset: 0, scrollSpeed: 50,
  target: 0, x: 0, pointer: null, origin: 0, choices: [], ready: false, practice: false, chosen: null };
function carDrawing(id) {
  const car = DRIVE_CARS.find(item => item.id === id) || DRIVE_CARS[0];
  const svg = svgElement('svg', { viewBox: '0 0 80 120', role: 'img', 'aria-label': car.name });
  for (const x of [9, 60]) for (const y of [24, 80]) svg.append(svgElement('rect', { x, y, width: 11, height: 22, rx: 4, fill: '#344450' }));
  svg.append(svgElement('rect', { x: (80-car.width)/2, y: 7, width: car.width, height: car.id === 'small' ? 100 : 108, rx: car.round, fill: car.color, stroke: '#fff8ed', 'stroke-width': 3 }));
  svg.append(svgElement('path', { d: 'M24 36 Q40 25 56 36 L53 54 H27 Z', fill: '#d8f1f6', stroke: '#456576', 'stroke-width': 2 }));
  svg.append(svgElement('rect', { x: 26, y: 62, width: 28, height: 19, rx: 5, fill: '#d8f1f6' }));
  for (const x of [21, 51]) svg.append(svgElement('rect', { x, y: 15, width: 8, height: 7, rx: 3, fill: '#fff6ba' }));
  if (car.id === 'sport') svg.append(svgElement('rect', { x: 16, y: 96, width: 48, height: 7, rx: 3, fill: '#974f39' }));
  if (car.id === 'family') svg.append(svgElement('path', { d: 'M24 61V84 M56 61V84', stroke: '#456576', 'stroke-width': 3 }));
  return svg;
}
function openDriveSetup() {
  showScreen('drive-setup');
  byId('drive-cars').replaceChildren(...DRIVE_CARS.map(car => {
    const button = document.createElement('button'); button.className = 'car-choice';
    button.dataset.car = car.id; button.setAttribute('aria-pressed', String(progressData.drive.car === car.id));
    const name = document.createElement('span'); name.textContent = car.name;
    button.append(carDrawing(car.id), name);
    button.addEventListener('click', () => {
      progressData.drive.car = car.id; saveProgress();
      document.querySelectorAll('.car-choice').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
      prepareAudio(); playSound('correct');
    }); return button;
  }));
  const enabled = levels.filter(level => level.mode !== 'three-number' && progressData.enabled[level.id - 1]);
  byId('drive-level').replaceChildren(...enabled.map(level => {
    const option = document.createElement('option'); option.value = level.id; option.textContent = level.title; return option;
  }));
  byId('drive-start').disabled = !enabled.length;
  byId('drive-unavailable').hidden = Boolean(enabled.length);
}
function startDrive(id) {
  const level = levels.find(item => item.id === id);
  if (!level || level.mode === 'three-number' || !progressData.enabled[id - 1]) return;
  stopDrive(); gameKind = 'drive'; activeLevel = id; mode = level.mode;
  questionIndex = 0; firstTryCorrect = 0; questions = [];
  driveState.practice = !progressData.drive.explained;
  driveState.x = 0; driveState.target = 0; driveState.phase = driveState.practice ? 'practice' : 'cruise'; driveState.age = 0;
  initializeDriveLandscape();
  driveState.scrollSpeed = 50;
  byId('drive-car').replaceChildren(carDrawing(progressData.drive.car));
  byId('drive-practice-start').hidden = !driveState.practice;
  showScreen('drive'); prepareAudio();
  if (driveState.practice) {
    byId('drive-title').textContent = 'ハンドルの れんしゅう'; byId('drive-count').textContent = '';
    byId('drive-problem').textContent = 'ひだり・みぎに うごかそう！';
    byId('drive-feedback').textContent = 'ただしい こたえの みちへ すすもう！';
  } else beginDriveRun();
  driveState.running = true; driveState.last = 0; renderDrive(); scheduleDrive();
}
function beginDriveRun() {
  const level = levels.find(item => item.id === activeLevel);
  questions = createQuestions(level.mode, level.limit);
  progressData.drive.plays++; progressData.stats.plays++; learningDay().plays[mode]++; saveProgress();
  byId('drive-title').textContent = 'さんすうドライブ';
  driveState.practice = false; byId('drive-practice-start').hidden = true;
  driveState.phase = 'cruise'; driveState.age = 0; driveState.target = 0;
  byId('drive-problem').textContent = 'しゅっぱつ！'; byId('drive-count').textContent = '1 / 10';
  byId('drive-feedback').textContent = 'ゆっくり すすもう！';
}
function prepareDriveQuestion() {
  const q = questions[questionIndex], level = levels.find(item => item.id === activeLevel);
  const wrong = [q.answer - 1, q.answer + 1].filter(n => n >= 0 && n <= level.limit);
  driveState.choices = shuffle([q.answer, wrong[Math.floor(Math.random() * wrong.length)]]);
  driveState.ready = Math.abs(driveState.target) < .2; driveState.chosen = null; driveState.fork = 0;
  driveState.phase = 'approach'; driveState.age = 0;
  answeredRecorded = false; madeMistake = false; solved = false;
  byId('drive-problem').textContent = `${q.a} ${q.op === 'addition' ? '＋' : '−'} ${q.b} = ？`;
  byId('drive-count').textContent = `${questionIndex + 1} / 10`;
  byId('drive-left').textContent = driveState.choices[0]; byId('drive-right').textContent = driveState.choices[1];
  byId('drive-feedback').textContent = 'どっちかな？ こたえの みちへ！';
  beginQuestionTiming(q);
}
function setDriveSteering(value) {
  driveState.target = Math.max(-1, Math.min(1, value));
  if (!driveState.running || screen !== 'drive' || !['approach', 'question'].includes(driveState.phase)) return;
  if (Math.abs(driveState.target) < .2) driveState.ready = true;
  if (driveState.ready && Math.abs(driveState.target) > .55) {
    driveState.fork = 1;
    chooseDriveRoad(driveState.target < 0 ? 0 : 1);
  }
}
function releaseDriveSteering() { driveState.pointer = null; setDriveSteering(0); }
function chooseDriveRoad(side) {
  if (screen !== 'drive' || !['approach', 'question'].includes(driveState.phase) || solved) return;
  const q = questions[questionIndex], answer = driveState.choices[side], correct = answer === q.answer;
  if (!answeredRecorded) {
    answeredRecorded = true; recordLearningAnswer(q, answer, correct);
    progressData.stats.answered++; if (correct) progressData.stats.correct++;
    progressData.recent.push({ type: calculationType(q), correct }); progressData.recent = progressData.recent.slice(-60); saveProgress();
  }
  driveState.age = 0; driveState.chosen = side;
  if (!correct) {
    madeMistake = true; driveState.phase = 'question';
    driveState.age = 0; driveState.fork = .72; driveState.ready = false;
    byId('drive-feedback').textContent = 'もういちど やってみよう！';
  } else {
    solved = true; if (!madeMistake) firstTryCorrect++;
    driveState.phase = 'success'; playSound('correct');
    byId('drive-feedback').textContent = '✨ せいかい！ すごい！';
  }
}
function finishDrive() {
  if (!driveState.running) return;
  stopDrive(); progressData.drive.goals++;
  byId('score').textContent = '🏁 ゴール！ ドライブ できたね！';
  awardCompletion(); showScreen('result'); showReward(); playSound('clear'); byId('result-title').focus({ preventScroll: true });
}
// px/秒。速度を変えても白線の現在位置を保持する。
function driveRoadSpeed() {
  if (driveState.phase === 'approach') {
    const progress = Math.min(1, driveState.age / DRIVE_APPROACH_DURATION);
    return 50 + (10 / 3 - 50) * progress * progress * (3 - 2 * progress);
  }
  return driveState.phase === 'question' ? 10 / 3 : 50;
}
function stepDrive(dt) {
  if (!driveState.running || screen !== 'drive') return;
  dt = Math.min(Math.max(dt, 0), 0.05);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  driveState.x += (driveState.target - driveState.x) * Math.min(1, dt * (reduced ? 40 : 12));
  driveState.x = Math.max(-1, Math.min(1, driveState.x));
  driveState.age += dt;
  if (driveState.phase === 'cruise' && driveState.age >= DRIVE_FREE_RUN_DURATION) prepareDriveQuestion();
  else if (driveState.phase === 'approach' && driveState.age >= DRIVE_APPROACH_DURATION) {
    driveState.phase = 'question'; driveState.age = 0; driveState.fork = .72; driveState.ready = Math.abs(driveState.target) < .2;
    byId('drive-feedback').textContent = 'どっちかな？ ゆっくり かんがえよう！';
  } else if (driveState.phase === 'goal-cruise' && driveState.age >= DRIVE_GOAL_FREE_DURATION) {
    driveState.phase = 'goal-approach'; driveState.age = 0;
    byId('drive-feedback').textContent = 'ゴールが みえてきたよ！';
  } else if (driveState.phase === 'goal-approach' && driveState.age >= DRIVE_GOAL_APPROACH_DURATION) {
    finishDrive(); return;
  } else if (driveState.phase === 'question') {
    // 分岐前で中央に一度戻す。握り続けたまま次の問題を回答しない。
    if (Math.abs(driveState.x) < 0.2 && Math.abs(driveState.target) < 0.2) driveState.ready = true;
  } else if (driveState.phase === 'success' && driveState.age >= DRIVE_SUCCESS_DURATION) {
    questionIndex++;
    if (questionIndex === 10) {
      driveState.phase = 'goal-cruise'; driveState.age = 0; byId('drive-count').textContent = '10 / 10';
      byId('drive-feedback').textContent = 'あと すこし ドライブを たのしもう！'; renderDrive(); return;
    }
    driveState.phase = 'cruise'; driveState.age = 0;
    byId('drive-problem').textContent = '';
    byId('drive-feedback').textContent = 'また ドライブ！ すきな ほうへ！';
  }
  driveState.scrollSpeed += (driveRoadSpeed() - driveState.scrollSpeed) * (1 - Math.exp(-dt * 8));
  if (!reduced) {
    driveState.roadOffset = (driveState.roadOffset + driveState.scrollSpeed * dt) % 60;
    driveState.sceneryOffset = (driveState.sceneryOffset + driveState.scrollSpeed * dt) % 420;
  }
  renderDrive();
}
function renderDrive() {
  const approaching = driveState.phase === 'approach';
  const answering = ['approach', 'question'].includes(driveState.phase);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const progress = approaching ? Math.min(1, driveState.age / DRIVE_APPROACH_DURATION) : 1;
  const depth = reduced ? 1 : progress;
  byId('drive-problem').hidden = !answering;
  byId('drive-signs').hidden = !answering;
  byId('drive-scene').classList.toggle('cruising', !answering);
  byId('drive-scene').classList.toggle('drive-success', driveState.phase === 'success');
  renderDriveLandscape();
  byId('drive-signs').style.transform = `translateY(${38+depth*14}px) scale(${.55 + depth*.45})`;
  byId('drive-problem').style.transform = `translateX(-50%) translateY(${6+depth*6}px) scale(${.65 + depth*.35})`;
  const goal = driveState.phase === 'goal-approach';
  byId('drive-goal').hidden = !goal;
  const goalDepth = Math.min(1, driveState.age / DRIVE_GOAL_APPROACH_DURATION);
  byId('drive-goal').style.transform = reduced ? 'none' : `translateY(${goalDepth*240}px) scale(${.2+goalDepth*.8})`;
  byId('drive-car-position').style.left = `${50 + driveState.x * 28}%`;
  const angle = driveState.x * 40;
  byId('drive-wheel').style.setProperty('--steer', `${angle}deg`);
  byId('drive-car').style.setProperty('--tilt', `${driveState.x * 8}deg`);
  byId('drive-wheel').setAttribute('aria-valuenow', Math.round(angle));
  byId('drive-wheel').setAttribute('aria-valuetext', Math.abs(driveState.x) < .2 ? 'まんなか' : driveState.x < 0 ? 'ひだり' : 'みぎ');
}
function scheduleDrive() {
  if (driveState.running && !driveState.raf && !document.hidden) driveState.raf = requestAnimationFrame(driveFrame);
}
function driveFrame(now) {
  driveState.raf = 0;
  if (!driveState.running || screen !== 'drive' || document.hidden) return;
  const dt = driveState.last ? (now - driveState.last) / 1000 : 0;
  driveState.last = now; stepDrive(dt); scheduleDrive();
}
function stopDrive() {
  driveState.running = false; cancelAnimationFrame(driveState.raf); driveState.raf = 0; driveState.last = 0; releaseDriveSteering();
}
function initializeDrive() {
  byId('open-drive').addEventListener('click', openDriveSetup);
  byId('drive-start').addEventListener('click', () => startDrive(Number(byId('drive-level').value)));
  byId('drive-setup-back').addEventListener('click', () => showScreen('home'));
  byId('drive-back').addEventListener('click', () => showScreen('home'));
  byId('drive-practice-start').addEventListener('click', () => {
    if (screen !== 'drive' || !driveState.practice) return;
    progressData.drive.explained = true; beginDriveRun();
  });
  const wheel = byId('drive-wheel');
  wheel.addEventListener('pointerdown', event => {
    if (!driveState.running || driveState.pointer !== null || event.button !== 0) return;
    event.preventDefault(); wheel.focus({ preventScroll: true }); driveState.pointer = event.pointerId; driveState.origin = event.clientX;
    wheel.setPointerCapture(event.pointerId);
  });
  wheel.addEventListener('pointermove', event => {
    if (driveState.pointer !== event.pointerId) return;
    setDriveSteering((event.clientX - driveState.origin) / 65);
  });
  const release = event => { if (driveState.pointer === event.pointerId) releaseDriveSteering(); };
  wheel.addEventListener('pointerup', release); wheel.addEventListener('pointercancel', release); wheel.addEventListener('lostpointercapture', release);
  wheel.addEventListener('keydown', event => {
    if (!driveState.running || !['ArrowLeft','ArrowRight','ArrowDown','Home','End'].includes(event.key)) return;
    event.preventDefault(); setDriveSteering(event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0);
  });
  wheel.addEventListener('keyup', event => { if (event.key.startsWith('Arrow')) releaseDriveSteering(); });
  wheel.addEventListener('blur', releaseDriveSteering);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { cancelAnimationFrame(driveState.raf); driveState.raf = 0; driveState.last = 0; releaseDriveSteering(); }
    else { driveState.last = 0; scheduleDrive(); }
  });
  window.addEventListener('blur', releaseDriveSteering);
  window.addEventListener('pagehide', stopDrive);
}


// 全フェーズ共通の固定台形。道路の輪郭は初期化時だけ描画する。
function initializeDriveLandscape() {
  byId('drive-road-edges').replaceChildren(svgElement('path', { d: 'M57 -30 L37 330 L283 330 L263 -30 Z', fill: '#fff5d7', stroke: 'none' }));
  byId('drive-road-surface').replaceChildren(svgElement('path', { d: 'M60 -30 L40 330 L280 330 L260 -30 Z', fill: '#7e8891', stroke: 'none' }));
  byId('drive-road-marks').replaceChildren(svgElement('path', { d: 'M160 -30 V330' }));
  byId('drive-scenery').replaceChildren(...['🌳','🏡','🌼','🌿','🌲','🌷','🏠','🌳'].map((icon, i) => {
    const item = document.createElement('span'); item.textContent = icon;
    item.dataset.offset = i * 52.5 + Math.random() * 16;
    item.style.left = `${i % 2 ? 95 - Math.random() : 5 + Math.random()}%`;
    return item;
  }));
}
function renderDriveLandscape() {
  byId('drive-road-marks').firstElementChild.setAttribute('stroke-dashoffset', -driveState.roadOffset);
  Array.from(byId('drive-scenery').children).forEach(item => {
    const y = ((Number(item.dataset.offset) + driveState.sceneryOffset) % 420) - 60;
    item.style.top = `${y/3}%`;
    item.style.transform = `translate(-50%,-50%) scale(${.65+Math.max(0,y)/900})`;
  });
}
