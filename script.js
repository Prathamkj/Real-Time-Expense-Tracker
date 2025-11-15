// Enhanced expense tracker using LocalStorage with improved visuals, animations and accessibility
const STORAGE_KEY = 'pratham_expenses_v1';
const PREFS_KEY = 'pratham_expenses_prefs_v1';

// DOM
const form = document.getElementById('expense-form');
const titleInp = document.getElementById('title');
const amountInp = document.getElementById('amount');
const categoryInp = document.getElementById('category');
const dateInp = document.getElementById('date');
const saveBtn = document.getElementById('save-btn');
const resetBtn = document.getElementById('reset-btn');

const filterCategory = document.getElementById('filter-category');
const filterMonth = document.getElementById('filter-month');
const expensesList = document.getElementById('expenses-list');
const totalAmount = document.getElementById('total-amount');
const monthAmount = document.getElementById('month-amount');
const countEl = document.getElementById('count');
const searchInp = document.getElementById('search');
const exportBtn = document.getElementById('export-json');
const clearStorageBtn = document.getElementById('clear-storage');
const categoryBreakdown = document.getElementById('category-breakdown');
const monthChartCanvas = document.getElementById('monthChart');
const weekChartCanvas = document.getElementById('weekChart');
const monthLegend = document.getElementById('month-legend');

// contexts
const ctx = monthChartCanvas.getContext('2d');
const wctx = weekChartCanvas.getContext('2d');

const importBtn = document.getElementById('import-btn');
const importFile = document.getElementById('import-file');
const budgetInput = document.getElementById('budget-input');
const incomeInput = document.getElementById('income-input');
const savePrefsBtn = document.getElementById('save-prefs');
const budgetBar = document.getElementById('budget-bar');
const budgetLabel = document.getElementById('budget-label');
const savingsEl = document.getElementById('savings');
const themeToggle = document.getElementById('theme-toggle');

let expenses = []; // array of {id,title,amount,category,date}
let editId = null;
let prefs = {budget:0,income:0,theme:'auto'};

// Utilities
const uid = ()=> '_' + Math.random().toString(36).substr(2,9);
const formatCurrency = v => '₹' + Number(v).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
const CHART_COLORS = ['#06b6d4','#0ea5b4','#60a5fa','#2563eb','#f59e0b','#ef4444','#8b5cf6'];

// Toasts
function showToast(type, text, ms=2600){
  const container = document.getElementById('toasts');
  const div = document.createElement('div');
  div.className = 'toast ' + (type||'success');
  div.textContent = text;
  container.appendChild(div);
  setTimeout(()=>{
    div.style.transition='opacity .3s, transform .3s';
    div.style.opacity='0';
    div.style.transform='translateY(-8px)';
    setTimeout(()=>div.remove(),300);
  }, ms);
}

// Load / Save
function load(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    expenses = raw ? JSON.parse(raw) : [];
  }catch(e){
    expenses=[];
  }
  try{
    const p = localStorage.getItem(PREFS_KEY);
    if(p) prefs = Object.assign(prefs, JSON.parse(p));
  }catch(e){}
  applyPrefsToUI();
}
function save(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
}
function savePrefs(){
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

function applyPrefsToUI(){
  budgetInput.value = prefs.budget || '';
  incomeInput.value = prefs.income || '';
  const theme = prefs.theme || 'auto';
  const systemDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const useDark = theme==='dark' || (theme==='auto' && systemDark);
  document.documentElement.setAttribute('data-theme', useDark ? 'dark' : 'light');
  themeToggle.setAttribute('data-on', useDark);
  themeToggle.setAttribute('aria-checked', useDark);
}

// Render list
function renderList(){
  const q = (searchInp.value||'').toLowerCase();
  const catFilter = filterCategory.value;
  const monthFilter = filterMonth.value; // yyyy-mm

  let rows = expenses.slice().filter(e=>{
    if(catFilter!=='all' && e.category!==catFilter) return false;
    if(monthFilter){
      const y = e.date.slice(0,7);
      if(y!==monthFilter) return false;
    }
    if(q){
      return e.title.toLowerCase().includes(q) ||
             String(e.amount).includes(q) ||
             e.category.toLowerCase().includes(q);
    }
    return true;
  });

  expensesList.innerHTML='';
  if(rows.length===0){
    expensesList.innerHTML = '<tr><td colspan="5" class="empty">No expenses found.</td></tr>';
    return;
  }

  rows.sort((a,b)=> new Date(b.date) - new Date(a.date));

  for(const e of rows){
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <strong style="color:var(--text-strong)">${escapeHtml(e.title)}</strong>
        <div class="muted" style="font-size:12px">#${e.id}</div>
      </td>
      <td><span class="category-pill">${escapeHtml(e.category)}</span></td>
      <td>${escapeHtml(e.date)}</td>
      <td>${formatCurrency(e.amount)}</td>
      <td class="actions">
        <button data-id="${e.id}" class="edit">Edit</button>
        <button data-id="${e.id}" class="delete">Delete</button>
      </td>
    `;
    expensesList.appendChild(tr);
  }

  // attach handlers
  document.querySelectorAll('.edit').forEach(b=>
    b.addEventListener('click', (ev)=>{
      const id = ev.target.dataset.id;
      startEdit(id);
    })
  );
  document.querySelectorAll('.delete').forEach(b=>
    b.addEventListener('click', (ev)=>{
      const id = ev.target.dataset.id;
      removeExpense(id);
    })
  );
}

// Escape helper
function escapeHtml(s){
  return (s+'')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;');
}

// Stats
function computeStats(){
  const total = expenses.reduce((sum,e)=>sum + Number(e.amount),0);
  totalAmount.textContent = formatCurrency(total);
  countEl.textContent = expenses.length;

  const now = new Date();
  const ym = now.toISOString().slice(0,7);
  const thisMonthTotal = expenses
    .filter(e=>e.date.slice(0,7)===ym)
    .reduce((s,e)=>s+Number(e.amount),0);
  monthAmount.textContent = formatCurrency(thisMonthTotal);

  // category breakdown
  const cats = {};
  for(const e of expenses){
    cats[e.category] = (cats[e.category]||0) + Number(e.amount);
  }
  categoryBreakdown.innerHTML='';
  const keys = Object.keys(cats).sort((a,b)=>cats[b]-cats[a]);
  if(keys.length===0){
    categoryBreakdown.innerHTML = '<div class="empty">No data — add some expenses.</div>';
  }

  // build compact rows and group top 5 as primary
  const totalVal = total || 1;
  const top = keys.slice(0,5);
  const rest = keys.slice(5);
  top.forEach(k=>{
    const row = document.createElement('div');
    row.className='cat-row';
    row.innerHTML = `
      <div>
        <span class="category-pill" style="cursor:pointer" data-cat="${k}">${k}</span>
        <span class="muted" style="margin-left:8px">
          ${(cats[k]/totalVal*100).toFixed(1)}%
        </span>
      </div>
      <div>
        <strong style="color:var(--text-strong)">${formatCurrency(cats[k])}</strong>
      </div>`;
    categoryBreakdown.appendChild(row);
  });
  if(rest.length){
    const otherRow = document.createElement('div');
    otherRow.className='cat-row';
    const otherTotal = rest.reduce((s,kk)=>s+cats[kk],0);
    otherRow.innerHTML = `
      <div>
        <span class="category-pill" style="cursor:pointer" data-cat="Other">Other</span>
        <span class="muted" style="margin-left:8px">
          ${(otherTotal/totalVal*100).toFixed(1)}%
        </span>
      </div>
      <div>
        <strong style="color:var(--text-strong)">${formatCurrency(otherTotal)}</strong>
      </div>`;
    categoryBreakdown.appendChild(otherRow);
  }

  // make category pills clickable
  document
    .querySelectorAll('.category-pill[data-cat], #category-breakdown .category-pill')
    .forEach(el=>el.addEventListener('click', ev=>{
      const cat = ev.currentTarget.dataset.cat || ev.currentTarget.textContent;
      filterCategory.value = cat;
      renderAll();
    }));

  updateBudgetAndSavings(total);
  drawMonthChartAnimated();
  drawWeekChart();
  drawPieChart(cats, total);
}

function updateBudgetAndSavings(totalExpenses){
  const budget = Number(prefs.budget) || 0;
  const income = Number(prefs.income) || 0;
  const used = totalExpenses;
  const pct = budget>0 ? Math.min(100, Math.round((used/budget)*100)) : 0;
  budgetBar.style.width = pct + '%';
  budgetLabel.textContent = `${formatCurrency(used)} / ${formatCurrency(budget)}`;
  const savings = income - used;
  savingsEl.textContent = formatCurrency(savings);

  // color hints
  if(budget>0){
    if(pct>=100)
      budgetBar.style.background = 'linear-gradient(90deg,var(--danger),#f97316)';
    else if(pct>=80)
      budgetBar.style.background = 'linear-gradient(90deg,#f59e0b,#f97316)';
    else
      budgetBar.style.background = 'linear-gradient(90deg,var(--accent),var(--accent-2))';
  }
}

// Chart helpers
function getMonthlyTotals(){
  const map = {};
  for(const e of expenses){
    const ym = e.date.slice(0,7);
    map[ym] = (map[ym]||0) + Number(e.amount);
  }
  const months = [];
  const now = new Date();
  for(let i=11;i>=0;i--){
    const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
    const key = d.toISOString().slice(0,7);
    months.push(key);
  }
  const values = months.map(m=> map[m] || 0);
  return {months, values};
}

// Resize canvases to device pixel ratio and set label color
function fixCanvas(){
  const ratio = window.devicePixelRatio || 1;
  // month
  monthChartCanvas.width = Math.floor(monthChartCanvas.clientWidth * ratio);
  monthChartCanvas.height = Math.floor(monthChartCanvas.clientHeight * ratio);
  ctx.setTransform(ratio,0,0,ratio,0,0);
  ctx.textBaseline = 'top';
  ctx.lineJoin = 'round';
  // week
  weekChartCanvas.width = Math.floor(weekChartCanvas.clientWidth * ratio);
  weekChartCanvas.height = Math.floor(weekChartCanvas.clientHeight * ratio);
  wctx.setTransform(ratio,0,0,ratio,0,0);
  wctx.textBaseline = 'top';
  wctx.lineJoin = 'round';
}

// Draw month chart with a progress factor (0..1) for animation
function drawMonthChartProgress(progress){
  const {months, values} = getMonthlyTotals();
  ctx.clearRect(0,0, monthChartCanvas.width, monthChartCanvas.height);
  const W = monthChartCanvas.width;
  const H = monthChartCanvas.height;
  const padding = 30;
  const maxV = Math.max(1, ...values);
  const barW = (W - padding*2) / values.length * 0.65;
  const gap = ((W - padding*2) / values.length) - barW;
  const LABEL = getComputedStyle(document.documentElement).getPropertyValue('--text-strong') || '#0f172a';
  ctx.strokeStyle = 'rgba(0,0,0,0.06)';
  ctx.lineWidth=1;
  ctx.beginPath();
  ctx.moveTo(padding, padding);
  ctx.lineTo(padding, H-padding);
  ctx.lineTo(W-padding, H-padding);
  ctx.stroke();
  for(let i=0;i<values.length;i++){
    const v = values[i] * progress; // animated value
    const x = padding + i*((W - padding*2)/values.length) + gap/2;
    const height = (v/maxV) * (H - padding*2);
    const y = H - padding - height;
    // gradient
    const g = ctx.createLinearGradient(x, y, x, H-padding);
    g.addColorStop(0, CHART_COLORS[i%CHART_COLORS.length]);
    g.addColorStop(1, 'rgba(6,182,212,0.18)');
    ctx.fillStyle = g;
    roundRect(ctx, x, y, barW, height, 6, true, false);
    // month label
    ctx.fillStyle = LABEL;
    ctx.font = '12px Inter, system-ui';
    const label = months[i].slice(5);
    ctx.fillText(label, x, H - padding + 16);
  }
}

// Animate bars from 0 to 1
function drawMonthChartAnimated(){
  fixCanvas();
  const frames = 24;
  let f = 0;
  function step(){
    f++;
    const p = Math.min(1, f/frames);
    drawMonthChartProgress(p);
    if(f<frames) requestAnimationFrame(step);
    else { buildMonthLegend(); }
  }
  step();
}

function buildMonthLegend(){
  // small legend showing colors used
  monthLegend.innerHTML = '';
  const cats = Object.keys(getCategoryTotals()).slice(0,6);
  for(let i=0;i<cats.length;i++){
    const box = document.createElement('div');
    box.style.display='inline-flex';
    box.style.alignItems='center';
    box.style.gap='8px';
    const colorSquare = document.createElement('span');
    colorSquare.style.width='12px';
    colorSquare.style.height='12px';
    colorSquare.style.display='inline-block';
    colorSquare.style.borderRadius='3px';
    colorSquare.style.background = CHART_COLORS[i%CHART_COLORS.length];
    const label = document.createElement('span');
    label.style.fontSize='12px';
    label.style.color='var(--muted)';
    label.textContent = cats[i];
    box.appendChild(colorSquare);
    box.appendChild(label);
    monthLegend.appendChild(box);
  }
}

function getCategoryTotals(){
  const cats = {};
  for(const e of expenses){
    cats[e.category] = (cats[e.category]||0) + Number(e.amount);
  }
  return cats;
}

function drawWeekChart(){
  fixCanvas();
  const {keys, values} = getWeeklyTotals();
  wctx.clearRect(0,0, weekChartCanvas.width, weekChartCanvas.height);
  const W = weekChartCanvas.width;
  const H = weekChartCanvas.height;
  const padding = 24;
  const maxV = Math.max(1, ...values);
  const stepX = (W-padding*2)/(values.length-1 || 1);
  const LABEL = getComputedStyle(document.documentElement).getPropertyValue('--text-strong') || '#0f172a';
  // draw line
  wctx.beginPath();
  for(let i=0;i<values.length;i++){
    const x = padding + i*stepX;
    const y = H - padding - (values[i]/maxV)*(H-padding*2);
    if(i===0) wctx.moveTo(x,y);
    else wctx.lineTo(x,y);
  }
  wctx.strokeStyle=CHART_COLORS[2];
  wctx.lineWidth=2;
  wctx.stroke();
  // fill area
  wctx.beginPath();
  for(let i=0;i<values.length;i++){
    const x = padding + i*stepX;
    const y = H - padding - (values[i]/maxV)*(H-padding*2);
    if(i===0) wctx.moveTo(x,y);
    else wctx.lineTo(x,y);
  }
  wctx.lineTo(W-padding, H-padding);
  wctx.lineTo(padding, H-padding);
  wctx.closePath();
  const g = wctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0,'rgba(96,165,250,0.25)');
  g.addColorStop(1,'rgba(96,165,250,0.02)');
  wctx.fillStyle = g;
  wctx.fill();
  // labels
  wctx.fillStyle=LABEL;
  wctx.font='11px Inter, system-ui';
  for(let i=0;i<keys.length;i++){
    const x = padding + i*stepX;
    wctx.fillText(keys[i].slice(5), x-10, H-padding+14);
  }
}

// Weekly trend (last 7 days)
function getWeeklyTotals(){
  const map = {};
  const today = new Date();
  for(let i=6;i>=0;i--){
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate()-i);
    const key = d.toISOString().slice(0,10);
    map[key]=0;
  }
  for(const e of expenses){
    if(map[e.date]!==undefined) map[e.date]+=Number(e.amount);
  }
  const keys = Object.keys(map);
  const values = keys.map(k=>map[k]);
  return {keys, values};
}

// Pie chart (category distribution) - create small preview
function drawPieChart(cats, total){
  const canvas = document.createElement('canvas'); /* smaller preview for category panel */
  canvas.width=180;
  canvas.height=120;
  const c = canvas.getContext('2d');
  let start=0;
  const keys = Object.keys(cats);
  const centerX = 90, centerY = 60, radius = 48;
  for(let i=0;i<keys.length;i++){
    const k=keys[i];
    const v = cats[k];
    const slice = v/Math.max(1,total);
    c.beginPath();
    c.moveTo(centerX,centerY);
    c.arc(centerX,centerY,radius,start,start+slice*Math.PI*2);
    c.closePath();
    c.fillStyle = CHART_COLORS[i%CHART_COLORS.length];
    c.fill();
    start += slice*Math.PI*2;
  }
  const legend = document.getElementById('category-breakdown');
  if(canvas && legend){
    let img = document.getElementById('pie-preview');
    if(!img){
      img = document.createElement('img');
      img.id='pie-preview';
      img.style.width='160px';
      img.style.marginBottom='8px';
      legend.insertBefore(img, legend.firstChild);
    }
    img.src = canvas.toDataURL();
  }
}

// draw rounded rect helper
function roundRect(ctx, x, y, w, h, r, fill, stroke){
  if (w < 2 * r) r = w / 2;
  if (h < 2 * r) r = h / 2;
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.arcTo(x+w, y, x+w, y+h, r);
  ctx.arcTo(x+w, y+h, x, y+h, r);
  ctx.arcTo(x, y+h, x, y, r);
  ctx.arcTo(x, y, x+w, y, r);
  ctx.closePath();
  if(fill) ctx.fill();
  if(stroke) ctx.stroke();
}

// CRUD
function addExpense(obj){
  expenses.push(obj);
  save();
  renderAll();
  showToast('success','Expense Added!');
}
function updateExpense(id, data){
  const idx = expenses.findIndex(e=>e.id===id);
  if(idx===-1) return false;
  expenses[idx]=Object.assign({}, expenses[idx], data);
  save();
  renderAll();
  return true;
}
function removeExpense(id){
  if(!confirm('Delete this expense?')) return;
  expenses = expenses.filter(e=>e.id!==id);
  save();
  renderAll();
  showToast('success','Deleted!');
}

function startEdit(id){
  const e = expenses.find(x=>x.id===id);
  if(!e) return;
  editId = id;
  titleInp.value = e.title;
  amountInp.value = e.amount;
  categoryInp.value = e.category;
  dateInp.value = e.date;
  saveBtn.textContent = 'Update Expense';
}

// handlers
form.addEventListener('submit', function(ev){
  ev.preventDefault();
  const title = titleInp.value.trim();
  const amount = parseFloat(amountInp.value);
  const category = categoryInp.value;
  const date = dateInp.value;
  if(!title || !date || isNaN(amount)) {
    showToast('error','Please fill valid values');
    return;
  }
  if(editId){
    updateExpense(editId, {title, amount, category, date});
    editId=null;
    saveBtn.textContent='Add Expense';
    form.reset();
    showToast('success','Updated Successfully!');
  } else {
    const item = { id: uid(), title, amount: Number(amount), category, date };
    addExpense(item);
    form.reset();
  }
});

resetBtn.addEventListener('click', ()=>{
  editId=null;
  saveBtn.textContent='Add Expense';
  form.reset();
});

filterCategory.addEventListener('change', renderAll);
filterMonth.addEventListener('change', renderAll);
searchInp.addEventListener('input', renderAll);

clearStorageBtn.addEventListener('click', ()=>{
  if(confirm('Clear all saved expenses?')){
    expenses=[];
    save();
    renderAll();
    showToast('success','All data cleared');
  }
});

exportBtn.addEventListener('click', ()=>{
  const data = JSON.stringify(expenses, null, 2);
  const blob = new Blob([data], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'expenses.json';
  a.click();
  URL.revokeObjectURL(url);
  showToast('success','Backup downloaded');
});

importBtn.addEventListener('click', ()=>importFile.click());

importFile.addEventListener('change', (ev)=>{
  const f = ev.target.files[0];
  if(!f) return;
  const reader = new FileReader();
  reader.onload = function(){
    try{
      const parsed = JSON.parse(reader.result);
      if(!Array.isArray(parsed)) throw new Error('Invalid file');
      expenses = parsed;
      save();
      renderAll();
      showToast('success','Backup restored');
    }catch(e){
      showToast('error','Invalid backup file');
    }
  };
  reader.readAsText(f);
  importFile.value='';
});

savePrefsBtn.addEventListener('click', ()=>{
  prefs.budget = Number(budgetInput.value)||0;
  prefs.income = Number(incomeInput.value)||0;
  savePrefs();
  renderAll();
  showToast('success','Preferences saved');
});

// theme toggle
themeToggle.addEventListener('click', ()=>{
  const current = themeToggle.getAttribute('data-on') === 'true';
  const next = !current;
  themeToggle.setAttribute('data-on', next);
  themeToggle.setAttribute('aria-checked', next);
  prefs.theme = next ? 'dark' : 'light';
  savePrefs();
  applyPrefsToUI();
  showToast('success', next ? 'Dark theme' : 'Light theme');
});

// render all
function renderAll(){
  renderList();
  computeStats();
}

// initialize default date to today
dateInp.value = new Date().toISOString().slice(0,10);

// initial load
load();
renderAll();

// small note: resize canvases to device pixel ratio
window.addEventListener('resize', ()=>{
  fixCanvas();
  drawMonthChartAnimated();
  drawWeekChart();
});

setTimeout(()=>{
  fixCanvas();
  drawMonthChartAnimated();
  drawWeekChart();
},120);
