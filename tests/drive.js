async function testDrive(check) {
  const old = freshProgress(); delete old.drive;
  old.stars=40;old.clock.medal=true;old.clock.stats.correct=12;old.clock.stats.answered=15;
  localStorage.setItem(STORAGE_KEY,JSON.stringify(old));progressData=loadProgress();
  check(progressData.stars===40&&progressData.clock.medal&&progressData.clock.stats.correct===12&&progressData.drive.car==='sport','drive migration');
  progressData.sound=false;openDriveSetup();check(byId('drive-cars').children.length===3,'3 cars');
  for(const car of DRIVE_CARS){document.querySelector(`[data-car="${car.id}"]`).click();check(progressData.drive.car===car.id&&loadProgress().drive.car===car.id,'car selected');startDrive(1);check(byId('drive-car').querySelector('svg').getAttribute('aria-label')===car.name,'car rendered');showScreen('home');check(!driveState.running&&!driveState.raf,'leave stops');openDriveSetup();}
  startDrive(1);check(driveState.practice&&questions.length===0,'first tutorial');check(byId('drive-road-marks').children.length===1,'no answer guide during practice');
  const tick=(seconds)=>{for(let t=0;t<seconds;t+=.05)stepDrive(.05);};
  setDriveSteering(-1);tick(.3);check(driveState.x<-.8,'left movement');setDriveSteering(1);tick(.3);check(driveState.x>.8,'right movement');setDriveSteering(99);tick(.3);check(driveState.x<=1,'edge clamp');releaseDriveSteering();tick(.6);check(Math.abs(driveState.x)<.01,'release centers');
  const wheel=byId('drive-wheel');wheel.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true}));check(driveState.target===-1,'keyboard steering');wheel.dispatchEvent(new KeyboardEvent('keyup',{key:'ArrowLeft',bubbles:true}));check(driveState.target===0,'keyboard release');
  // Pointer handlers, including canceled touch, without browser pointer capture requirements.
  const capture=wheel.setPointerCapture;wheel.setPointerCapture=()=>{};
  wheel.dispatchEvent(new PointerEvent('pointerdown',{pointerId:4,button:0,clientX:100}));wheel.dispatchEvent(new PointerEvent('pointermove',{pointerId:4,clientX:160}));check(driveState.target>.9,'touch drag');wheel.dispatchEvent(new PointerEvent('pointercancel',{pointerId:4}));check(driveState.target===0&&driveState.pointer===null,'touch cancel');wheel.setPointerCapture=capture;
  byId('drive-practice-start').click();check(progressData.drive.explained&&loadProgress().drive.explained,'tutorial saved');
  const startStars=progressData.stars,startCount=progressData.stats.answered;
  tick(DRIVE_FREE_RUN_DURATION-1);check(driveState.phase==='cruise'&&byId('drive-problem').hidden&&byId('drive-signs').hidden,'configured free driving duration');tick(1.2);check(driveState.phase==='approach'&&!answeredRecorded,'distant approach');setDriveSteering(.4);tick(DRIVE_APPROACH_DURATION/2);check(driveState.x>.3&&!answeredRecorded,'gentle steer while approaching');releaseDriveSteering();tick(DRIVE_APPROACH_DURATION);check(driveState.phase==='question'&&new Set(questions.map(problemKey)).size===10,'drive questions');tick(5);check(questionIndex===0&&!answeredRecorded&&driveState.fork===.72,'center waits without answer');
  // Repeated approach frames must only move forward, at decreasing speed.
  const phaseBefore=driveState.phase,ageBefore=driveState.age;
  driveState.phase='approach';driveState.age=0;driveState.roadOffset=0;
  let previousSpeed=driveRoadSpeed();
  for(let frame=0;frame<100;frame++){
    const before=driveState.roadOffset;stepDrive(.05);
    const travel=(driveState.roadOffset-before+60)%60;
    check(travel<=2.501&&driveRoadSpeed()<=previousSpeed+.001,'white lines continuous deceleration');
    previousSpeed=driveRoadSpeed();
  }
  driveState.phase=phaseBefore;driveState.age=ageBefore;
  const savedPhase=driveState.phase;
  const fixedRoad=byId('drive-road-surface').firstElementChild.getAttribute('d');
  for(const phase of ['cruise','approach','question','success','goal-cruise']) {
    driveState.phase=phase;renderDriveLandscape();
    check(byId('drive-road-surface').firstElementChild.getAttribute('d')===fixedRoad,'road shape identical in every phase');
    const surface=byId('drive-road-surface');
    check(surface.children.length===1,'single paved surface');
    for(const y of [0,50,100,150,200,250,299]) {
      check(surface.firstElementChild.isPointInFill(new DOMPoint(160,y)),'center always paved');
    }
    check(byId('drive-road-marks').children.length===1,'only straight center line');
  }
  driveState.phase=savedPhase;
  for(const item of byId('drive-scenery').children) {
    const x=parseFloat(item.style.left)*3.2;
    check(x+11<37 || x-11>283,'scenery stays outside widest road');
  }
  const landscapePhase=driveState.phase,landscapeAge=driveState.age;
  driveState.phase='approach';driveState.age=0;
  const sceneryBefore=driveState.sceneryOffset;tick(1);
  check(byId('drive-road-marks').firstElementChild.getAttribute('d')==='M160 -30 V330','answer guide appears');
  check(driveState.sceneryOffset!==sceneryBefore&&byId('drive-scenery').children.length===8,'scenery scroll fixed count');
  tick(DRIVE_APPROACH_DURATION);check(byId('drive-road-surface').firstElementChild.getAttribute('d')===fixedRoad,'approach never changes road');
  driveState.phase='success';driveState.age=0;const slowSpeed=driveState.scrollSpeed;const roadBefore=driveState.roadOffset,objectsBefore=driveState.sceneryOffset;stepDrive(.05);check(driveState.scrollSpeed>slowSpeed&&driveState.scrollSpeed<50,'smooth return to cruising speed');check(Math.abs((driveState.roadOffset-roadBefore+60)%60-(driveState.sceneryOffset-objectsBefore+420)%420)<.001,'road and scenery share travel');tick(.3);check(byId('drive-road-marks').children.length===1,'guide removed after answer');
  driveState.phase=landscapePhase;driveState.age=landscapeAge;
  let firstKey;
  for(let i=0;i<10;i++){
    if(driveState.phase==='cruise'){check(byId('drive-problem').hidden&&byId('drive-signs').hidden,'free run hides answers');tick(DRIVE_FREE_RUN_DURATION);tick(DRIVE_APPROACH_DURATION);}
    releaseDriveSteering();tick(.7);const q=questions[questionIndex];const correct=driveState.choices.indexOf(q.answer);check(correct>=0&&Math.abs(driveState.choices[1-correct]-q.answer)===1,'near distractor');
    if(i===0){firstKey=problemKey(q);setDriveSteering(correct===0?1:-1);tick(3);check(madeMistake&&questionIndex===0&&!solved,'wrong retries');check(driveState.phase==='question','retry has no timed wait');releaseDriveSteering();tick(.35);}
    // Steering itself answers, even before the next animation frame.
    driveState.age=0;driveState.ready=true;
    setDriveSteering(correct===0?-1:1);check(solved&&driveState.phase==='success','immediate answer without animation frame');tick(.25);
    check(solved&&driveState.phase==='success','steered choice judged promptly');
    check(driveRoadSpeed()===50,'success resumes driving immediately');
    tick(.35);check(byId('drive-road-marks').children.length===1,'no guide during short feedback');
    tick(.5);check(driveState.phase===(i===9?'goal-cruise':'cruise'),'free drive after one second');
    if(i<9)check(questionIndex===i+1,'one problem advanced');
  }
  check(screen==='drive'&&driveState.phase==='goal-cruise'&&progressData.drive.goals===0,'final free drive before reward');releaseDriveSteering();tick(DRIVE_GOAL_FREE_DURATION);check(driveState.phase==='goal-approach'&&!byId('drive-goal').hidden,'goal approaching');tick(DRIVE_GOAL_APPROACH_DURATION);
  check(screen==='result'&&byId('score').textContent.includes('ゴール'),'goal');check(progressData.stars===startStars+3&&progressData.drive.goals===1,'drive reward');check(progressData.stats.answered===startCount+10,'drive shared counts');check(!driveState.running&&!driveState.raf,'goal stops loop');
  const first=progressData.learning.problems[firstKey];check(first.history.length===1&&!first.history[0].correct&&first.history[0].source==='drive','first choice source saved');
  check(loadProgress().learning.problems[firstKey].history[0].source==='drive','source reload');
  const driveFast=Array.from({length:5},()=>({correct:true,ms:1000,source:'drive'}));check(mastery(driveFast)==='collecting','drive cannot imply math speed');
  const mixed=[...Array.from({length:3},()=>({correct:true,ms:2000,source:'math'})),...driveFast.slice(0,2).map(s=>({...s,ms:20000}))];check(mastery(mixed)==='fast','drive time excluded from mastery');
  const report=periodReport('all');check(report.driveN===10&&report.t===0,'separate drive averages');
  byId('again').click();check(screen==='drive'&&!driveState.practice&&progressData.drive.plays===2,'drive replay');
  let sides=new Set();for(let i=0;i<60;i++){prepareDriveQuestion();sides.add(driveState.choices.indexOf(questions[questionIndex].answer));}check(sides.size===2,'random correct side');
  releaseDriveSteering();prepareDriveQuestion();
  check(driveState.phase==='approach'&&questionTimer!==null,'timer starts at distant appearance');
  const earlyKey=problemKey(questions[questionIndex]);const earlyBefore=progressData.stats.answered;
  const earlyCorrect=driveState.choices.indexOf(questions[questionIndex].answer);
  setDriveSteering(earlyCorrect===0?-1:1);
  check(solved&&driveState.phase==='success'&&progressData.stats.answered===earlyBefore+1,'early steering accepted immediately');
  setDriveSteering(earlyCorrect===0?-1:1);check(progressData.stats.answered===earlyBefore+1,'early answer counted once');
  check(progressData.learning.problems[earlyKey].history.at(-1).source==='drive','early answer saved');
  prepareDriveQuestion();check(!driveState.ready&&!answeredRecorded,'held steering not automatic answer');
  releaseDriveSteering();const retrySide=driveState.choices.indexOf(questions[questionIndex].answer);setDriveSteering(retrySide===0?1:-1);
  check(madeMistake&&!solved,'early incorrect retry');releaseDriveSteering();setDriveSteering(retrySide===0?-1:1);check(solved,'early incorrect can retry');
  const media=window.matchMedia;window.matchMedia=()=>({matches:true});releaseDriveSteering();tick(.2);setDriveSteering(-1);tick(.2);check(driveState.x<-.9,'reduced motion playable');window.matchMedia=media;
  for(const width of [320,390,768]){document.documentElement.style.width=`${width}px`;document.body.style.width=`${width}px`;check(byId('drive').getBoundingClientRect().right<=width,'drive fits width');check(byId('drive').scrollWidth<=byId('drive').clientWidth,'no overflow');}
  driveState.phase='question';renderDrive();
  for(const width of [320,390,768]) {
    document.documentElement.style.width=`${width}px`;document.body.style.width=`${width}px`;
    const scene=byId('drive-scene').getBoundingClientRect();
    for(const id of ['drive-problem','drive-signs']) {
      const box=byId(id).getBoundingClientRect();
      check(box.bottom<=scene.top+scene.height/3,'compact answers within top third');
      check(box.left>=scene.left&&box.right<=scene.right,'compact UI fits road scene');
    }
    check(byId('drive-road-marks').children.length===1,'no Y paint remains');
  }
  document.documentElement.style.width='';document.body.style.width='';showScreen('home');
  progressData.enabled.fill(false);openDriveSetup();check(byId('drive-start').disabled&&byId('drive-level').children.length===0,'no disabled levels offered');startDrive(3);check(screen==='drive-setup','locked level guard');
  progressData.enabled[0]=true;startGame(1);check(screen==='game'&&gameKind==='math'&&!driveState.running,'normal game after drive');
  startClock(1);check(gameKind==='clock'&&!driveState.running,'clock after drive');showScreen('home');
}
