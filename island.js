'use strict';
// 星の消費と配置は、この1つのキーへ一緒に保存する。
const ISLAND_KEY = 'kids-math-game.island.v1';
const ISLAND_LIMIT = 240;
const ISLAND_ITEMS = [
  { type: 'flower', name: 'おはな', emoji: '🌷', cost: 10, size: 44, repeatable: true },
  { type: 'tree', name: 'おおきなき', emoji: '🌳', cost: 20, size: 72, repeatable: true },
  { type: 'house', name: 'おうち', emoji: '🏠', cost: 30, size: 82, repeatable: true },
  { type: 'park', name: 'こうえん', emoji: '🛝', cost: 50, size: 90, repeatable: true },
  { type: 'fountain', name: 'ふんすい', emoji: '⛲', cost: 60, size: 86, repeatable: true },
  { type: 'ice', name: 'アイスやさん', emoji: '🍦', cost: 80, size: 78, repeatable: true },
  { type: 'wheel', name: 'かんらんしゃ', emoji: '🎡', cost: 120, size: 110, repeatable: true },
  { type: 'castle', name: 'おしろ', emoji: '🏰', cost: 200, size: 116, repeatable: true }
];
const ISLAND_STARTERS = [
  { id: 'home', type: 'house', x: .28, y: .35 },
  { id: 'tree1', type: 'tree', x: .22, y: .51 },
  { id: 'tree2', type: 'tree', x: .34, y: .24 }
];
const islandItem = type => ISLAND_ITEMS.find(item => item.type === type);
const freshIsland = () => ({ version: 1, spent: 0, nextId: 1, undoId: null, items: [] });
let islandData = freshIsland(), islandSelected = null, islandPlacing = false, islandWritable = true;
const ISLAND_GRID = { columns: 6, rows: 5, left: 125, top: 135, width: 125, height: 100 };
let islandCursor = { row: 2, column: 2 };
let islandFlashTimer = null;
function islandBalance(data = islandData) { return Math.max(0, progressData.islandEarned - data.spent); }
function islandMessage(text) { byId('island-message').textContent = text; }
function islandOnGrass(x, y, size) {
  // 同じ比率のSVG座標で描画と当たり判定を行う。外接四隅も草地内に収める。
  const r = size / 2;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  return [-r, r].every(dx => [-r, r].every(dy => {
    const px = x * 1000 + dx, py = y * 760 + dy;
    const inside = ((px - 500) / 410) ** 2 + ((py - 385) / 285) ** 2 <= 1;
    const onPath = px >= 245 && px <= 315 && py >= 295 && py <= 675;
    return inside && !onPath;
  })) && !(Math.abs(x * 1000 - 280) < 35 + r && y * 760 + r > 295 && y * 760 - r < 675);
}
function islandCanPlace(data, type, x, y) {
  const item = islandItem(type);
  if (!item || !islandOnGrass(x, y, item.size)) return false;
  return [...ISLAND_STARTERS, ...data.items].every(other => {
    const distance = Math.hypot((x-other.x)*1000, (y-other.y)*760);
    return distance >= (item.size + islandItem(other.type).size) * .46;
  });
}
function islandCell(row, column) {
  if (!Number.isInteger(row) || !Number.isInteger(column) || row < 0 || row >= ISLAND_GRID.rows || column < 0 || column >= ISLAND_GRID.columns) return null;
  return { row, column, x: (ISLAND_GRID.left + (column+.5)*ISLAND_GRID.width)/1000,
    y: (ISLAND_GRID.top + (row+.5)*ISLAND_GRID.height)/760 };
}
function islandFootprint(type,row,column) {
  const span=['wheel','castle'].includes(type)?2:1;
  return Array.from({length:span*span},(_,i)=>islandCell(row+Math.floor(i/span),column+i%span));
}
function islandCellAvailable(data, type, cell) {
  if (!cell || !islandCanPlace(data,type,cell.x,cell.y)) return false;
  const footprint=islandFootprint(type,cell.row,cell.column);
  return footprint.every(part=>part && islandCanPlace(data,'flower',part.x,part.y) && !data.items.some(p=>
    p.gridVersion===2 && islandFootprint(p.type,p.row,p.column).some(used=>used && used.row===part.row && used.column===part.column)));
}
function renderIslandGrid() {
  const layer=byId('island-grid');
  layer.replaceChildren();layer.setAttribute('visibility',islandPlacing?'visible':'hidden');
  if (!islandPlacing) return;
  // 大きな四角の四隅だけで候補を捨てず、ペイントを草地に沿って切り抜く。
  byId('island-grid-holes').replaceChildren(...[...ISLAND_STARTERS,...islandData.items].map(p=>
    svgElement('circle',{cx:p.x*1000,cy:p.y*760,r:islandItem(p.type).size*.5,fill:'black'})));
  for(let row=0;row<ISLAND_GRID.rows;row++)for(let column=0;column<ISLAND_GRID.columns;column++) {
    const cell=islandCell(row,column);
    if (!islandCellAvailable(islandData,islandSelected,cell)) continue;
    const rect=svgElement('rect',{x:cell.x*1000-ISLAND_GRID.width/2+4,y:cell.y*760-ISLAND_GRID.height/2+4,
      width:ISLAND_GRID.width-8,height:ISLAND_GRID.height-8,rx:16,class:'island-cell',
      'data-row':row,'data-column':column,'aria-label':`${row+1}だんめ ${column+1}ばんめ`,
      'data-focused':row===islandCursor.row&&column===islandCursor.column});
    layer.append(rect);
  }
}
function placeIslandCell(row,column) {
  if (!islandPlacing || screen!=='island') return false;
  const latest=readIsland();if(!latest)return false;
  islandData=latest;
  const cell=islandCell(row,column);
  if(!islandCellAvailable(latest,islandSelected,cell)) {
    renderIslandGrid();islandMessage('マスが あるところに おいてみよう！');return false;
  }
  if(!placeIslandItem(cell.x,cell.y,cell))return false;
  const flash=byId('island-placement-flash');
  clearTimeout(islandFlashTimer);
  flash.replaceChildren(svgElement('rect',{x:cell.x*1000-ISLAND_GRID.width/2+4,y:cell.y*760-ISLAND_GRID.height/2+4,width:ISLAND_GRID.width-8,height:ISLAND_GRID.height-8,rx:16,class:'island-cell-flash'}));
  islandFlashTimer=setTimeout(()=>flash.replaceChildren(),350);
  return true;
}
function readIsland() {
  try {
    const raw = localStorage.getItem(ISLAND_KEY);
    if (raw === null) { islandWritable = true; return freshIsland(); }
    const value = JSON.parse(raw);
    // 読めない保存内容を空の島で上書きしない。
    if (!value || value.version !== 1 || !Array.isArray(value.items) || value.items.length > ISLAND_LIMIT || !Number.isSafeInteger(value.spent) || value.spent < 0) throw Error('island data');
    const ids = new Set();
    for (const p of value.items) {
      if (!p || !islandItem(p.type) || !Number.isSafeInteger(p.id) || p.id < 1 || ids.has(p.id) || !islandOnGrass(p.x,p.y,islandItem(p.type).size) || !Number.isSafeInteger(p.cost) || p.cost < 0) throw Error('island item');
      ids.add(p.id);
    }
    if (value.spent !== value.items.reduce((sum,p)=>sum+p.cost,0)) throw Error('island spent');
    islandWritable = true;
    return { version: 1, spent: value.spent, nextId: Math.max(safeCount(value.nextId), ...value.items.map(p => p.id+1), 1),
      undoId: value.items.at(-1)?.id === value.undoId ? value.undoId : null,
      items: value.items.map(p => ({ id:p.id,type:p.type,x:p.x,y:p.y,cost:p.cost, ...(islandCell(p.row,p.column) && Math.abs(islandCell(p.row,p.column).x-p.x)<.00001 && Math.abs(islandCell(p.row,p.column).y-p.y)<.00001 ? {row:p.row,column:p.column,...(p.gridVersion===2?{gridVersion:2}:{})} : {}) })) };
  } catch (_) {
    islandWritable = false;
    islandMessage('しまを よみこめなかったよ。おうちのひとに きいてね。');
    return null;
  }
}
function writeIsland(next) {
  try {
    localStorage.setItem(ISLAND_KEY, JSON.stringify(next));
    islandData = next;
    byId('island-storage').hidden = true;
    return true;
  } catch (_) {
    byId('island-storage').hidden = false;
    islandMessage('ほぞんできなかったよ。ほしは つかっていないよ。');
    return false;
  }
}
function openIsland() {
  islandSelected = null; islandPlacing = false;
  showScreen('island');
  const loaded = readIsland();
  if (loaded) islandData = loaded;
  renderIsland();
  if (loaded) islandMessage(progressData.lastDay === dayKey() ? 'きょうも しまが げんきだよ！' : 'じぶんの しまを つくろう！');
}
function selectIslandItem(type) {
  if (!islandWritable) return;
  const item = islandItem(type); if (!item) return;
  islandSelected = type; islandPlacing = false;
  renderIslandControls();
  byId('island-selection').scrollIntoView({ block:'nearest' });
  islandMessage(islandBalance() >= item.cost ? `${item.emoji} ${item.name}を おこう！` : `あと ${item.cost-islandBalance()}この ほしで おけるよ！`);
}
function beginIslandPlacement() {
  const item = islandItem(islandSelected);
  if (!islandWritable || !item || islandBalance() < item.cost) return;
  islandPlacing = true;
  renderIslandControls();
  islandMessage('おきたい ばしょを タップしてね');
  byId('island-map').focus({ preventScroll: true });
  byId('island-map').scrollIntoView({ block:'center' });
}
function placeIslandItem(x,y,cell = null) {
  if (screen !== 'island' || !islandPlacing || !islandWritable) return false;
  const latest = readIsland(); if (!latest) return false;
  islandData = latest;
  const item = islandItem(islandSelected);
  if (!item || islandBalance(latest) < item.cost) { renderIslandControls(); islandMessage('ほしを あつめたら また おこう！'); return false; }
  if (latest.items.length >= ISLAND_LIMIT) { islandMessage('しまが にぎやかに なったね！ いまは ここまで おけるよ。'); return false; }
  if (!islandCanPlace(latest, item.type, x, y)) { islandMessage('ここには おけないよ。あいている くさの ところに おいてみよう！'); return false; }
  const placed = { id:latest.nextId, type:item.type, x, y, cost:item.cost, ...(cell ? {row:cell.row,column:cell.column,gridVersion:2} : {}) };
  const next = { ...latest, spent:latest.spent+item.cost, nextId:latest.nextId+1, undoId:placed.id, items:[...latest.items, placed] };
  if (!writeIsland(next)) return false;
  islandSelected = null; islandPlacing = false;
  renderIsland(placed.id); islandMessage(`✨ ${item.name}を おいたよ！`); playSound('correct');
  return true;
}
function undoIslandPlacement() {
  if (screen !== 'island' || !islandWritable) return false;
  const latest = readIsland(); if (!latest) return false;
  const last = latest.items.at(-1);
  if (!last || last.id !== latest.undoId || last.cost > latest.spent) return false;
  const next = { ...latest, spent:latest.spent-last.cost, undoId:null, items:latest.items.slice(0,-1) };
  if (!writeIsland(next)) return false;
  islandPlacing = false; islandSelected = null;
  renderIsland(); islandMessage('もとに もどしたよ。ほしも もどったよ！'); return true;
}
function renderIslandControls() {
  byId('island-balance').textContent = islandBalance();
  const item = islandItem(islandSelected);
  byId('island-selection').hidden = !item;
  byId('island-selected-name').textContent = item ? `${item.emoji} ${item.name}　⭐${item.cost}` : '';
  byId('island-place').disabled = !islandWritable || !item || islandBalance() < item.cost;
  byId('island-place').hidden = islandPlacing;
  byId('island-undo').disabled = !islandWritable || islandData.undoId === null;
  byId('island-map').classList.toggle('placing', islandPlacing);
  renderIslandGrid();
  document.querySelectorAll('#island-items button').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.item === islandSelected));
    button.disabled = !islandWritable;
  });
}
function renderIsland(animateId = null) {
  const layer = byId('island-objects');
  layer.replaceChildren(...[...ISLAND_STARTERS, ...islandData.items].sort((a,b)=>a.y-b.y).map(p => {
    const item = islandItem(p.type);
    const group = svgElement('g', { transform:`translate(${p.x*1000} ${p.y*760})`, 'aria-label': item.name });
    group.append(svgElement('ellipse', { cx:0, cy:item.size*.32, rx:item.size*.38, ry:item.size*.12, fill:'#628c5840' }));
    const icon = svgElement('text', { x:0,y:item.size*.32,'text-anchor':'middle','font-size':item.size, class:p.id===animateId?'island-pop':'' }, item.emoji);
    group.append(icon);return group;
  }));
  byId('island-items').replaceChildren(...ISLAND_ITEMS.map(item => {
    const button = document.createElement('button');button.dataset.item = item.type;button.className = 'island-item';
    const icon = document.createElement('span');icon.className='island-item-icon';icon.textContent=item.emoji;icon.setAttribute('aria-hidden','true');
    const name = document.createElement('strong');name.textContent=item.name;
    const price = document.createElement('span');price.textContent=`⭐ ${item.cost}`;
    button.append(icon,name,price);return button;
  }));
  byId('island-friends').replaceChildren(...friends.map(friend => {
    const span=document.createElement('span');const unlocked=progressData.stars>=friend.stars;
    span.textContent=unlocked?friend.icon:'？';span.setAttribute('aria-label',unlocked?friend.name:`あと ${friend.stars-progressData.stars}この ほしで なかまに なるよ`);return span;
  }));
  renderIslandControls();
}
function initializeIsland() {
  byId('open-island').addEventListener('click',openIsland);
  byId('island-home').addEventListener('click',()=>{islandPlacing=false;showScreen('home');});
  byId('island-drive').addEventListener('click',()=>{islandPlacing=false;openDriveSetup();});
  byId('island-items').addEventListener('click',event=>{const button=event.target.closest('button[data-item]');if(button)selectIslandItem(button.dataset.item);});
  byId('island-place').addEventListener('click',beginIslandPlacement);
  byId('island-cancel').addEventListener('click',()=>{islandPlacing=false;islandSelected=null;renderIslandControls();islandMessage('ゆっくり えらんでね');});
  byId('island-undo').addEventListener('click',undoIslandPlacement);
  const map=byId('island-map');
  map.addEventListener('click',event=>{
    // SVG変換行列を使い、余白・画面サイズ・拡大率の影響を受けない。
    if (!islandPlacing) return;
    const point=new DOMPoint(event.clientX,event.clientY).matrixTransform(map.getScreenCTM().inverse());
    const column=Math.floor((point.x-ISLAND_GRID.left)/ISLAND_GRID.width);
    const row=Math.floor((point.y-ISLAND_GRID.top)/ISLAND_GRID.height);
    placeIslandCell(row,column);
  });
  map.addEventListener('keydown',event=>{
    if (!islandPlacing) return;
    const moves={ArrowLeft:[0,-1],ArrowRight:[0,1],ArrowUp:[-1,0],ArrowDown:[1,0]};
    if (moves[event.key]) {
      event.preventDefault();islandCursor.row=Math.max(0,Math.min(ISLAND_GRID.rows-1,islandCursor.row+moves[event.key][0]));islandCursor.column=Math.max(0,Math.min(ISLAND_GRID.columns-1,islandCursor.column+moves[event.key][1]));
      renderIslandGrid();
    } else if (event.key==='Enter'||event.key===' ') {event.preventDefault();placeIslandCell(islandCursor.row,islandCursor.column);}
    else if(event.key==='Escape') byId('island-cancel').click();
  });
  window.addEventListener('storage',event=>{
    if(screen!=='island')return;
    if(event.key===STORAGE_KEY)progressData=loadProgress();
    if(event.key===ISLAND_KEY||event.key===STORAGE_KEY){const data=readIsland();if(data){islandData=data;renderIsland();}}
  });
}
