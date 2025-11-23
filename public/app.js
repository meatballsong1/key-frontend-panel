(function(){
  const API_BASE = 'https://tradeskey-backend.onrender.com/';
  const whoEl = document.getElementById('who');
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toastMsg');
  const audio = document.getElementById('notifAudio');

  // Axios instance with interceptor to detect API errors and notify
  // Use credentials so backend can set httpOnly cookies; we prefer cookie-based auth.
  const api = axios.create({ baseURL: API_BASE, timeout: 8000, withCredentials: true });
  api.interceptors.response.use(r=>r, err => {
    // Network error or bad status
    notifyApiDown();
    return Promise.reject(err);
  });

  function notifyApiDown(){
    showToast('Oops! API is currently down');
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

  // Simple client-side router + UI
  const tabs = document.querySelectorAll('.navbtn');
  const content = document.getElementById('content');
  const title = document.getElementById('viewTitle');

  function setActive(tabName){
    tabs.forEach(t=>t.classList.remove('active'));
    const tb = document.querySelector('[data-tab="'+tabName+'"]'); if(tb) tb.classList.add('active');
    title.textContent = tabName[0].toUpperCase()+tabName.slice(1);
    renderTab(tabName);
  }

  tabs.forEach(t=>t.addEventListener('click', ()=>setActive(t.dataset.tab)));

  // make first tab visually active by default
  (function initTabs(){
    const first = document.querySelector('.navbtn[data-tab="stats"]');
    if(first) first.classList.add('active');
  })();

  // Login state
  function getToken(){
    const m = document.cookie.match(/(^|; )auth_token=([^;]+)/); return m ? decodeURIComponent(m[2]) : null;
  }
  function setToken(tok){
    // Fallback: if backend doesn't set httpOnly cookie, we set a client cookie and header.
    // Prefer server-set httpOnly cookies; this is only a fallback.
    console.warn('Setting fallback token cookie/header — prefer server-set httpOnly cookie');
    const secure = location.protocol === 'https:' ? '; Secure' : '';
    const maxAge = 60*60*24*7; // 7 days
    document.cookie = 'auth_token='+encodeURIComponent(tok)+'; path=/; SameSite=Lax; Max-Age='+maxAge + secure;
    api.defaults.headers.common['x-login-token'] = tok;
  }
  function clearToken(){
    document.cookie = 'auth_token=; max-age=0; path=/';
    delete api.defaults.headers.common['x-login-token'];
  }

  document.getElementById('logoutBtn').addEventListener('click', ()=>{ clearToken(); showToast('Logged out'); setTimeout(()=>location.reload(),300); });

  // Initial load: if no token, show login UI, else panel
  // Check authentication by attempting an authenticated request (backend should use cookie auth)
  (async function checkAuth(){
    try{
      await api.get('/keys');
      whoEl.textContent = 'admin';
      setActive('stats');
    }catch(err){
      // not authenticated (or insufficient permissions) — show login
      renderLogin();
    }
  })();

  function renderLogin(){
    content.innerHTML = `
      <div style="max-width:520px;margin:auto">
        <h2>Login</h2>
        <div class="card">
          <label>Token</label>
          <input id="tokenInput" class="input" placeholder="Enter admin token (e.g. testware)" />
          <div style="height:8px"></div>
          <button class="btn" id="loginBtn">Login</button>
          <div id="loginErr" style="color:#ffb4c6;margin-top:8px"></div>
        </div>
      </div>`;

    // focus and allow Enter to submit
    const tokenInput = document.getElementById('tokenInput');
    if(tokenInput) { tokenInput.focus(); tokenInput.addEventListener('keydown', (e)=>{ if(e.key === 'Enter') document.getElementById('loginBtn').click(); }); }

    document.getElementById('loginBtn').addEventListener('click', async ()=>{
      const token = document.getElementById('tokenInput').value.trim();
      if(!token){ document.getElementById('loginErr').textContent = 'Please enter a token'; return; }
      try{
        // POST /login and allow backend to set httpOnly cookie (requires backend CORS allow credentials)
        const res = await api.post('/login', { token });
        // If server set an httpOnly cookie, subsequent requests will be authenticated.
        try{ await api.get('/keys'); whoEl.textContent = res.data.role || 'admin'; showToast('Login successful'); setActive('stats'); return; }catch(e){}

        // Fallback: server didn't set cookie — use token from response and set header/cookie locally
        if(res.data && res.data.token){ setToken(res.data.token); whoEl.textContent = res.data.role || 'admin'; showToast('Login successful (fallback)'); setActive('stats'); }
        else { document.getElementById('loginErr').textContent = 'Invalid token or server did not authenticate'; }
      }catch(err){ document.getElementById('loginErr').textContent = 'Login failed: API error'; }
    });
  }

  // Render functions for tabs
  async function renderTab(tab){
    if(tab === 'stats') return renderStats();
    if(tab === 'keys') return renderKeys();
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
      </div>
      <div id="statsArea">Loading...</div>
    </div>`;
    const area = document.getElementById('statsArea');
    const ranges = { r24:24, r48:48, r7:24*7, r30:24*30 };
    let chartInstance = null;
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
    // default 24h
    const def = document.getElementById('r24'); if(def) { def.classList.add('active'); refresh('r24'); }
  }

  async function renderKeys(){
    content.innerHTML = `
      <div class="card"><h3>Key Management</h3>
        <div style="display:flex;gap:8px;margin-bottom:8px;align-items:center">
          <input id="genAmount" class="input" placeholder="Amount (1)" style="width:120px" />
          <select id="genType" class="input" style="width:160px"><option value="lifetime">Lifetime</option><option value="weekly">Weekly</option></select>
          <button class="btn" id="genBtn">Generate</button>
          <button class="btn" id="exportBtn">Export CSV</button>
          <input id="keysSearch" class="input" placeholder="Search keys..." style="margin-left:auto;width:260px" />
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
          await loadKeysList();
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
      return `<div class="card" style="display:flex;justify-content:space-between;align-items:center"><div>
        <div style="font-weight:700"><span class="key-name" data-key="${k.key}">${alias || k.key}</span></div>
        <div style="font-size:12px;color:var(--muted)">${k.type} • redeemed:${k.redeemed}</div>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <select class="input select type-select" data-key="${k.key}"><option value="lifetime">lifetime</option><option value="weekly">weekly</option></select>
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

    list.querySelectorAll('button[data-action="copy"]').forEach(b=>b.addEventListener('click', e=>{ navigator.clipboard.writeText(e.target.dataset.key); showToast('Copied'); }));
    list.querySelectorAll('button[data-action="delete"]').forEach(b=>b.addEventListener('click', async e=>{
      const key = e.target.dataset.key;
      if(!confirm('Delete key '+key+'?')) return;
      try{ await api.delete('/keys/'+encodeURIComponent(key)); showToast('Deleted'); await loadKeysList(); }catch(err){ showToast('Delete failed'); }
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

  async function renderSettings(){
    content.innerHTML = `<div class="card"><h3>Settings</h3><div style="display:flex;gap:12px;align-items:center"><label>Auth enabled:</label><button class="btn" id="toggleAuth">Toggle</button></div><div id="settingsMsg" style="margin-top:8px"></div></div>`;
    try{ const r = await api.get('/settings/auth-enabled'); const enabled = r.data.authEnabled; document.getElementById('settingsMsg').textContent = 'Auth is '+(enabled?'enabled':'disabled'); }catch(e){ document.getElementById('settingsMsg').textContent='Failed to read settings'; }
    document.getElementById('toggleAuth').addEventListener('click', async ()=>{
      try{ const cur = (await api.get('/settings/auth-enabled')).data.authEnabled; await api.put('/settings/auth-enabled', { enabled: !cur }); showToast('Toggled'); renderSettings(); }catch(e){ showToast('Toggle failed'); }
    });
  }

})();
