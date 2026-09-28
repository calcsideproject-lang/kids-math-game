async function testEducation(check) {
  const h=(n,ms=5000,correct=true,hintUsed=false,source='math')=>Array.from({length:n},()=>({ms,correct,hintUsed,source,at:Date.now(),answer:5}));
  check(learningBand(h(5)).band==='fluent','stable correct fluent without speed race');
  check(!learningBand(h(2)).confident,'sparse history unconfirmed');
  check(learningBand([...h(4),...h(1,12000,false)]).band!=='challenge','single error not challenge');
  check(learningBand([...h(4),...h(1,22000)]).band==='fluent','single slow answer not downgraded');
  check(learningBand(h(5,18000)).band==='practice','repeated slow normal answers practice');
  check(learningBand(h(5,18000,true,false,'drive')).band==='fluent','drive time not normal speed');
  check(learningBand(h(5,1000,true,true)).band==='practice','hint success practice');
  check(learningBand(h(5,1000,false)).band==='challenge','repeated errors challenge');
  const saved=progressData;progressData=freshProgress();
  for(const mode of ['subtraction','three-number','mixed'])for(let i=0;i<30;i++) {
    const qs=createQuestions(mode,20);
    check(qs.length===10&&new Set(qs.map(problemKey)).size===10,'balanced unique ten');
    check(qs.filter(q=>questionDifficulty(q)<2).length>=7,'cold start mostly approachable');
    if(mode==='mixed')check(qs.filter(q=>q.op==='addition').length===5,'mixed retains 5+5');
  }
  const pool=[];
  for(let a=1;a<=18;a++)for(let b=1;b<=a;b++)pool.push({a,b,op:'subtraction',answer:a-b});
  const fluent=pool.filter(q=>!subtractionBorrowing(q)).slice(0,35);
  for(const q of fluent)progressData.learning.problems[problemKey(q)]={history:h(5),shown:5,correct:5,wrong:0,lastShown:Date.now()};
  for(const q of pool.filter(q=>subtractionBorrowing(q)))progressData.learning.problems[problemKey(q)]={history:h(5,15000),shown:5,correct:5,wrong:0,lastShown:Date.now()};
  for(const q of pool.filter(q=>q.a>=14&&subtractionBorrowing(q)).slice(0,8))progressData.learning.problems[problemKey(q)].history=h(5,6000,false);
  const before=JSON.stringify(progressData);
  for(let i=0;i<50;i++) {
    const qs=selectLearningQuestions(pool,'subtraction');
    check(qs.filter(q=>learningBand(progressData.learning.problems[problemKey(q)]?.history).band==='fluent').length>=7,'fluent continues to appear');
    check(qs.filter(q=>learningBand(progressData.learning.problems[problemKey(q)]?.history).band==='challenge').length<=1,'challenge capped');
    check(qs.filter(q=>subtractionBorrowing(q)).length<=3&&qs.some(q=>subtractionBorrowing(q)),'borrowing limited but included');
    check(new Set(qs.map(problemKey)).size===10,'no duplicate formula');
  }
  check(JSON.stringify(progressData)===before,'classification and selection do not mutate storage data');
  const growth=problemGrowth([...h(3,6200),...h(3,3800)]);
  check(growth.improving&&growth.before===6200&&growth.recent===3800,'same formula improvement');
  check(problemGrowth(h(5))===null,'growth needs two groups of three');
  check(problemGrowth([...h(3,6200),...h(3,3800,true,true)])===null,'hint comparisons not mixed');
  check(problemGrowth(h(8,1000,true,false,'drive'))===null,'drive excluded from growth timing');
  parentVerified=true;showScreen('report');
  progressData.learning.problems['subtraction:14:8']={history:[...h(3,6200),...h(3,3800)],shown:6,correct:6,wrong:0,lastShown:Date.now()};
  byId('report-filter').value='borrowing';renderReport();
  check(byId('problem-report').textContent.includes('以前 6.2秒 → 最近 3.8秒'),'parent comparison visible');
  saveProgress();progressData=loadProgress();check(progressData.learning.problems['subtraction:14:8'].history.length===6,'history unchanged on reload');
  check(!JSON.stringify(progressData.learning).includes('"band"'),'bands not persisted');
  progressData=saved;showScreen('home');
}

async function testLevelRange(check) {
  const saved=progressData;progressData=freshProgress();
  for(const mode of ['addition','subtraction','mixed'])for(let i=0;i<80;i++) {
    const qs=createQuestions(mode,20);
    check(qs.filter(usesUpperRange).length>=5,'20 level retains upper range '+mode);
    check(qs.length===10&&new Set(qs.map(problemKey)).size===10,'range balance unique ten');
    check(qs.filter(q=>questionDifficulty(q)<2).length>=7,'range keeps approachable successes');
    if(mode==='mixed')check(qs.filter(q=>q.op==='addition').length===5,'range retains mixed 5+5');
  }
  const history=Array.from({length:5},()=>({correct:true,ms:4500,hintUsed:false,source:'math'}));
  for(const op of ['addition','subtraction'])for(let a=0;a<=20;a++)for(let b=0;b<=20;b++) {
    const answer=calculateStep(a,op,b);if(answer<0||answer>20)continue;
    const q={a,b,op,answer};
    if(questionDifficulty(q)<2)progressData.learning.problems[problemKey(q)]={shown:5,correct:5,wrong:0,lastShown:Date.now(),history};
  }
  for(const mode of ['addition','subtraction','mixed'])for(let i=0;i<30;i++) {
    const qs=createQuestions(mode,20);
    check(qs.filter(usesUpperRange).length>=5,'familiar questions retain level scope');
    check(qs.filter(q=>learningBand(progressData.learning.problems[problemKey(q)]?.history).band==='fluent').length>=7,'seven fluent when enough in range');
    check(qs.filter(q=>learningBand(progressData.learning.problems[problemKey(q)]?.history).band==='challenge').length<=1,'range does not flood challenge');
  }
  progressData=freshProgress();
  window.levelRangeExamples={addition:createQuestions('addition',20).map(questionLabel),subtraction:createQuestions('subtraction',20).map(questionLabel)};
  progressData=saved;
}

async function testCalculationExperience(check) {
  const saved=progressData;progressData=freshProgress();
  for(const mode of ['addition','subtraction','mixed'])for(let i=0;i<100;i++) {
    const qs=createQuestions(mode,20),cross=qs.filter(crossesTen);
    check(cross.length>=2&&cross.length<=3,'some crossing without domination');
    check(qs.filter(upperPractice).length>=5,'meaningful upper-level experiences');
    check(qs.filter(q=>q.a===0||q.b===0).length<=1,'zero capped at one');
    check(qs.length===10&&new Set(qs.map(problemKey)).size===10,'experience unique ten');
    if(mode==='mixed')check(qs.filter(q=>q.op==='addition').length===5&&cross.some(q=>q.op==='addition')&&cross.some(q=>q.op==='subtraction'),'mixed both experiences and five each');
  }
  window.levelRangeExamples={};
  for(const mode of ['addition','subtraction'])window.levelRangeExamples[mode]=Array.from({length:3},()=>{
    const qs=createQuestions(mode,20);return {questions:qs.map(questionLabel),review:qs.filter(q=>learningScope(q)==='review').length,current:qs.filter(q=>learningScope(q)==='current').length,crossing:qs.filter(crossesTen).length};
  });
  progressData=saved;
}

async function testScopeBalance(check) {
  const saved=progressData;progressData=freshProgress();
  for(const withTrend of [false,true])for(const mode of ['addition','subtraction','mixed']) {
    progressData.recent=withTrend?Array.from({length:3},()=>({type:`${mode==='mixed'?'addition':mode}-cross`,correct:false})):[];
    for(let i=0;i<70;i++) {
      const qs=createQuestions(mode,20),count=scope=>qs.filter(q=>learningScope(q)===scope).length;
      check(qs.length===10&&new Set(qs.map(problemKey)).size===10,'scope ten unique');
      check(count('review')===3&&count('current')===(withTrend?4:5)&&count('focus')===(withTrend?3:2),'three separate content groups');
      check(qs.filter(veryEasyPattern).length<=1,'combined trivial patterns capped');
      check(qs.filter(q=>q.a===0||q.b===0).length<=1,'zero cap maintained');
      if(mode==='mixed')check(qs.filter(q=>q.op==='addition').length===5,'scope mixed five each');
    }
  }
  check(learningScope({a:18,b:3,op:'subtraction',answer:15})==='current','18-3 current');
  check(learningScope({a:14,b:13,op:'subtraction',answer:1})==='review','nearby big operands review');
  check(veryEasyPattern({a:2,b:2,op:'addition',answer:4}),'tiny addition limited');
  const q={a:18,b:3,op:'subtraction',answer:15};
  check(learningBand(Array.from({length:5},()=>({correct:true,ms:5000,hintUsed:false}))).band==='fluent'&&learningScope(q)==='current','current can be fluent independently');
  progressData=saved;
}
