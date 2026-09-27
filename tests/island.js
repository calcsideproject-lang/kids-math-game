async function testIsland(check) {
  localStorage.removeItem(ISLAND_KEY);
  const old={...freshProgress(),stars:150,lastDay:dayKey(),streak:5,cleared:[1,6],clock:{...freshClock(),medal:true}};
  delete old.islandEarned;
  localStorage.setItem(STORAGE_KEY,JSON.stringify(old));progressData=loadProgress();
  check(progressData.stars===150&&progressData.islandEarned===150,'legacy stars credited safely');
  openIsland();check(screen==='island'&&islandBalance()===150&&islandData.items.length===0,'initial island wallet');
  check(byId('island-objects').children.length===3,'starter home and trees');
  check(byId('island-friends').textContent.includes('👑'),'legacy friends visit');
  check(byId('island-message').textContent.includes('げんき'),'daily island message');
  const beforeLearning=JSON.stringify(progressData.learning),beforeStats=JSON.stringify(progressData.stats);
  selectIslandItem('tree');check(islandBalance()===150,'selection free');beginIslandPlacement();
  for(const [x,y] of [[0,0],[1,1],[-.1,.5],[NaN,.5],[.28,.65],[.22,.51]])check(!placeIslandItem(x,y)&&islandBalance()===150,'invalid water path collision free');
  check(placeIslandItem(.52,.47)&&islandBalance()===130,'place charges once');
  check(progressData.stars===150,'spend leaves cumulative stars');
  renderCollection();check(byId('collection-grid').textContent.includes('おうかん')&&byId('island-friends').textContent.includes('👑'),'spending preserves collection unlocks');
  check(!placeIslandItem(.65,.5)&&islandBalance()===130,'double tap does not spend');
  const setBeforeUndo=Storage.prototype.setItem;Storage.prototype.setItem=()=>{throw Error('quota');};check(!undoIslandPlacement()&&islandBalance()===130&&islandData.items.length===1,'failed undo changes neither item nor stars');Storage.prototype.setItem=setBeforeUndo;
  const saved=JSON.stringify(islandData);progressData=loadProgress();openIsland();
  check(JSON.stringify(islandData)===saved&&islandBalance()===130,'reload restores placement and spent');
  for(let i=0;i<5;i++){saveProgress();progressData=loadProgress();openIsland();check(islandBalance()===130,'migration idempotent');}
  selectIslandItem('castle');beginIslandPlacement();check(!islandPlacing&&!placeIslandItem(.7,.7)&&islandBalance()===130,'insufficient stars cannot place');
  check(undoIslandPlacement()&&islandBalance()===150&&islandData.items.length===0,'undo refunds');
  openIsland();check(!undoIslandPlacement()&&islandBalance()===150,'undo refund exactly once after reload');
  for(const [type,x,y] of [['flower',.45,.35],['flower',.54,.35],['tree',.66,.36],['tree',.77,.44],['house',.44,.59],['house',.59,.61]]) {
    selectIslandItem(type);beginIslandPlacement();check(placeIslandItem(x,y),'repeatable '+type);
  }
  check(islandData.items.length===6&&islandBalance()===30,'multiple flowers trees houses');
  selectIslandItem('flower');beginIslandPlacement();byId('island-cancel').click();check(!islandPlacing&&!placeIslandItem(.7,.7)&&islandBalance()===30,'cancel without spend');
  check(JSON.stringify(progressData.learning)===beforeLearning&&JSON.stringify(progressData.stats)===beforeStats,'island never changes learning');
  const beforeSnapshot=JSON.stringify(islandData);
  const setter=Storage.prototype.setItem;
  Storage.prototype.setItem=function(key,value){if(key===ISLAND_KEY)throw Error('quota');return setter.call(this,key,value);};
  selectIslandItem('flower');beginIslandPlacement();check(!placeIslandItem(.73,.65),'failed persistence prevents placement');
  check(JSON.stringify(islandData)===beforeSnapshot&&islandBalance()===30,'failed placement preserves stars and map');
  Storage.prototype.setItem=setter;
  check(placeIslandItem(.73,.65)&&islandBalance()===20,'placement retry after storage restored');
  const beforeAward=islandBalance();gameKind='math';activeLevel=1;firstTryCorrect=10;awardCompletion();openIsland();
  check(progressData.stars===153&&islandBalance()===beforeAward+3,'math reward funds island');
  firstTryCorrect=8;gameKind='clock';activeLevel=1;awardCompletion();openIsland();check(islandBalance()===beforeAward+6,'clock reward funds island');
  firstTryCorrect=5;gameKind='drive';activeLevel=1;awardCompletion();openIsland();check(islandBalance()===beforeAward+8,'drive reward funds island');
  const preserved=JSON.stringify(islandData),wallet=islandBalance(),earned=progressData.islandEarned;
  requestReset('all');byId('reset-confirm-button').click();openIsland();
  check(JSON.stringify(islandData)===preserved&&islandBalance()===wallet&&progressData.islandEarned===earned&&progressData.stars===0,'progress reset preserves island and wallet');
  progressData=loadProgress();openIsland();check(islandBalance()===wallet,'reset reload no recredit');
  firstTryCorrect=0;gameKind='math';activeLevel=1;awardCompletion();openIsland();check(islandBalance()===wallet+1,'earn after reset');
  requestReset('learning');byId('reset-confirm-button').click();openIsland();check(JSON.stringify(islandData)===preserved&&islandBalance()===wallet+1,'learning reset preserves island');
  for(const width of [320,390,768,1200]) {
    document.documentElement.style.width=`${width}px`;document.body.style.width=`${width}px`;
    const map=byId('island-map').getBoundingClientRect();
    check(Math.abs(map.width/map.height-1000/760)<.01,'map aspect ratio stable');
    check(byId('island').scrollWidth<=byId('island').clientWidth,'island no overflow '+width);
    check(byId('island-items').scrollWidth<=byId('island-items').clientWidth,'items fit '+width);
    check(islandData.items[0].x===.45&&islandData.items[0].y===.35,'coordinates invariant');
  }
  document.documentElement.style.width='';document.body.style.width='';
  // Real event coordinates go through the SVG transform, with no drag required.
  selectIslandItem('flower');beginIslandPlacement();
  const point=new DOMPoint(500,550).matrixTransform(byId('island-map').getScreenCTM());
  byId('island-map').dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:point.x,clientY:point.y}));
  check(islandData.items.at(-1).type==='flower'&&Math.abs(islandData.items.at(-1).x-islandCell(4,3).x)<.005,'tap coordinates converted');
  const media=window.matchMedia;window.matchMedia=()=>({matches:true});renderIsland();check(islandBalance()>=0,'reduced motion render');window.matchMedia=media;
  byId('island-drive').click();check(screen==='drive-setup'&&!driveState.running,'island leads to drive setup');
  byId('drive-setup-back').click();check(screen==='home','drive back home');
  openIsland();byId('island-home').click();check(screen==='home','island back home');
  const original=localStorage.getItem(ISLAND_KEY);localStorage.setItem(ISLAND_KEY,'{broken');openIsland();
  check(!islandWritable&&!placeIslandItem(.5,.5)&&localStorage.getItem(ISLAND_KEY)==='{broken','corrupt storage not overwritten');
  localStorage.setItem(ISLAND_KEY,original);openIsland();check(islandWritable,'recover after storage repaired');
  // Ensure large footprints cannot overlap or cross the coast.
  const data=freshIsland();data.items=[{id:1,type:'castle',x:.6,y:.5,cost:200}];
  check(!islandCanPlace(data,'wheel',.6,.5)&&!islandCanPlace(data,'castle',.95,.5),'large building collisions');
  showScreen('home');
  for(const width of [320,390,768]) {
    document.documentElement.style.width=`${width}px`;document.body.style.width=`${width}px`;
    check(byId('home').scrollWidth<=byId('home').clientWidth,'play cards fit '+width);
  }
  document.documentElement.style.width='';document.body.style.width='';
}


async function testIslandGrid(check) {
  progressData={...freshProgress(),stars:1000,islandEarned:1000};
  // 旧自由配置は位置を変えず読み込む。
  const legacy={version:1,spent:10,nextId:2,undoId:1,items:[{id:1,type:'flower',x:.53,y:.48,cost:10}]};
  localStorage.setItem(ISLAND_KEY,JSON.stringify(legacy));openIsland();
  check(islandData.items[0].x===.53&&islandData.items[0].y===.48,'legacy coordinates retained');
  check(!document.getElementById('island-cursor'),'ambiguous dotted cursor removed');
  check(byId('island-grid').getAttribute('visibility')==='hidden','normal grid hidden');
  selectIslandItem('tree');check(byId('island-grid').children.length===0,'selection does not show grid');beginIslandPlacement();
  check(byId('island-grid').getAttribute('visibility')==='visible'&&byId('island-grid').children.length>0,'placement grid visible');
  const balance=islandBalance();check(!placeIslandCell(-1,0)&&!placeIslandCell(0,0)&&islandBalance()===balance,'invalid grid no charge');
  const cells=[...byId('island-grid').children];
  check(cells.every(r=>islandCellAvailable(islandData,'tree',islandCell(+r.dataset.row,+r.dataset.column))),'every displayed cell is available');
  const chosen=cells[Math.floor(cells.length/2)],row=+chosen.dataset.row,column=+chosen.dataset.column;
  check(placeIslandCell(row,column)&&islandBalance()===balance-20,'valid cell charges once');
  check(byId('island-grid').children.length===0&&byId('island-grid').getAttribute('visibility')==='hidden','success hides grid');
  check(byId('island-placement-flash').children.length===1,'brief selected cell response');
  const last=islandData.items.at(-1),snapshot=JSON.stringify(last);openIsland();
  check(JSON.stringify(islandData.items.at(-1))===snapshot&&last.row===row&&last.column===column,'grid coordinates persist');
  selectIslandItem('castle');beginIslandPlacement();check(!placeIslandCell(row,column)&&islandBalance()===balance-20,'occupied grid rejects large item');
  byId('island-cancel').click();check(byId('island-grid').children.length===0&&islandBalance()===balance-20,'cancel clears grid no charge');
  for(const width of [320,390,768]) {
    document.documentElement.style.width=width+'px';document.body.style.width=width+'px';
    selectIslandItem('flower');beginIslandPlacement();
    const rect=byId('island-grid').firstElementChild;
    const cell=islandCell(+rect.dataset.row,+rect.dataset.column);
    const point=new DOMPoint(cell.x*1000,cell.y*760).matrixTransform(byId('island-map').getScreenCTM());
    const before=islandBalance();byId('island-map').dispatchEvent(new MouseEvent('click',{clientX:point.x,clientY:point.y,bubbles:true}));
    check(islandBalance()===before-10&&islandData.items.at(-1).row===cell.row,'touch coordinate grid '+width);
    check(byId('island').scrollWidth<=byId('island').clientWidth,'grid layout '+width);
  }
  document.documentElement.style.width='';document.body.style.width='';
  await new Promise(resolve=>setTimeout(resolve,400));check(byId('island-placement-flash').children.length===0,'selection response cleared');
  showScreen('home');
}

async function testExpandedIslandGrid(check) {
  const cells=[];
  for(let row=0;row<ISLAND_GRID.rows;row++)for(let column=0;column<ISLAND_GRID.columns;column++) {
    const cell=islandCell(row,column);
    if(islandCellAvailable(freshIsland(),'flower',cell))cells.push(cell);
  }
  check(cells.length===20,'20 initial flower spaces');
  check(cells.some(c=>c.x<.25)&&cells.some(c=>c.x>.75),'spaces on both sides');
  const filled=freshIsland();
  for(const cell of cells){check(islandCellAvailable(filled,'flower',cell),'all 20 flowers coexist');filled.items.push({id:filled.items.length+1,type:'flower',...cell,cost:10,gridVersion:2});}
  const occupied=freshIsland();
  const large=cells.find(c=>islandCellAvailable(occupied,'castle',c));check(Boolean(large),'castle has an initial valid site');
  occupied.items.push({id:1,type:'castle',...large,cost:200,gridVersion:2});
  for(const part of islandFootprint('castle',large.row,large.column))check(!islandCellAvailable(occupied,'flower',part),'castle reserves 2x2 cells');
  occupied.items=[{id:1,type:'flower',...islandCell(large.row+1,large.column+1),cost:10,gridVersion:2}];
  check(!islandCellAvailable(occupied,'castle',large),'castle rejects partly occupied footprint');
  const old={version:1,spent:20,nextId:2,undoId:1,items:[{id:1,type:'tree',row:2,column:2,x:.5,y:380/760,cost:20}]};
  localStorage.setItem(ISLAND_KEY,JSON.stringify(old));openIsland();check(islandData.items[0].x===.5&&islandData.items[0].y===.5,'old five-column grid positions preserved');
  selectIslandItem('flower');beginIslandPlacement();
  for(const width of [320,390,768]){
    document.documentElement.style.width=width+'px';document.body.style.width=width+'px';
    const rect=byId('island-grid').firstElementChild.getBoundingClientRect();
    check(rect.width>=44&&rect.height>=44,'tap areas at least 44px '+width);
    check(byId('island').scrollWidth<=byId('island').clientWidth,'scroll contained '+width);
  }
  document.documentElement.style.width='';document.body.style.width='';showScreen('home');
}
