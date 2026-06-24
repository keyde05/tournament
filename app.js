/* vulsanX Tournament — public viewer + self-report logic */

let data = null;
let selectedTournamentId = null;

const root = document.getElementById('app');

function esc(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

async function init() {
  data = await bootstrapData();
  selectedTournamentId = data.activeTournamentId;
  render();
}

function teamName(t, teamId) {
  if (!teamId) return '-';
  const team = t.teams.find(x => x.id === teamId);
  return team ? team.name : '?';
}

function render() {
  const tournament = selectedTournamentId ? getTournament(data, selectedTournamentId) : null;

  root.innerHTML = `
    <header class="topbar">
      <div class="brand"><span class="shuttle">🏸</span> vulsanX <small>Badminton Tournament</small></div>
      <div class="top-actions">
        <a href="admin.html" class="btn small ghost">Admin</a>
      </div>
    </header>

    <main class="public-layout">
      ${data.tournaments.length > 1 ? `
        <select id="trnSelect" class="trn-select">
          ${data.tournaments.map(t => `<option value="${t.id}" ${t.id === selectedTournamentId ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}
        </select>` : ''}

      ${tournament ? renderTournament(tournament) : `<p class="muted center">Belum ada turnamen lagi. Sila tunggu superadmin set up.</p>`}
    </main>
  `;

  bindEvents(tournament);
}

function renderTournament(t) {
  return `
    <h1 class="trn-title">${esc(t.name)}</h1>
    <p class="muted center">${t.playersPerTeam} player/team &middot; ${statusLabel(t.status)}</p>

    ${t.status === 'completed' && t.champion ? `<div class="champion-banner">🏆 Juara: ${esc(teamName(t, t.champion))}</div>` : ''}

    ${renderClaimBox(t)}

    ${t.bracket ? `
      <section class="card">
        <h3>Bracket</h3>
        ${renderBracket(t)}
      </section>` : `<p class="muted center">Bracket belum digenerate oleh superadmin.</p>`}

    <section class="card">
      <h3>Leaderboard</h3>
      <ol class="leaderboard">
        ${getLeaderboard(t).map(team => `<li><span>${esc(team.name)}</span><span>${team.wins}W ${team.losses}L</span></li>`).join('') || '<li class="muted">Tiada data.</li>'}
      </ol>
    </section>

    <section class="card">
      <h3>Team Berdaftar (${t.teams.length})</h3>
      <ul class="team-list view-only">
        ${t.teams.map(team => `<li><strong>${esc(team.name)}</strong><span class="muted small">${team.players.map(esc).join(', ')}</span></li>`).join('') || '<li class="muted">Belum ada team.</li>'}
      </ul>
    </section>
  `;
}

function statusLabel(s) {
  return { setup: 'Belum mula', ongoing: 'Sedang berjalan', completed: 'Selesai' }[s] || s;
}

function renderClaimBox(t) {
  const claimedTeamId = getClaim(data, t.id);
  if (claimedTeamId) {
    const team = t.teams.find(x => x.id === claimedTeamId);
    if (!team) {
      clearClaim(data, t.id);
    } else {
      const liveMatch = findLiveMatchForTeam(t, claimedTeamId);
      return `
        <div class="claim-box claimed">
          <p>Peranti ini didaftarkan sebagai team: <strong>${esc(team.name)}</strong></p>
          ${liveMatch ? renderSelfReport(t, liveMatch, claimedTeamId) : '<p class="muted small">Tiada match aktif untuk team anda sekarang.</p>'}
          <button id="unclaimBtn" class="btn xsmall ghost">Bukan team anda? Reset peranti ini</button>
        </div>`;
    }
  }
  if (!t.teams.length) return '';
  return `
    <div class="claim-box">
      <p>Pilih nama team anda untuk peranti ini (sekali sahaja, untuk report Win/Lose):</p>
      <form id="claimForm" class="stack-row">
        <select id="claimTeamSelect">
          ${t.teams.map(team => `<option value="${team.id}">${esc(team.name)}</option>`).join('')}
        </select>
        <button type="submit" class="btn small primary">Sahkan</button>
      </form>
    </div>`;
}

function findLiveMatchForTeam(t, teamId) {
  if (!t.bracket) return null;
  for (let rIdx = 0; rIdx < t.bracket.rounds.length; rIdx++) {
    const matches = t.bracket.rounds[rIdx].matches;
    for (let mIdx = 0; mIdx < matches.length; mIdx++) {
      const m = matches[mIdx];
      if (m.status === 'ready' && (m.teamA === teamId || m.teamB === teamId)) {
        return { rIdx, mIdx, match: m };
      }
    }
  }
  return null;
}

function renderSelfReport(t, live, teamId) {
  const opponentId = live.match.teamA === teamId ? live.match.teamB : live.match.teamA;
  return `
    <div class="self-report">
      <p>Match semasa anda lawan <strong>${esc(teamName(t, opponentId))}</strong>:</p>
      <div class="self-report-btns">
        <button class="btn primary" data-report="${live.rIdx}:${live.mIdx}:${teamId}">Kami Menang 🏆</button>
        <button class="btn danger" data-report="${live.rIdx}:${live.mIdx}:${opponentId}">Kami Kalah</button>
      </div>
    </div>`;
}

function renderBracket(t) {
  const totalRounds = t.bracket.rounds.length;
  return `<div class="bracket">
    ${t.bracket.rounds.map((round, rIdx) => `
      <div class="round">
        <h4>${roundLabel(rIdx, totalRounds)}</h4>
        ${round.matches.map(m => renderMatchView(t, m)).join('')}
      </div>`).join('')}
  </div>`;
}

function renderMatchView(t, m) {
  const aName = teamName(t, m.teamA);
  const bName = teamName(t, m.teamB);
  if (m.status === 'bye') {
    return `<div class="match"><div class="match-row winner">${esc(m.teamA ? aName : bName)} <small>(bye)</small></div></div>`;
  }
  if (m.status === 'pending') {
    return `<div class="match"><div class="match-row muted">Menunggu...</div></div>`;
  }
  if (m.status === 'ready') {
    return `<div class="match"><div class="match-row">${esc(aName)}</div><div class="match-row">${esc(bName)}</div></div>`;
  }
  return `<div class="match">
    <div class="match-row ${m.winner === m.teamA ? 'winner' : 'loser'}">${esc(aName)}</div>
    <div class="match-row ${m.winner === m.teamB ? 'winner' : 'loser'}">${esc(bName)}</div>
  </div>`;
}

function bindEvents(tournament) {
  const trnSelect = document.getElementById('trnSelect');
  if (trnSelect) trnSelect.addEventListener('change', () => {
    selectedTournamentId = trnSelect.value;
    render();
  });

  const claimForm = document.getElementById('claimForm');
  if (claimForm) claimForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const teamId = document.getElementById('claimTeamSelect').value;
    setClaim(data, tournament.id, teamId);
    render();
  });

  const unclaimBtn = document.getElementById('unclaimBtn');
  if (unclaimBtn) unclaimBtn.addEventListener('click', () => {
    if (!confirm('Reset pendaftaran team untuk peranti ini?')) return;
    clearClaim(data, tournament.id);
    render();
  });

  document.querySelectorAll('[data-report]').forEach(btn => {
    btn.addEventListener('click', () => {
      const [rIdx, mIdx, winnerId] = btn.dataset.report.split(':');
      setMatchWinner(tournament, Number(rIdx), Number(mIdx), winnerId);
      saveData(data);
      render();
    });
  });
}

init();
