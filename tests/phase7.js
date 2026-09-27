async function testPhase7(check) {
  const borrowing={op:'subtraction',a:14,b:8,answer:6};
  check(subtractionBorrowing(borrowing),'14-8 borrowing');
  check(!subtractionBorrowing({op:'subtraction',a:15,b:3,answer:12}),'15-3 no borrowing');
  const pool=threeNumberPool();
  check(pool.length>100,'varied triple pool');
  for(const q of pool) {
    check(q.firstStep.answer>=0&&q.firstStep.answer<=20&&q.answer>=0&&q.answer<=20,'triple bounds');
    check(q.firstStep.answer===calculateStep(q.a,q.op,q.b)&&q.answer===calculateStep(q.firstStep.answer,q.op2,q.c),'left to right steps');
    check(parseProblem(problemKey(q)).answer===q.answer,'triple key roundtrip');
  }
  check(parseProblem('three-number:3:subtraction:9:addition:8')===null,'invalid middle rejected');
  const legacy={...freshProgress(),stars:51,streak:4,lastDay:dayKey(),enabled:[true,true,true,true,true],clock:{...freshClock(),medal:true}};
  legacy.learning.problems['subtraction:14:8']={shown:3,correct:0,wrong:3,lastShown:Date.now(),history:Array.from({length:3},()=>({correct:false,ms:6000,at:Date.now(),answer:7}))};
  localStorage.setItem(STORAGE_KEY,JSON.stringify(legacy));progressData=loadProgress();
  check(progressData.stars===51&&progressData.streak===4&&progressData.clock.medal&&!progressData.enabled[5],'phase6 preserves awards and defaults');
  check(progressData.learning.problems['subtraction:14:8'].subtractionBorrowing,'legacy borrowing inferred');
  check(progressData.learning.problems['subtraction:14:8'].history.every(s=>s.hintUsed===false),'legacy hints default');
  const nearby=[borrowing,{op:'subtraction',a:13,b:8,answer:5},{op:'subtraction',a:14,b:7,answer:7},{op:'subtraction',a:15,b:3,answer:12}];
  check(reviewCandidates(nearby).length===3,'near borrowing review excludes nonborrowing');
  for(let i=0;i<30;i++)check(new Set(createQuestions('subtraction',20).map(problemKey)).size===10,'borrowing review unique');
  parentVerified=true;showScreen('report');
  for(const filter of ['all','borrowing','three-number']) {byId('report-filter').value=filter;renderReport();check(byId('report-summary').textContent.length>0,'legacy category report');}
  gameKind='math';beginQuestionTiming(borrowing);
  questionTimer.start=performance.now()-4000;questionTimer.wall=Date.now()-4000;
  recordLearningAnswer(borrowing,6,true);
  beginQuestionTiming(nearby[3]);recordLearningAnswer(nearby[3],12,true);
  const borrowReport=periodReport('borrowing');
  check(borrowReport.n===1&&borrowReport.c===1&&borrowReport.t===1&&Math.abs(borrowReport.sum-4000)<100,'borrowing report excludes nonborrow');
  saveProgress();progressData=loadProgress();check(periodReport('borrowing').n===1,'borrowing report survives reload');
  progressData.enabled[5]=true;startGame(6);
  const q=threeNumber(9,'subtraction',4,'addition',5);questions[0]=q;renderQuestion();
  check(!byId('hint-controls').hidden&&byId('hint-text').textContent==='','hint initially hidden content');
  const timer=questionTimer.start;byId('math-hint').click();
  check(hintUsed&&byId('hint-text').textContent==='まず 9 − 4 を かんがえてみよう','first hint');
  byId('math-hint').click();check(byId('hint-text').textContent==='9 − 4 = 5。つぎは 5 + 5 だよ'&&!byId('hint-text').textContent.includes('10'),'second hint no final answer');
  check(questionTimer.start===timer,'hint preserves timer');input='10';checkAnswer();
  const record=progressData.learning.problems[problemKey(q)];
  check(!byId('feedback').textContent.includes('パッと'),'hint receives regular positive praise');
  check(record.history[0].hintUsed&&record.history[0].source==='math'&&record.firstStep.answer===5&&record.secondStep.answer===10,'triple record');
  check(mastery(Array.from({length:5},()=>({correct:true,ms:1000,hintUsed:true})))!=='fast','hints cannot imply fast mastery');
  check(mastery(Array.from({length:3},()=>({correct:true,ms:1000,hintUsed:false})))==='fast','independent mastery retained');
  saveProgress();progressData=loadProgress();check(progressData.learning.problems[problemKey(q)].history[0].hintUsed,'hint persists');
  const report=periodReport('three-number');check(report.n===1&&report.c===1&&report.hints===1&&report.plays===1,'triple report aggregates');
  const stars=progressData.stars;
  for(let i=1;i<10;i++){nextQuestion();check(!hintUsed,'hint resets each question');input=String(questions[i].answer);checkAnswer();}nextQuestion();
  check(screen==='result'&&progressData.stars===stars+3&&progressData.cleared.includes(6),'triple ten questions rewards');
  byId('again').click();input='99';checkAnswer();const wrong=progressData.learning.problems[problemKey(questions[0])].history.at(-1);byId('math-hint').click();
  check(wrong.hintUsed&&!wrong.correct,'hint after wrong tracked without rewriting accuracy');
  for(const width of [320,390,768]){document.documentElement.style.width=`${width}px`;document.body.style.width=`${width}px`;check(byId('game').scrollWidth<=byId('game').clientWidth,'triple fits narrow screen');byId('problem').textContent='10 − 9 − 9';byId('answer').textContent='20';const parts=[...byId('math-equation').children].map(el=>el.getBoundingClientRect());check(parts.every(r=>Math.abs((r.top+r.bottom)/2-(parts[0].top+parts[0].bottom)/2)<2),'triple equation stays on one line');check(byId('math-equation').scrollWidth<=byId('math-equation').clientWidth,'full triple equation fits');}
  document.documentElement.style.width='';document.body.style.width='';
  parentVerified=true;showScreen('report');byId('report-filter').value='three-number';renderReport();check(byId('problem-report').textContent.includes('ヒントあり'),'parent hint history visible');
  openDriveSetup();check(![...byId('drive-level').options].some(o=>o.value==='6'),'drive excludes triple');startDrive(6);check(screen==='drive-setup','drive triple guarded');
  startClock(1);check(byId('hint-controls').hidden,'clock no math hints');showScreen('home');
}
