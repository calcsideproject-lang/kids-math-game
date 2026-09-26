async function testLearning(check) {
  Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  progressData = freshProgress(); startGame(1);
  const q = questions[0], key = problemKey(q);
  questionTimer.start = performance.now() - 2400; questionTimer.wall = Date.now() - 2400;
  input = String(q.answer); checkAnswer();
  check(Math.abs(progressData.learning.problems[key].history[0].ms - 2400) < 80, 'first time 2.4s');
  check(byId('feedback').textContent.includes('パッと'), 'fast praise');
  nextQuestion();const wrongKey = problemKey(questions[1]);
  questionTimer.start = performance.now() - 4500; questionTimer.wall = Date.now() - 4500;
  input='99';checkAnswer();const original=JSON.stringify(progressData.learning.problems[wrongKey]);
  input=String(questions[1].answer);checkAnswer();check(JSON.stringify(progressData.learning.problems[wrongKey])===original,'retry not overwritten');
  check(!byId('feedback').textContent.includes('パッと'),'no fast praise on retry');
  nextQuestion();questionTimer.start=performance.now()-30000;questionTimer.wall=Date.now()-30000;input=String(questions[2].answer);checkAnswer();check(firstTiming===null,'30s excluded');
  nextQuestion();interruptQuestionTiming();input=String(questions[3].answer);checkAnswer();check(firstTiming===null,'background excluded');
  nextQuestion();questionTimer.wall=Date.now()-40000;input=String(questions[4].answer);checkAnswer();check(firstTiming===null,'sleep wall clock');
  const h=(n,ms=2000,correct=true)=>Array.from({length:n},()=>({correct,ms,at:Date.now(),answer:5}));
  check(mastery(h(2))==='collecting','two samples insufficient');check(mastery(h(3))==='fast','three fast');check(mastery(h(5,5000))==='steady','steady');check(mastery(h(5,15000))==='practice','slow practice');check(mastery(h(5,2000,false))==='practice','errors practice');check(mastery(h(5,null))==='collecting','no valid times');check(mastery([...h(2,2000,false),...h(3)])==='practice','accuracy gate');
  const fixed={op:'subtraction',a:8,b:3,answer:5};gameKind='math';screen='game';answeredRecorded=false;
  for(let i=0;i<20;i++){beginQuestionTiming(fixed);recordLearningAnswer(fixed,5,true);}
  check(progressData.learning.problems[problemKey(fixed)].history.length===8,'history capped');
  check(progressData.learning.problems[problemKey(fixed)].shown===20,'shown lifetime');
  const now=new Date(2026,8,26,12);progressData.learning=freshLearning();
  for(let offset=0;offset<25;offset++){
    const d=new Date(now);d.setDate(d.getDate()-offset);
    progressData.learning.days[dayKey(d)]={plays:{addition:1,subtraction:2,mixed:1},problems:{'addition:2:3':{n:10,c:offset<7?10:8,sum:offset<7?20000:50000,t:10,tail:h(5,offset<7?2000:5000)}}};
  }
  pruneLearning(progressData.learning,now);check(Object.keys(progressData.learning.days).length===14,'14 day cap');
  const current=periodReport('all',0,now),previous=periodReport('all',7,now);
  check(current.n===70&&current.c===70&&current.plays===28&&current.fast===1,'recent week');check(previous.n===70&&previous.c===56&&previous.fast===0,'previous week');
  check(current.sum/current.t===2000&&previous.sum/previous.t===5000,'weekly average');check(periodReport('subtraction',0,now).n===0&&periodReport('addition',0,now).plays===14,'operation filter');
  check(dateOffset(new Date(2026,0,1,0,1),-1)==='2025-12-31','year midnight');
  progressData.learning=freshLearning();progressData.learning.problems['subtraction:8:3']={shown:5,correct:5,wrong:0,lastShown:Date.now(),history:h(5,15000)};
  const pool=[{op:'subtraction',a:8,b:3,answer:5},{op:'subtraction',a:7,b:3,answer:4},{op:'addition',a:2,b:3,answer:5}];check(reviewCandidates(pool).length===2,'nearby review');
  for(let i=0;i<50;i++){const qs=createQuestions('mixed',20);check(qs.length===10&&qs.filter(q=>q.op==='addition').length===5&&new Set(qs.map(problemKey)).size===10,'review mixed unique');}
  const prior={...freshProgress(),stars:51,streak:9,lastDay:dayKey(),clock:{...freshClock(),medal:true,stats:{plays:4,answered:40,correct:35}},stats:{plays:5,answered:44,correct:38},recent:[{type:'addition-small',correct:false}]};delete prior.learning;
  localStorage.setItem(STORAGE_KEY,JSON.stringify(prior));progressData=loadProgress();check(progressData.stars===51&&progressData.clock.medal&&progressData.clock.stats.correct===35&&progressData.stats.correct===38&&progressData.recent.length===1,'v4 migration');check(Object.keys(progressData.learning.problems).length===0,'no invented old timing');
  startGame(1);input=String(questions[0].answer);checkAnswer();saveProgress();const loaded=loadProgress();check(Object.keys(loaded.learning.problems).length===1&&loaded.stars===51,'new timing reload');
  const reportClock=JSON.stringify(progressData.learning);startClock(1);input=String(questions[0].answer);checkAnswer();check(JSON.stringify(progressData.learning)===reportClock,'clock has no timing data');
  showScreen('home');showScreen('settings');check(screen==='home','unverified settings blocked');showScreen('report');check(screen==='home','unverified report blocked');
  byId('open-settings').click();check(byId('parent-gate').open&&screen==='home','gate protects settings');
  const submit = value => { byId('parent-answer').value=value; byId('parent-form').dispatchEvent(new Event('submit',{cancelable:true,bubbles:true})); };
  for(const invalid of ['', 'abc', '1', '1e2']){submit(invalid);check(screen==='home'&&byId('parent-gate').open&&!parentVerified,'invalid blocked');}
  check(byId('gate-status').textContent==='もういちど かくにんしてね','gentle retry');
  const expected=parentQuestion.a*parentQuestion.b;submit(String(expected));check(screen==='settings'&&parentVerified&&!byId('parent-gate').open,'correct entry');
  byId('open-report').click();byId('report-back').click();check(screen==='settings'&&parentVerified,'within parent no repeat');
  showScreen('home');check(!parentVerified,'home revokes access');
  let last='';for(let i=0;i<30;i++){openParentGate();const formula=byId('parent-question').textContent;check(formula!==last&&parentQuestion.a>=2&&parentQuestion.a<=9&&parentQuestion.b>=2&&parentQuestion.b<=9&&parentQuestion.a*parentQuestion.b>=12,'random multiplication');last=formula;byId('parent-cancel').click();check(parentQuestion===null&&!parentVerified,'cancel safe');}
  openParentGate();const fullWidth=String(parentQuestion.a*parentQuestion.b).replace(/[0-9]/g,c=>String.fromCharCode(c.charCodeAt(0)+0xfee0));submit(fullWidth);check(screen==='settings','fullwidth accepted');
  byId('open-report').click();check(screen==='report','report entry');for(const value of ['all','addition','subtraction']){byId('report-filter').value=value;renderReport();check(byId('report-summary').children.length===6,'filter cards');}
  const preserved={stars:progressData.stars,clock:progressData.clock.medal,streak:progressData.streak};requestReset('learning');byId('reset-cancel').click();check(progressData.stats.answered>0,'cancel learning reset');requestReset('learning');byId('reset-confirm-button').click();check(progressData.stats.answered===0&&progressData.clock.stats.answered===0&&Object.keys(progressData.learning.problems).length===0,'learning reset');check(progressData.stars===preserved.stars&&progressData.clock.medal===preserved.clock&&progressData.streak===preserved.streak,'learning reset preserves rewards');
  requestReset('all');byId('reset-confirm-button').click();check(progressData.stars===0&&!progressData.clock.medal,'full reset');
  // Audio API is stubbed: verify scheduling and OFF suppression without emitting sound.
  let tones=0;audioContext={state:'running',currentTime:0,destination:{},createOscillator(){tones++;return {frequency:{},connect(){},disconnect(){},start(){},stop(){}};},createGain(){return {gain:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}};}};
  progressData.sound=false;playSound('correct');check(tones===0,'sound off');byId('sound-toggle').click();playSound('correct');playSound('clear');check(tones===6,'sound on');byId('sound-toggle').click();playSound('clear');check(tones===6,'sound off again');
  // Real layout at narrow content widths, independent of Chrome's minimum outer window size.
  showScreen('report');byId('report-filter').value='all';renderReport();
  for(const width of [320,390,768]){document.documentElement.style.width=`${width}px`;document.body.style.width=`${width}px`;check(byId('report').getBoundingClientRect().right<=width,'narrow report');check(byId('report-summary').scrollWidth<=byId('report-summary').clientWidth,'report no overflow');}
  document.documentElement.style.width='';document.body.style.width='';
}
