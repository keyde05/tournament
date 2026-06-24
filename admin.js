/* vulsanX Tournament — superadmin panel logic */

const ADMIN_HASH_KEY = 'vulsanx_admin_hash';
const ADMIN_SESSION_KEY = 'vulsanx_admin_logged_in';

let data = null;
let selectedTournamentId = null;

const root = document.getElementById('app');

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function esc(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

async function init() {
  data = await bootstrapData();
  if (!localStorage.getItem(ADMIN_HASH_KEY)) {
    renderSetPassword();
  } else if (sessionStorage.getItem(ADMIN_SESSION_KEY) === '1') {
    selectedTournamentId = data.activeTournamentId;
    renderDashboard();
  } else {
    renderLogin();
  }
}

function renderSetPassword() {
  root.innerHTML = `
    <div class="auth-box">
      <h2>Setup Superadmin vulsanX</h2>
      <p class="muted">Kali pertama? Set password admin untuk peranti ini. Password ini disimpan dalam browser sahaja (tidak masuk repo GitHub).</p>
      <form id="setPassForm">
        <input type="password" id="newPass" placeholder="Password baru" minlength="4" required />
        <input type="password" id="confirmPass" placeholder="Sahkan password" minlength="4" required />
        <button type="submit">Set Password & Login</button>
      </form>
      <p class="err" id="errMsg"></p>
    </div>`;
  document.getElementById('setPassForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const p1 = document.getElementById('newPass').value;
    const p2 = document.getElementById('confirmPass').value;
    if (p1 !== p2) {
      document.getElementById('errMsg').textContent = 'Password tidak sama.';
      return;
    }
    localStorage.setItem(ADMIN_HASH_KEY, await sha256(p1));
    sessionStorage.setItem(ADMIN_SESSION_KEY, '1');
    selectedTournamentId = data.activeTournamentId;
    renderDashboard();
  });
}

function renderLogin() {
  root.innerHTML = `
    <div class="auth-box">
      <h2>Login Superadmin vulsanX</h2>
      <form id="loginForm">
        <input type="password" id="password" placeholder="Password" required autofocus />
        <button type="submit">Login</button>
      </form>
      <p class="err" id="errMsg"></p>
      <p class="muted small"><a href="index.html">&larr; Balik ke paparan utama</a></p>
    </div>`;
  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const pass = document.getElementById('password').value;
    const hash = await sha256(pass);
    if (hash === localStorage.getItem(ADMIN_HASH_KEY)) {
      sessionStorage.setItem(ADMIN_SESSION_KEY, '1');
      selectedTournamentId = data.activeTournamentId;
      renderDashboard();
    } else {
      document.getElementById('errMsg').textContent = 'Password salah.';
    }
  });
}

function logout() {
  sessionStorage.removeItem(ADMIN_SESSION_KEY);
  renderLogin();
}

function renderDashboard() {
  const tournament = selectedTournamentId ? getTournament(data, selectedTournamentId) : null;

  root.innerHTML = `
    <header class="topbar">
      <div class="brand"><span class="shuttle">🏸</span> vulsanX <small>Superadmin</small></div>
      <div class="top-actions">
        <a href="index.html" class="btn small ghost">Paparan Public</a>
        <button id="exportBtn" class="btn small">Export data.json</button>
        <label class="btn small file-btn">Import
          <input type="file" id="importInput" accept=".json" hidden />
        </label>
        <button id="logoutBtn" class="btn small danger">Logout</button>
      </div>
    </header>

    <main class="layout">
      <aside class="sidebar">
        <h3>Turnamen</h3>
        <ul class="trn-list">
          ${data.tournaments.map(t => `
            <li class="${t.id === selectedTournamentId ? 'active' : ''}" data-id="${t.id}">
              <span class="trn-name">${esc(t.name)}</span>
              <span class="badge ${t.status}">${statusLabel(t.status)}</span>
            </li>`).join('') || '<li class="muted">Tiada turnamen lagi.</li>'}
        </ul>
        <form id="newTrnForm" class="stack">
          <input type="text" id="trnName" placeholder="Nama turnamen baru" required />
          <input type="number" id="trnPpt" placeholder="Player / team" min="1" value="2" required />
          <button type="submit" class="btn small">+ Cipta Turnamen</button>
        </form>
      </aside>

      <section class="content">
        ${tournament ? renderTournamentPanel(tournament) : '<p class="muted">Pilih atau cipta turnamen di sebelah kiri.</p>'}
      </section>
    </main>
    <p class="err center" id="errMsg"></p>
  `;

  bindDashboardEvents();
}

function statusLabel(s) {
  return { setup: 'Setup', ongoing: 'Berjalan', completed: 'Selesai' }[s] || s;
}

function renderTournamentPanel(t) {
  return `
    <div class="trn-header">
      <h2>${esc(t.name)}</h2>
      <div class="trn-meta">
        <span>${t.playersPerTeam} player/team</span>
        <span class="badge ${t.status}">${statusLabel(t.status)}</span>
        <button class="btn small danger" id="deleteTrnBtn" data-id="${t.id}">Padam Turnamen</button>
      </div>
    </div>

    ${t.status === 'completed' && t.champion ? `
      <div class="champion-banner">🏆 Juara: ${esc(teamName(t, t.champion))}</div>` : ''}

    <div class="grid-2">
      <div class="card">
        <h3>Team (${t.teams.length})</h3>
        <ul class="team-list">
          ${t.teams.map(team => `
            <li>
              <div>
                <strong>${esc(team.name)}</strong>
                <div class="muted small">${team.players.map(esc).join(', ')}</div>
              </div>
              <div class="team-stats">${team.wins}W - ${team.losses}L</div>
              ${t.status === 'setup' ? `<button class="btn xsmall danger" data-remove-team="${team.id}">x</button>` : ''}
            </li>`).join('') || '<li class="muted">Belum ada team.</li>'}
        </ul>

        ${t.status === 'setup' ? `
          <form id="addTeamForm" class="stack">
            <input type="text" id="teamName" placeholder="Nama team" required />
            ${Array.from({ length: t.playersPerTeam }).map((_, i) => `
              <input type="text" class="player-input" placeholder="Nama player ${i + 1}" required />`).join('')}
            <button type="submit" class="btn small">+ Tambah Team</button>
          </form>
          <button id="genBracketBtn" class="btn primary" ${t.teams.length < 2 ? 'disabled' : ''}>
            Generate Bracket (${t.teams.length} team)
          </button>
        ` : `
          <button id="resetTrnBtn" class="btn small danger">Padam Bracket & Mula Semula</button>
        `}
      </div>

      <div class="card">
        <h3>Leaderboard</h3>
        <ol class="leaderboard">
          ${getLeaderboard(t).map(team => `<li><span>${esc(team.name)}</span><span>${team.wins}W ${team.losses}L</span></li>`).join('') || '<li class="muted">Tiada data.</li>'}
        </ol>
      </div>
    </div>

    ${t.bracket ? `<div class="card"><h3>Bracket</h3>${renderBracket(t)}</div>` : ''}
  `;
}

function teamName(t, teamId) {
  if (!teamId) return '-';
  const team = t.teams.find(x => x.id === teamId);
  return team ? team.name : '?';
}

function renderBracket(t) {
  const totalRounds = t.bracket.rounds.length;
  return `<div class="bracket">
    ${t.bracket.rounds.map((round, rIdx) => `
      <div class="round">
        <h4>${roundLabel(rIdx, totalRounds)}</h4>
        ${round.matches.map((m, mIdx) => renderMatchAdmin(t, m, rIdx, mIdx)).join('')}
      </div>`).join('')}
  </div>`;
}

function renderMatchAdmin(t, m, rIdx, mIdx) {
  const aName = teamName(t, m.teamA);
  const bName = teamName(t, m.teamB);
  let body = '';
  if (m.status === 'bye') {
    body = `<div class="match-row winner">${esc(m.teamA ? aName : bName)} <small>(bye)</small></div>`;
  } else if (m.status === 'pending') {
    body = `<div class="match-row muted">Menunggu pusingan sebelum...</div>`;
  } else if (m.status === 'ready') {
    body = `
      <div class="match-row clickable" data-pick="${rIdx}:${mIdx}:${m.teamA}">${esc(aName)}</div>
      <div class="match-row clickable" data-pick="${rIdx}:${mIdx}:${m.teamB}">${esc(bName)}</div>`;
  } else if (m.status === 'done') {
    body = `
      <div class="match-row ${m.winner === m.teamA ? 'winner' : 'loser'}">${esc(aName)}</div>
      <div class="match-row ${m.winner === m.teamB ? 'winner' : 'loser'}">${esc(bName)}</div>
      <button class="btn xsmall" data-reset="${rIdx}:${mIdx}">Reset</button>`;
  }
  return `<div class="match">${body}</div>`;
}

function bindDashboardEvents() {
  document.getElementById('exportBtn').addEventListener('click', () => exportData(data));
  document.getElementById('importInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    importData(file, (err, newData) => {
      if (err) { alert('Fail tidak sah.'); return; }
      data = newData;
      selectedTournamentId = data.activeTournamentId;
      renderDashboard();
    });
  });
  document.getElementById('logoutBtn').addEventListener('click', logout);

  document.querySelectorAll('.trn-list li[data-id]').forEach(li => {
    li.addEventListener('click', () => {
      selectedTournamentId = li.dataset.id;
      data.activeTournamentId = selectedTournamentId;
      saveData(data);
      renderDashboard();
    });
  });

  document.getElementById('newTrnForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('trnName').value;
    const ppt = document.getElementById('trnPpt').value;
    const t = createTournament(data, name, ppt);
    selectedTournamentId = t.id;
    data.activeTournamentId = t.id;
    saveData(data);
    renderDashboard();
  });

  const deleteTrnBtn = document.getElementById('deleteTrnBtn');
  if (deleteTrnBtn) deleteTrnBtn.addEventListener('click', () => {
    if (!confirm('Padam turnamen ini? Tindakan ini tidak boleh diundur.')) return;
    deleteTournament(data, deleteTrnBtn.dataset.id);
    selectedTournamentId = data.activeTournamentId;
    renderDashboard();
  });

  const addTeamForm = document.getElementById('addTeamForm');
  if (addTeamForm) addTeamForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const t = getTournament(data, selectedTournamentId);
    const name = document.getElementById('teamName').value;
    const players = Array.from(document.querySelectorAll('.player-input')).map(i => i.value);
    addTeam(t, name, players);
    saveData(data);
    renderDashboard();
  });

  document.querySelectorAll('[data-remove-team]').forEach(btn => {
    btn.addEventListener('click', () => {
      const t = getTournament(data, selectedTournamentId);
      removeTeam(t, btn.dataset.removeTeam);
      saveData(data);
      renderDashboard();
    });
  });

  const genBtn = document.getElementById('genBracketBtn');
  if (genBtn) genBtn.addEventListener('click', () => {
    const t = getTournament(data, selectedTournamentId);
    try {
      generateBracket(t);
      saveData(data);
      renderDashboard();
    } catch (err) {
      document.getElementById('errMsg').textContent = err.message;
    }
  });

  const resetTrnBtn = document.getElementById('resetTrnBtn');
  if (resetTrnBtn) resetTrnBtn.addEventListener('click', () => {
    if (!confirm('Padam bracket & mula semula? Semua keputusan match akan hilang.')) return;
    const t = getTournament(data, selectedTournamentId);
    t.bracket = null;
    t.status = 'setup';
    t.champion = null;
    t.teams.forEach(team => { team.wins = 0; team.losses = 0; });
    saveData(data);
    renderDashboard();
  });

  document.querySelectorAll('[data-pick]').forEach(el => {
    el.addEventListener('click', () => {
      const [rIdx, mIdx, teamId] = el.dataset.pick.split(':');
      const t = getTournament(data, selectedTournamentId);
      setMatchWinner(t, Number(rIdx), Number(mIdx), teamId);
      saveData(data);
      renderDashboard();
    });
  });

  document.querySelectorAll('[data-reset]').forEach(el => {
    el.addEventListener('click', () => {
      if (!confirm('Reset match ini? Sebarang kemajuan pusingan seterusnya yang bergantung padanya juga akan dipadam.')) return;
      const [rIdx, mIdx] = el.dataset.reset.split(':');
      const t = getTournament(data, selectedTournamentId);
      clearMatchForward(t, Number(rIdx), Number(mIdx));
      saveData(data);
      renderDashboard();
    });
  });
}

init();
