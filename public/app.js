(function(){
  const API_BASE = 'https://tradeskey-backend.onrender.com/';
  const AVATAR_API = 'https://avatar-cyan.vercel.app'; // Discord avatar/profile proxy (per provided quick-start)
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toastMsg');
  const audio = document.getElementById('notifAudio');
  const loginToggle = null;
  const themePicker = document.getElementById('themePicker');
  const keyModal = document.getElementById('keyModal');
  const keyModalTitle = document.getElementById('keyModalTitle');
  const keyModalBody = document.getElementById('keyModalBody');
  const keyModalClose = document.getElementById('keyModalClose');

  // Axios instance with interceptor to detect API errors and notify
  // Use credentials so backend can set httpOnly cookies; we prefer cookie-based auth.
  const api = axios.create({ baseURL: API_BASE, timeout: 8000, withCredentials: true });
  api.interceptors.response.use(r=>r, err => {
    // Network error or bad status
    notifyApiDown();
    return Promise.reject(err);
  });
  // Apply API base override from localStorage if present
  try{ const apiOverride = localStorage.getItem('kp_api_base_override'); if(apiOverride) api.defaults.baseURL = apiOverride; }catch(e){}

  function notifyApiDown(){
    showEmbedNotification('API Unreachable', 'The backend is not responding — some features may be unavailable.');
    // Try to play audio, if fails, fallback to WebAudio beep
    audio.play().catch(()=>{
      try{ // WebAudio beep
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine'; o.frequency.value = 800; o.connect(g); g.connect(ctx.destination);
        g.gain.value = 0.1; o.start(); setTimeout(()=>{o.stop(); ctx.close();}, 180);
      }catch(e){/* silent fail */}
    });
  }

  // Small helpers
  function escapeHtml(str){
    if(!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  }

  // Fetch Discord-like profile via avatar-cyan proxy. Returns { username, discriminator, avatarUrl } or null
  async function fetchDiscord(userId){
    if(!userId) return null;
    try{
      const u = `${AVATAR_API}/api/${encodeURIComponent(userId)}`;
      const resp = await fetch(u);
      if(!resp.ok) return null;
      const data = await resp.json();
      // avatar image redirect endpoint
      const avatarUrl = `${AVATAR_API}/api/pfp/${encodeURIComponent(userId)}/image?size=128`;
      return { username: data?.username || null, discriminator: data?.discriminator || null, avatarUrl };
    }catch(e){ console.debug('fetchDiscord error', e); return null; }
  }

  // New embed-style notification (title + description + left color stripe)
  function showEmbedNotification(title, desc, timeout = 4200){
    const toast = document.getElementById('embedToast');
    const tTitle = document.getElementById('embedTitle');
    const tDesc = document.getElementById('embedDesc');
    const closeBtn = document.getElementById('embedClose');
    if(!toast || !tTitle || !tDesc) return showToast(title || desc || 'Notification');
    // populate
    tTitle.textContent = title || '';
    tDesc.textContent = desc || '';
    // show with animation
    toast.classList.remove('hidden');
    // ensure class toggles to trigger animation
    setTimeout(()=>{ toast.classList.add('show'); }, 8);
    // auto-hide
    clearTimeout(toast._t);
    toast._t = setTimeout(()=>{ toast.classList.remove('show'); toast.classList.add('hidden'); }, timeout);
    // close button
    if(closeBtn){ closeBtn.onclick = ()=>{ clearTimeout(toast._t); toast.classList.remove('show'); toast.classList.add('hidden'); }; }
  }

  function showToast(msg, timeout=3500){
    toastMsg.textContent = msg;
    // pink style for important messages
    toast.classList.remove('hidden');
    toast.classList.add('show');
    toast.classList.add('toast-pink');
    clearTimeout(toast._t);
    toast._t = setTimeout(()=>{ toast.classList.remove('show'); toast.classList.add('hidden'); toast.classList.remove('toast-pink'); }, timeout);
  }

  // Themed confirm helper that uses the overlay in index.html
  function showConfirm(message, onYes){
    const overlay = document.getElementById('confirmOverlay');
    const msgEl = document.getElementById('confirmMsg');
    const yes = document.getElementById('confirmYes');
    const no = document.getElementById('confirmNo');
    if(!overlay || !msgEl || !yes || !no){ // fallback to window.confirm
      if(window.confirm(message)) onYes && onYes();
      return;
    }
    msgEl.textContent = message;
    overlay.style.display = 'flex';
    overlay.classList.remove('hidden');
    // remove previous handlers
    const clean = ()=>{
      overlay.style.display = 'none';
      overlay.classList.add('hidden');
      yes.onclick = null; no.onclick = null;
    };
    yes.onclick = async ()=>{ try{ await onYes(); }catch(e){} finally{ clean(); } };
    no.onclick = ()=>{ clean(); };
  }

  // Theme handling
  const availableThemes = ['theme-purple-pink','theme-pink','theme-purple','theme-blue','theme-dark'];
  function applyTheme(name){
    document.body.classList.remove(...availableThemes);
    if(!name) name = localStorage.getItem('kp_theme') || 'theme-purple-pink';
    document.body.classList.add(name);
    localStorage.setItem('kp_theme', name);
  }
  // apply saved theme on load
  applyTheme(localStorage.getItem('kp_theme'));
  // wire theme picker
  if(themePicker){ themePicker.value = localStorage.getItem('kp_theme') || 'theme-purple-pink'; themePicker.addEventListener('change', (e)=>applyTheme(e.target.value)); }

  // Simple client-side router + UI
  const tabs = document.querySelectorAll('.navbtn');
  const content = document.getElementById('content');
  const title = document.getElementById('viewTitle');

  // Apply persisted UI prefs
  (function applyUIPrefs(){
    if(localStorage.getItem('kp_compact') === '1') document.body.classList.add('compact');
    if(localStorage.getItem('kp_sidebar_collapsed') === '1') document.body.classList.add('sidebar-collapsed');
  })();

  function setActive(tabName){
    tabs.forEach(t=>t.classList.remove('active'));
    const tb = document.querySelector('[data-tab="'+tabName+'"]'); if(tb) tb.classList.add('active');
    if(title) try{ title.textContent = tabName[0].toUpperCase()+tabName.slice(1); }catch(e){}
    renderTab(tabName);
  }

  // Refresh current view (useful after deletes/changes)
  async function refreshCurrentView(){
    const active = document.querySelector('.navbtn.active')?.dataset?.tab || 'stats';
    try{ await renderTab(active); }catch(e){ console.debug('refreshCurrentView error', e); }
  }

  tabs.forEach(t=>t.addEventListener('click', ()=>setActive(t.dataset.tab)));

  // sidebar toggle button
  const sidebarToggle = document.getElementById('sidebarToggle');
  if(sidebarToggle){ sidebarToggle.addEventListener('click', ()=>{
    const collapsed = document.body.classList.toggle('sidebar-collapsed');
    localStorage.setItem('kp_sidebar_collapsed', collapsed ? '1':'0');
  }); }

  // make first tab visually active by default
  (function initTabs(){
    const first = document.querySelector('.navbtn[data-tab="stats"]');
    if(first) first.classList.add('active');
  })();

  // Authentication removed: always show dashboard UI (user manages API access externally)
  (function initNoAuth(){
    setActive('stats');
  })();

  // Render functions for tabs
  async function renderTab(tab){
    if(tab === 'stats') return renderStats();
    if(tab === 'keys') return renderKeys();
    if(tab === 'customers') return renderCustomers();
    if(tab === 'tokens') return renderTokens();
    if(tab === 'settings') return renderSettings();
  }

  async function renderStats(){
    content.innerHTML = `<div class="card"><h3>Stats</h3>
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
        <label style="font-size:13px;color:#ccc">Range:</label>
        <button class="btn" id="r24">24h</button>
        <button class="btn" id="r48">48h</button>
        <button class="btn" id="r7">7d</button>
        <button class="btn" id="r30">30d</button>
        <div style="margin-left:auto;display:flex;gap:8px;align-items:center">
          <label style="font-size:13px;color:var(--muted)">Auto-refresh</label>
          <button class="btn small" id="autoRefreshToggle">Off</button>
        </div>
      </div>
      <div id="statsArea">Loading...</div>
    </div>`;
    const area = document.getElementById('statsArea');
    const ranges = { r24:24, r48:48, r7:24*7, r30:24*30 };
    let chartInstance = null;
    let autoRefreshHandle = null;
    async function refresh(rangeKey){
      area.innerHTML = 'Loading...';
      try{
        const r = await api.get('/keys');
        const keys = (r.data.keys || []).map(k=>({
          ...k,
          createdAt: k.createdAt ? new Date(k.createdAt) : null
        }));
        const now = Date.now();
        const hours = ranges[rangeKey];
        const start = now - hours*3600*1000;
        const prevStart = start - hours*3600*1000;

        const inWindow = keys.filter(k=>k.createdAt && k.createdAt.getTime() >= start);
        const prevWindow = keys.filter(k=>k.createdAt && k.createdAt.getTime() >= prevStart && k.createdAt.getTime() < start);

        const generated = inWindow.length;
        const redeemed = inWindow.filter(k=>k.redeemed).length;
        const active = inWindow.filter(k=>!k.redeemed).length;

        const prevGenerated = prevWindow.length || 0;
        const genDiff = prevGenerated ? Math.round(((generated - prevGenerated)/prevGenerated)*100) : 0;

        // build small time-series per hour for chart
        const buckets = [];
        for(let i=0;i<hours;i++){ buckets.push({ t: new Date(start + i*3600*1000), gen:0, red:0 }); }
        inWindow.forEach(k=>{
          const d = k.createdAt.getTime();
          const idx = Math.floor((d - start) / (3600*1000));
          if(idx>=0 && idx<buckets.length){ buckets[idx].gen += 1; if(k.redeemed) buckets[idx].red += 1; }
        });

        const labels = buckets.map(b=>b.t.toISOString().replace('T',' ').slice(0,16));
        const genData = buckets.map(b=>b.gen);
        const redData = buckets.map(b=>b.red);

        area.innerHTML = `<div style="display:flex;gap:12px;flex-wrap:wrap">
          <div style="flex:1"><div class="card">Generated (${hours}h): ${generated}<div style="font-size:12px;color:#bbb">${prevGenerated? (genDiff>0?'+':'')+genDiff+'% vs prior':'no prior data'}</div></div></div>
          <div style="width:60%"><canvas id="statsChart" height="160"></canvas></div>
        </div>`;

        const ctx = document.getElementById('statsChart').getContext('2d');
        if(chartInstance) chartInstance.destroy();
        chartInstance = new Chart(ctx, {
          type: 'line',
          data: { labels, datasets: [ { label: 'Generated', data: genData, borderColor: '#a855f7', backgroundColor: 'rgba(168,85,247,0.12)', tension:0.3 }, { label: 'Redeemed', data: redData, borderColor: '#ff6ab3', backgroundColor: 'rgba(255,106,179,0.08)', tension:0.3 } ] },
          options: { responsive: true, maintainAspectRatio:false }
        });
      }catch(e){ area.innerHTML = '<div style="color:#ff9aa2">Failed to load stats</div>'; }
    }
    // wire range buttons
    Object.keys(ranges).forEach(k=>{ const el = document.getElementById(k); if(el) el.addEventListener('click', ()=>{ refresh(k); document.querySelectorAll('#r24,#r48,#r7,#r30').forEach(b=>b.classList.remove('active')); el.classList.add('active'); }); });
    const autoBtn = document.getElementById('autoRefreshToggle');
    let autoOn = false;
    if(autoBtn){ autoBtn.addEventListener('click', ()=>{
      autoOn = !autoOn; autoBtn.textContent = autoOn? 'On':'Off';
      if(autoOn){ autoRefreshHandle = setInterval(()=>{ const active = document.querySelector('.navbtn.active'); const key = active?.dataset?.tab || 'stats'; refresh(key); }, 7000); }
      else { clearInterval(autoRefreshHandle); autoRefreshHandle = null; }
    }); }
    // default 24h
    const def = document.getElementById('r24'); if(def) { def.classList.add('active'); refresh('r24'); }
  }

  async function renderKeys(){
    content.innerHTML = `
      <div class="card"><h3>Key Management</h3>
        <div style="display:flex;gap:8px;margin-bottom:8px;align-items:center">
          <input id="genAmount" class="input" placeholder="Amount (1)" style="width:120px" />
          <select id="genType" class="input" style="width:140px"><option value="lifetime">Lifetime</option><option value="weekly">Weekly</option></select>
          <button class="btn" id="genBtn">Generate</button>
          <button class="btn" id="exportBtn">Export CSV</button>
          <select id="typeFilter" class="input" style="width:120px;margin-left:8px"><option value="">All types</option><option value="lifetime">lifetime</option><option value="weekly">weekly</option></select>
          <input id="keysSearch" class="input" placeholder="Search keys..." style="margin-left:auto;width:260px" />
        </div>
        <div class="keys-toolbar" id="keysToolbar" style="display:none">
          <label class="muted"><input id="selectAllChk" type="checkbox" class="key-checkbox"/> Select all</label>
          <button class="btn small" id="copySelected">Copy Selected</button>
          <button class="btn small" id="deleteSelected">Delete Selected</button>
          <div style="margin-left:auto;color:var(--muted);font-size:13px">Selected: <span id="selectedCount">0</span></div>
        </div>
        <div id="generatedArea" style="margin-top:8px;display:none">
          <label style="font-size:13px;color:var(--muted)">Generated keys (comma-separated)</label>
          <textarea id="generatedTxt" class="input" style="height:90px;white-space:pre-wrap"></textarea>
        </div>
        <div id="keysList" class="list">Loading...</div>
        <div style="display:flex;justify-content:center;gap:8px;margin-top:8px"><button class="btn" id="prevPage">Prev</button><div id="pageInfo" style="align-self:center;color:#bbb"></div><button class="btn" id="nextPage">Next</button></div>
      </div>`;

    document.getElementById('genBtn').addEventListener('click', async ()=>{
      const amt = parseInt(document.getElementById('genAmount').value||'1') || 1;
      const type = document.getElementById('genType').value;
      try{
        const r = await api.get('/generate?amount='+amt+'&type='+type);
        const generatedCount = (r.data.keys?.length) || (r.data.keysstring ? r.data.keysstring.split(',').length : 0);
        // compose final comma-separated keys string
        const keysStr = r.data.keysstring || (r.data.keys ? r.data.keys.map(k=>k.key).join(',') : '');
        const genArea = document.getElementById('generatedArea');
        const genTxt = document.getElementById('generatedTxt');
        if(genTxt){ genTxt.value = keysStr || ''; if(genArea) genArea.style.display = genTxt.value ? 'block' : 'none'; }
        if(keysStr) {
          try{ await navigator.clipboard.writeText(keysStr); showToast('Generated '+generatedCount+' keys — copied'); }
          catch(e){ showToast('Generated '+generatedCount+' keys'); }
        } else {
          showToast('Generated '+generatedCount+' keys');
        }
        // refresh list
        renderKeys();
      }catch(e){ showToast('Generate failed'); }
    });

    document.getElementById('exportBtn').addEventListener('click', ()=>{
      // Export via backend endpoint
      const url = API_BASE + 'keys-csv';
      window.open(url, '_blank');
    });

    // wire type filter
    document.getElementById('typeFilter').addEventListener('change', ()=>{ currentPage = 1; renderPage(); });

    // bulk toolbar buttons
    const keysToolbar = document.getElementById('keysToolbar');
    const selectAllChk = document.getElementById('selectAllChk');
    const copySelectedBtn = document.getElementById('copySelected');
    const deleteSelectedBtn = document.getElementById('deleteSelected');
    const selectedCount = document.getElementById('selectedCount');
    function updateSelectedCount(){ const n = document.querySelectorAll('.key-select:checked').length; selectedCount.textContent = String(n); keysToolbar.style.display = n>0 ? 'flex' : 'none'; }
    if(selectAllChk) selectAllChk.addEventListener('change', ()=>{ document.querySelectorAll('.key-select').forEach(cb=>cb.checked = selectAllChk.checked); updateSelectedCount(); });
    if(copySelectedBtn) copySelectedBtn.addEventListener('click', ()=>{
      const keys = Array.from(document.querySelectorAll('.key-select:checked')).map(cb=>cb.dataset.key);
      if(!keys.length) return showToast('No keys selected');
      try{ navigator.clipboard.writeText(keys.join(',')); showToast('Copied '+keys.length+' keys'); }catch(e){ showToast('Copy failed'); }
    });
    if(deleteSelectedBtn) deleteSelectedBtn.addEventListener('click', ()=>{
      const keys = Array.from(document.querySelectorAll('.key-select:checked')).map(cb=>cb.dataset.key);
      if(!keys.length) return showToast('No keys selected');
      showConfirm('Delete '+keys.length+' selected keys? This cannot be undone.', async ()=>{
        try{ await Promise.all(keys.map(k=>api.delete('/keys/'+encodeURIComponent(k)))); showToast('Deleted '+keys.length+' keys'); await loadKeysList(); }catch(e){ showToast('Bulk delete failed'); }
      });
    });

    // add Delete All button
    const deleteAllBtn = document.createElement('button');
    deleteAllBtn.className = 'btn';
    deleteAllBtn.textContent = 'Delete All Keys';
    deleteAllBtn.style.marginLeft = '8px';
    deleteAllBtn.id = 'deleteAllBtn';
    // insert after export button
    const exportEl = document.getElementById('exportBtn');
    if(exportEl && exportEl.parentNode) exportEl.parentNode.insertBefore(deleteAllBtn, exportEl.nextSibling);

    deleteAllBtn.addEventListener('click', ()=>{
      showConfirm('Are you sure you want to delete ALL keys? This cannot be undone.', async ()=>{
        try{
          await api.delete('/keys-by-type');
          showToast('All keys deleted');
          // refresh whatever view is active (keys, stats, customers)
          await refreshCurrentView();
        }catch(err){ showToast('Delete all failed'); }
      });
    });

    await loadKeysList();
    // wire search and pagination
    document.getElementById('keysSearch').addEventListener('input', ()=>{ currentPage = 1; renderPage(); });
    document.getElementById('prevPage').addEventListener('click', ()=>{ if(currentPage>1){ currentPage--; renderPage(); } });
    document.getElementById('nextPage').addEventListener('click', ()=>{ currentPage++; renderPage(); });
  }

  async function loadKeysList(){
    const list = document.getElementById('keysList');
    list.innerHTML = 'Loading...';
    try{
      const r = await api.get('/keys');
      allKeys = (r.data.keys || []).map(k=>({ ...k }));
      if(!allKeys.length) { list.innerHTML = '<div style="color:#aaa">No keys</div>'; return; }
      // initialize pagination
      currentPage = 1; pageSize = 10;
      renderPage();
    }catch(e){ list.innerHTML = '<div style="color:#ff9aa2">Failed to load keys</div>'; }
  }

  // pagination state
  let allKeys = [];
  let currentPage = 1;
  let pageSize = 10;

  function renderPage(){
    const list = document.getElementById('keysList');
    const search = document.getElementById('keysSearch')?.value?.toLowerCase() || '';
    const filtered = allKeys.filter(k => k.key.toLowerCase().includes(search) || (k.type||'').toLowerCase().includes(search));
    const total = filtered.length; const pages = Math.max(1, Math.ceil(total / pageSize));
    if(currentPage > pages) currentPage = pages;
    const start = (currentPage-1)*pageSize; const pageItems = filtered.slice(start, start+pageSize);
    if(!pageItems.length){ list.innerHTML = '<div style="color:#aaa">No keys</div>'; document.getElementById('pageInfo').textContent = `${total} items`; return; }
    list.innerHTML = pageItems.map(k=>{
      const alias = localStorage.getItem('alias_'+k.key) || '';
      return `<div class="card" style="display:flex;justify-content:space-between;align-items:center"><div style="display:flex;gap:12px;align-items:center">
        <input type="checkbox" class="key-select key-checkbox" data-key="${k.key}" />
        <div>
          <div style="font-weight:700"><span class="key-name" data-key="${k.key}">${alias || k.key}</span></div>
          <div style="font-size:12px;color:var(--muted)">${k.type} • redeemed:${k.redeemed}</div>
        </div>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <select class="input select type-select" data-key="${k.key}"><option value="lifetime">lifetime</option><option value="weekly">weekly</option></select>
        <button class="btn" data-action="details" data-key='${encodeURIComponent(JSON.stringify(k))}'>Details</button>
        <button class="btn" data-action="copy" data-key="${k.key}">Copy</button>
        <button class="btn" data-action="delete" data-key="${k.key}">Delete</button>
      </div></div>`;
    }).join('');

    document.getElementById('pageInfo').textContent = `Page ${currentPage}/${pages} — ${total} items`;

    // wire selects to current type and change handler
    list.querySelectorAll('.type-select').forEach(s=>{
      const key = s.dataset.key; const item = allKeys.find(x=>x.key===key); if(item) s.value = item.type || 'lifetime';
      s.addEventListener('change', async (e)=>{
        const newType = e.target.value;
        try{ await api.put('/keys/'+encodeURIComponent(key), { type: newType }); showToast('Type updated'); await loadKeysList(); }catch(err){ showToast('Type update failed'); }
      });
    });

    // double-click aliasing
    list.querySelectorAll('.key-name').forEach(el=>{
      el.addEventListener('dblclick', ()=>{
        const key = el.dataset.key;
        const cur = localStorage.getItem('alias_'+key) || '';
        const v = prompt('Set alias for key (leave empty to remove):', cur);
        if(v===null) return;
        if(v.trim()===''){ localStorage.removeItem('alias_'+key); showToast('Alias removed'); } else { localStorage.setItem('alias_'+key, v.trim()); showToast('Alias saved'); }
        renderPage();
      });
    });

    // wire key-select checkboxes
    list.querySelectorAll('.key-select').forEach(cb=>{ cb.addEventListener('change', ()=>{ const selectAll = document.getElementById('selectAllChk'); if(selectAll){ selectAll.checked = document.querySelectorAll('.key-select:checked').length === document.querySelectorAll('.key-select').length; } const sc = document.getElementById('selectedCount'); if(sc) sc.textContent = String(document.querySelectorAll('.key-select:checked').length); const keysToolbar = document.getElementById('keysToolbar'); if(keysToolbar) keysToolbar.style.display = document.querySelectorAll('.key-select:checked').length>0 ? 'flex':'none'; }); });

    // details action
    list.querySelectorAll('button[data-action="details"]').forEach(b=>b.addEventListener('click', e=>{
      try{
        const data = decodeURIComponent(e.target.dataset.key);
        const obj = JSON.parse(data);
        keyModalTitle.textContent = obj.key || 'Key Details';
        keyModalBody.textContent = JSON.stringify(obj, null, 2);
        if(keyModal){ keyModal.style.display='flex'; keyModal.classList.remove('hidden'); }
      }catch(err){ showToast('Failed to show details'); }
    }));

    list.querySelectorAll('button[data-action="copy"]').forEach(b=>b.addEventListener('click', e=>{ navigator.clipboard.writeText(e.target.dataset.key); showToast('Copied'); }));
    list.querySelectorAll('button[data-action="delete"]').forEach(b=>b.addEventListener('click', async e=>{
      const key = e.target.dataset.key;
      if(!confirm('Delete key '+key+'?')) return;
      try{ await api.delete('/keys/'+encodeURIComponent(key)); showToast('Deleted'); await refreshCurrentView(); }catch(err){ showToast('Delete failed'); }
    }));
  }

  async function renderTokens(){
    content.innerHTML = `<div class="card"><h3>Tokens</h3><div style="margin-bottom:8px"><input id="newToken" class="input" placeholder="token value" style="width:320px"/> <select id="newRole"><option>regular</option><option>admin</option></select> <button class="btn" id="addToken">Add</button></div><div id="tokensList">Loading...</div></div>`;
    document.getElementById('addToken').addEventListener('click', async ()=>{
      const t = document.getElementById('newToken').value.trim(); const role = document.getElementById('newRole').value;
      if(!t) return showToast('Enter token');
      try{ await api.post('/tokens', { token: t, role }); showToast('Added'); renderTokens(); }catch(e){ showToast('Add failed'); }
    });
    try{ const r = await api.get('/tokens'); const tokens = r.data.tokens || []; const el = document.getElementById('tokensList'); el.innerHTML = tokens.map(tok=>`<div class="card" style="display:flex;justify-content:space-between"><div><div style="font-weight:700">${tok.token}</div><div style="font-size:12px;color:#bbb">${tok.role}</div></div><div style="display:flex;gap:8px"><button class="btn" data-id="${tok._id}" data-action="del">Delete</button></div></div>`).join(''); el.querySelectorAll('button[data-action="del"]').forEach(b=>b.addEventListener('click', async e=>{ if(!confirm('Delete token?')) return; try{ await api.delete('/tokens/'+e.target.dataset.id); showToast('Deleted'); renderTokens(); }catch(err){ showToast('Delete failed'); }})); }catch(e){ document.getElementById('tokensList').innerHTML = '<div style="color:#ff9aa2">Failed to load tokens</div>' }
  }

  // Customers view
  async function renderCustomers(){
    content.innerHTML = `
      <div class="card"><h3>Customers</h3>
        <div style="display:flex;gap:8px;margin-bottom:8px;align-items:center">
          <input id="custSearch" class="input" placeholder="Search users or IDs..." style="width:240px" />
          <select id="custSubFilter" class="input" style="width:160px"><option value="">All subscriptions</option><option value="weekly">weekly</option><option value="lifetime">lifetime</option></select>
          <button class="btn" id="custExport">Export CSV</button>
          <div style="margin-left:auto;color:var(--muted);font-size:13px">Customers: <span id="custCount">0</span></div>
        </div>
        <div id="customersList" class="list">Loading...</div>
        <div style="display:flex;justify-content:center;gap:8px;margin-top:8px"><button class="btn" id="custPrev">Prev</button><div id="custPageInfo" style="align-self:center;color:#bbb"></div><button class="btn" id="custNext">Next</button></div>
      </div>`;

    // state
    let allCustomers = [];
    let custPage = 1;
    const custPageSize = 8;

    async function loadCustomers(){
      const el = document.getElementById('customersList');
      el.innerHTML = 'Loading...';
      try{
        const r = await api.get('/customers');
        allCustomers = (r.data.customers || []).map(c=>({ ...c }));
        document.getElementById('custCount').textContent = String(allCustomers.length);
        custPage = 1; renderCustPage();
      }catch(e){ el.innerHTML = '<div style="color:#ff9aa2">Failed to load customers</div>'; }
    }

    function avatarFor(id){
      // Use DiceBear to generate consistent avatar from userId seed
      return `https://api.dicebear.com/6.x/thumbs/png?seed=${encodeURIComponent(id)}&size=64&backgroundType=gradientLinear`;
    }

    function renderCustPage(){
      const el = document.getElementById('customersList');
      const search = document.getElementById('custSearch')?.value?.toLowerCase() || '';
      const sub = document.getElementById('custSubFilter')?.value || '';
      const filtered = allCustomers.filter(c=>{
        if(sub && (c.subscriptionType||'') !== sub) return false;
        return String(c.userId).toLowerCase().includes(search) || (c.keys||[]).some(k=> (k.key||'').toLowerCase().includes(search));
      });
      const total = filtered.length; const pages = Math.max(1, Math.ceil(total / custPageSize));
      if(custPage>pages) custPage = pages;
      const start = (custPage-1)*custPageSize; const items = filtered.slice(start, start + custPageSize);
      if(!items.length){ el.innerHTML = '<div style="color:#aaa">No customers</div>'; document.getElementById('custPageInfo').textContent = `${total} items`; return; }

      el.innerHTML = items.map(c=>{
        const created = c.createdAt ? new Date(c.createdAt).toLocaleString() : '';
        const updated = c.updatedAt ? new Date(c.updatedAt).toLocaleString() : '';
        const keyCount = (c.keys||[]).length;
        const keysPreview = (c.keys||[]).slice(0,4).map(k=>`${k.key} (${k.type})`).join(', ');
        const subText = c.subscriptionType || 'none';
        const safeId = String(c.userId).replace(/[^a-zA-Z0-9_-]/g,'_');
        return `<div class="card customer-card">
          <img id="discImg_${safeId}" src="" alt="avatar" class="customer-avatar" />
          <div class="customer-meta">
            <div style="display:flex;align-items:center;gap:8px"><div class="customer-name" id="discName_${safeId}">${c.userId}</div><div class="customer-sub" id="discTag_${safeId}">${subText}</div><a style="margin-left:6px;font-size:12px;color:var(--muted)" href="https://discord.com/users/${c.userId}" target="_blank">View on Discord</a></div>
            <div class="customer-keys">Keys: ${keyCount} — ${keysPreview}</div>
            <div class="note-meta" style="margin-top:6px">Created: ${created} • Updated: ${updated}</div>

            <div class="notes-list" id="notes_${safeId}">
              ${(c.notes||[]).map(n=>`<div class="note-item"><div>${escapeHtml(n.note)}</div><div class="note-meta">${n.author||''} • ${new Date(n.createdAt).toLocaleString()}</div></div>`).join('')}
            </div>

            <div class="note-add">
              <textarea id="noteInput_${safeId}" class="input" placeholder="Add a note..."></textarea>
              <button class="btn" id="addNote_${safeId}">Add</button>
            </div>

          </div>
          <div class="cust-actions">
            <select id="subSelect_${safeId}" class="input select" style="width:140px"><option value="">subscription</option><option value="weekly">weekly</option><option value="monthly">monthly</option><option value="lifetime">lifetime</option><option value="null">none</option></select>
            <button class="btn" data-action="grantMonthly" data-user='${encodeURIComponent(c.userId)}'>Grant Monthly</button>
            <button class="btn" data-action="custExport" data-user='${encodeURIComponent(c.userId)}'>Export</button>
            <button class="btn" data-action="custDelete" data-user='${encodeURIComponent(c.userId)}'>Delete</button>
          </div>
        </div>`;
      }).join('');

      // after render: wire up discord fetch, notes add, subscription change and actions
      items.forEach(c=>{
        const safeId = String(c.userId).replace(/[^a-zA-Z0-9_-]/g,'_');
        const imgEl = document.getElementById(`discImg_${safeId}`);
        const nameEl = document.getElementById(`discName_${safeId}`);
        const tagEl = document.getElementById(`discTag_${safeId}`);
        // fetch discord info asynchronously
        fetchDiscord(c.userId).then(info=>{
          if(!info) {
            console.debug('discord-not-found for', c.userId);
            // leave name as userId and no avatar
            return;
          }
          if(imgEl && info.avatarUrl) imgEl.src = info.avatarUrl;
          if(nameEl && info.username) nameEl.textContent = info.username;
          if(tagEl) tagEl.textContent = (info.discriminator ? `#${info.discriminator}` : (c.subscriptionType || ''));
        }).catch(err=>{ console.debug('discord-fetch-error', c.userId, err); });

        // add note handler
        const addBtn = document.getElementById(`addNote_${safeId}`);
        const noteInput = document.getElementById(`noteInput_${safeId}`);
        const notesContainer = document.getElementById(`notes_${safeId}`);
        if(addBtn && noteInput){ addBtn.addEventListener('click', async ()=>{
          const text = noteInput.value.trim(); if(!text) return showToast('Enter note');
          try{
            const r = await api.post('/customers/'+encodeURIComponent(c.userId)+'/notes', { note: text });
            const entry = r.data.note;
            // prepend note
            if(notesContainer) notesContainer.insertAdjacentHTML('afterbegin', `<div class="note-item"><div>${escapeHtml(entry.note)}</div><div class="note-meta">${escapeHtml(entry.author||'')} • ${new Date(entry.createdAt).toLocaleString()}</div></div>`);
            noteInput.value = '';
            showToast('Note added');
                // optionally refresh whole customers view
                if(localStorage.getItem('kp_auto_refresh')==='1'){
                  try{ await loadCustomers(); }catch(e){}
                }
          }catch(err){ showToast('Add note failed'); }
        }); }

        // subscription change
        const subSelect = document.getElementById(`subSelect_${safeId}`);
        if(subSelect){ subSelect.value = c.subscriptionType || ''; subSelect.addEventListener('change', async (e)=>{
          const val = e.target.value === 'null' ? null : e.target.value;
          try{ await api.put('/customers/'+encodeURIComponent(c.userId)+'/subscription', { subscriptionType: val }); showToast('Subscription updated'); }catch(err){ showToast('Subscription update failed'); }
        }); }

        // delete and export buttons wired by earlier code (custDelete/custExport) - rebind to ensure handlers
        const exportBtn = document.querySelector(`button[data-action="custExport"][data-user='${encodeURIComponent(c.userId)}']`);
        if(exportBtn){ exportBtn.addEventListener('click', ()=>{ const cust = items.find(x=>String(x.userId)===String(c.userId)); if(!cust) return showToast('Not found'); const rows = ['key,type,redeemed,redeemedAt']; (cust.keys||[]).forEach(k=>{ rows.push(`${k.key},${k.type},${k.redeemed? 'true':'false'},${k.redeemedAt||''}`); }); const csv = rows.join('\n'); const blob = new Blob([csv], { type: 'text/csv' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `customer-${cust.userId}-keys.csv`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); }); }

        const deleteBtn = document.querySelector(`button[data-action="custDelete"][data-user='${encodeURIComponent(c.userId)}']`);
        if(deleteBtn){ deleteBtn.addEventListener('click', ()=>{ showConfirm('Delete customer '+c.userId+'? This will remove customer record.', async ()=>{ try{ await api.delete('/customers/'+encodeURIComponent(c.userId)); showToast('Deleted'); await loadCustomers(); }catch(err){ showToast('Delete failed'); } }); }); }
      });

      document.getElementById('custPageInfo').textContent = `Page ${custPage}/${pages} — ${total} items`;

      // wire actions
      el.querySelectorAll('button[data-action="custDetails"]').forEach(b=>b.addEventListener('click', e=>{
        try{
          const data = decodeURIComponent(e.target.dataset.user);
          const obj = JSON.parse(data);
          keyModalTitle.textContent = `Customer: ${obj.userId}`;
          keyModalBody.textContent = JSON.stringify(obj, null, 2);
          if(keyModal){ keyModal.style.display='flex'; keyModal.classList.remove('hidden'); }
        }catch(err){ showToast('Failed to show details'); }
      }));

      el.querySelectorAll('button[data-action="custExport"]').forEach(b=>b.addEventListener('click', e=>{
        const userId = decodeURIComponent(e.target.dataset.user);
        const cust = allCustomers.find(x=>String(x.userId)===String(userId));
        if(!cust) return showToast('Customer not found');
        const rows = ['key,type,redeemed,redeemedAt'];
        (cust.keys||[]).forEach(k=>{ rows.push(`${k.key},${k.type},${k.redeemed? 'true':'false'},${k.redeemedAt||''}`); });
        const csv = rows.join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `customer-${userId}-keys.csv`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
      }));

      el.querySelectorAll('button[data-action="custDelete"]').forEach(b=>b.addEventListener('click', e=>{
        const userId = decodeURIComponent(e.target.dataset.user);
        showConfirm('Delete customer '+userId+'? This will remove customer record.', async ()=>{
          try{ await api.delete('/customers/'+encodeURIComponent(userId)); showToast('Deleted'); await loadCustomers(); }catch(err){ showToast('Delete failed'); }
        });
      }));
      
      // Grant Monthly handler: generate a monthly key (or fallback) and redeem on behalf of user
      el.querySelectorAll('button[data-action="grantMonthly"]').forEach(b=>b.addEventListener('click', e=>{
        const userId = decodeURIComponent(e.target.dataset.user);
        showConfirm('Generate a monthly key and redeem it for '+userId+'? This will grant or update subscription.', async ()=>{
          try{
            showToast('Generating monthly key...');
            let key = null;
            try{
              const g = await api.get('/generate?amount=1&type=monthly');
              if(g?.data?.keys?.length) key = g.data.keys[0].key;
              else if(g?.data?.keysstring) key = g.data.keysstring.split(',')[0];
            }catch(err){ key = null; }
            // fallback: generate weekly if monthly not supported
            if(!key){
              try{ const g2 = await api.get('/generate?amount=1&type=weekly'); if(g2?.data?.keys?.length) key = g2.data.keys[0].key; else if(g2?.data?.keysstring) key = g2.data.keysstring.split(',')[0]; }catch(err){ key = null; }
            }
            if(!key) return showToast('Failed to generate key');

            // Redeem the key for the user
            try{
              await api.get('/redeem?key='+encodeURIComponent(key)+'&user='+encodeURIComponent(userId));
              showToast('Key redeemed for '+userId);
            }catch(err){ showToast('Redeem failed'); return; }

            // Try to set subscription to monthly on the customer record (may fail if backend doesn't accept monthly)
            try{
              await api.put('/customers/'+encodeURIComponent(userId)+'/subscription', { subscriptionType: 'monthly' });
              showToast('Subscription updated to monthly');
            }catch(err){
              showToast('Redeemed but server refused monthly subscription (backend may not support monthly)');
            }

            // refresh UI
            await refreshCurrentView();
          }catch(err){ showToast('Operation failed'); }
        });
      }));
    }

    // events
    document.getElementById('custSearch').addEventListener('input', ()=>{ custPage = 1; renderCustPage(); });
    document.getElementById('custSubFilter').addEventListener('change', ()=>{ custPage = 1; renderCustPage(); });
    document.getElementById('custPrev').addEventListener('click', ()=>{ if(custPage>1){ custPage--; renderCustPage(); } });
    document.getElementById('custNext').addEventListener('click', ()=>{ custPage++; renderCustPage(); });
    document.getElementById('custExport').addEventListener('click', ()=>{
      // Export all customers CSV
      const rows = ['userId,subscriptionType,keysCount,keys'];
      (allCustomers||[]).forEach(c=>{ const keysList = (c.keys||[]).map(k=>`${k.key}(${k.type})`).join('|'); rows.push(`${c.userId},${c.subscriptionType||''},"${(c.keys||[]).length}","${keysList.replace(/"/g,'""')}"`); });
      const csv = rows.join('\n'); const blob = new Blob([csv], { type: 'text/csv' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `customers-${Date.now()}.csv`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    });

    await loadCustomers();
  }

  // key modal close
  if(keyModalClose){ keyModalClose.addEventListener('click', ()=>{ if(keyModal){ keyModal.style.display='none'; keyModal.classList.add('hidden'); } }); }

  async function renderSettings(){
    content.innerHTML = `
      <div class="card"><h3>Settings</h3>
        <div style="display:flex;flex-direction:column;gap:10px">
          <div style="display:flex;gap:12px;align-items:center"><label style="min-width:160px">Auth enabled:</label><button class="btn" id="toggleAuth">Toggle</button><span id="authState" style="color:var(--muted)"></span></div>
          <div style="display:flex;gap:12px;align-items:center"><label style="min-width:160px">Compact UI:</label><button class="btn" id="toggleCompact">Toggle</button><span id="compactState" style="color:var(--muted)"></span></div>
          <div style="display:flex;gap:12px;align-items:center"><label style="min-width:160px">Sidebar collapsed:</label><button class="btn" id="toggleSidebar">Toggle</button><span id="sidebarState" style="color:var(--muted)"></span></div>
          <div style="display:flex;gap:12px;align-items:center"><label style="min-width:160px">Auto-refresh on changes:</label><button class="btn" id="toggleAutoRefresh">Toggle</button><span id="autoRefreshState" style="color:var(--muted)"></span></div>
          <div style="display:flex;gap:8px;align-items:center"><label style="min-width:160px">API base override:</label><input id="apiBaseInput" class="input" style="width:420px" placeholder="https://..." /> <button class="btn" id="saveApiBase">Save</button></div>
          <div style="display:flex;gap:8px;align-items:center"><label style="min-width:160px">Local data:</label><button class="btn" id="clearLocal">Clear local storage</button></div>
        </div>
      </div>`;

    // load current values
    try{
      const r = await api.get('/settings/auth-enabled'); const enabled = r.data.authEnabled; document.getElementById('authState').textContent = enabled? 'enabled':'disabled';
    }catch(e){ document.getElementById('authState').textContent = 'unknown'; }

    document.getElementById('compactState').textContent = localStorage.getItem('kp_compact')==='1' ? 'on' : 'off';
    document.getElementById('sidebarState').textContent = localStorage.getItem('kp_sidebar_collapsed')==='1' ? 'collapsed' : 'expanded';
    document.getElementById('autoRefreshState').textContent = localStorage.getItem('kp_auto_refresh')==='1' ? 'on' : 'off';
    document.getElementById('apiBaseInput').value = localStorage.getItem('kp_api_base_override') || API_BASE;

    document.getElementById('toggleAuth').addEventListener('click', async ()=>{
      try{ const cur = (await api.get('/settings/auth-enabled')).data.authEnabled; await api.put('/settings/auth-enabled', { enabled: !cur }); showToast('Auth toggled'); renderSettings(); }catch(e){ showToast('Toggle failed'); }
    });

    document.getElementById('toggleCompact').addEventListener('click', ()=>{
      const is = document.body.classList.toggle('compact'); localStorage.setItem('kp_compact', is? '1':'0'); document.getElementById('compactState').textContent = is? 'on':'off'; showToast('Compact mode '+(is? 'on':'off'));
    });

    document.getElementById('toggleSidebar').addEventListener('click', ()=>{
      const is = document.body.classList.toggle('sidebar-collapsed'); localStorage.setItem('kp_sidebar_collapsed', is? '1':'0'); document.getElementById('sidebarState').textContent = is? 'collapsed':'expanded'; showToast('Sidebar '+(is? 'collapsed':'expanded'));
    });

    document.getElementById('toggleAutoRefresh').addEventListener('click', ()=>{
      const cur = localStorage.getItem('kp_auto_refresh')==='1'; localStorage.setItem('kp_auto_refresh', cur? '0':'1'); document.getElementById('autoRefreshState').textContent = cur? 'off':'on'; showToast('Auto-refresh on changes '+(cur? 'off':'on'));
    });

    document.getElementById('saveApiBase').addEventListener('click', ()=>{
      const v = document.getElementById('apiBaseInput').value.trim(); if(!v) return showToast('Enter API base'); localStorage.setItem('kp_api_base_override', v); api.defaults.baseURL = v; showToast('API base updated');
    });

    document.getElementById('clearLocal').addEventListener('click', ()=>{
      showConfirm('Clear local preferences (theme, aliases, compact, sidebar)?', ()=>{ localStorage.removeItem('kp_theme'); localStorage.removeItem('kp_compact'); localStorage.removeItem('kp_sidebar_collapsed'); localStorage.removeItem('kp_auto_refresh'); localStorage.removeItem('kp_api_base_override'); showToast('Local prefs cleared'); });
    });
  }

})();
