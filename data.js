/* vulsanX Tournament — data layer (localStorage only, no backend) */

const STORAGE_KEY = 'vulsanx_data_v1';
const DEVICE_KEY = 'vulsanx_device_id';

function uid(prefix) {
  return prefix + '_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
}

function getDeviceId() {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = uid('dev');
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

function defaultData() {
  return {
    tournaments: [],
    activeTournamentId: null,
    claims: {} // { [tournamentId]: { [deviceId]: teamId } }
  };
}

function loadData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return defaultData();
  try {
    const parsed = JSON.parse(raw);
    return Object.assign(defaultData(), parsed);
  } catch (e) {
    return defaultData();
  }
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// On first load (no localStorage yet), try to seed from the static data.json snapshot
// committed to the repo, so GitHub Pages viewers see the latest published state.
async function bootstrapData() {
  const existing = localStorage.getItem(STORAGE_KEY);
  if (existing) return loadData();
  try {
    const res = await fetch('data.json', { cache: 'no-store' });
    if (res.ok) {
      const json = await res.json();
      const merged = Object.assign(defaultData(), json, { claims: {} });
      saveData(merged);
      return merged;
    }
  } catch (e) { /* no data.json yet, fall through */ }
  const fresh = defaultData();
  saveData(fresh);
  return fresh;
}

function getTournament(data, id) {
  return data.tournaments.find(t => t.id === id) || null;
}

function createTournament(data, name, playersPerTeam) {
  const t = {
    id: uid('trn'),
    name: name.trim(),
    playersPerTeam: Math.max(1, parseInt(playersPerTeam, 10) || 1),
    status: 'setup', // setup -> ongoing -> completed
    createdAt: Date.now(),
    teams: [],
    bracket: null,
    champion: null
  };
  data.tournaments.push(t);
  if (!data.activeTournamentId) data.activeTournamentId = t.id;
  saveData(data);
  return t;
}

function deleteTournament(data, tournamentId) {
  data.tournaments = data.tournaments.filter(t => t.id !== tournamentId);
  if (data.activeTournamentId === tournamentId) {
    data.activeTournamentId = data.tournaments.length ? data.tournaments[0].id : null;
  }
  delete data.claims[tournamentId];
  saveData(data);
}

function addTeam(tournament, name, players) {
  const team = {
    id: uid('team'),
    name: name.trim(),
    players: players.map(p => p.trim()).filter(Boolean),
    wins: 0,
    losses: 0
  };
  tournament.teams.push(team);
  return team;
}

function removeTeam(tournament, teamId) {
  tournament.teams = tournament.teams.filter(t => t.id !== teamId);
}

function shuffleArray(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function nextPowerOf2(n) {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

function makeMatch(teamA, teamB) {
  let status, winner = null;
  if (teamA && teamB) status = 'ready';
  else if (teamA || teamB) { status = 'bye'; winner = teamA || teamB; }
  else status = 'pending';
  return { id: uid('m'), teamA, teamB, winner, status };
}

// Single-elimination bracket generation with bye distribution that never
// pairs two byes together (possible because byesNeeded is always < matchCount).
function generateBracket(tournament) {
  const teamIds = tournament.teams.map(t => t.id);
  if (teamIds.length < 2) throw new Error('Perlukan sekurang-kurangnya 2 team untuk generate bracket.');

  const shuffled = shuffleArray(teamIds);
  const n = shuffled.length;
  const size = nextPowerOf2(n);
  const matchCount = size / 2;
  const byesNeeded = size - n;
  const fullMatches = matchCount - byesNeeded;

  const round1 = [];
  let idx = 0;
  for (let i = 0; i < fullMatches; i++) {
    round1.push(makeMatch(shuffled[idx], shuffled[idx + 1]));
    idx += 2;
  }
  for (let i = 0; i < byesNeeded; i++) {
    round1.push(makeMatch(shuffled[idx], null));
    idx += 1;
  }

  const rounds = [{ roundNumber: 1, matches: round1 }];
  let prevCount = round1.length;
  let roundNumber = 2;
  while (prevCount > 1) {
    const matches = [];
    for (let i = 0; i < prevCount / 2; i++) matches.push(makeMatch(null, null));
    rounds.push({ roundNumber, matches });
    prevCount = matches.length;
    roundNumber++;
  }

  tournament.bracket = { size, rounds };
  tournament.status = 'ongoing';
  tournament.champion = null;

  // Propagate any immediate byes from round 1 onward.
  rounds[0].matches.forEach((m, i) => {
    if (m.winner) propagateToNextRound(tournament, 0, i, m.winner);
  });

  return tournament.bracket;
}

function roundLabel(roundIndex, totalRounds) {
  const fromEnd = totalRounds - roundIndex;
  if (fromEnd === 1) return 'Final';
  if (fromEnd === 2) return 'Separuh Akhir';
  if (fromEnd === 3) return 'Suku Akhir';
  return 'Pusingan ' + (roundIndex + 1);
}

function updateTeamStats(tournament, match, sign) {
  if (!match.teamA || !match.teamB) return; // bye, no stats
  const winnerId = match.winner;
  const loserId = match.teamA === winnerId ? match.teamB : match.teamA;
  const winner = tournament.teams.find(t => t.id === winnerId);
  const loser = tournament.teams.find(t => t.id === loserId);
  if (winner) winner.wins += sign;
  if (loser) loser.losses += sign;
}

function propagateToNextRound(tournament, roundIndex, matchIndex, winnerId) {
  const rounds = tournament.bracket.rounds;
  const nextRoundIndex = roundIndex + 1;
  if (nextRoundIndex >= rounds.length) return;
  const nextMatch = rounds[nextRoundIndex].matches[Math.floor(matchIndex / 2)];
  if (matchIndex % 2 === 0) nextMatch.teamA = winnerId;
  else nextMatch.teamB = winnerId;

  if (nextMatch.teamA && nextMatch.teamB) {
    nextMatch.status = 'ready';
  } else if (nextMatch.teamA || nextMatch.teamB) {
    // A bye only happens at this point if the round was generated empty and one
    // side stays permanently unfilled, which doesn't occur in single elimination
    // past round 1 — kept as 'pending' until the sibling match resolves.
    nextMatch.status = 'pending';
  }
}

function setMatchWinner(tournament, roundIndex, matchIndex, winnerId) {
  const match = tournament.bracket.rounds[roundIndex].matches[matchIndex];
  if (!match.teamA || !match.teamB) throw new Error('Match ini belum sedia (menunggu pusingan sebelum).');
  if (winnerId !== match.teamA && winnerId !== match.teamB) throw new Error('Team tidak sah untuk match ini.');

  match.winner = winnerId;
  match.status = 'done';
  updateTeamStats(tournament, match, 1);
  propagateToNextRound(tournament, roundIndex, matchIndex, winnerId);
  checkCompletion(tournament, roundIndex, matchIndex);
}

function checkCompletion(tournament, roundIndex, matchIndex) {
  const rounds = tournament.bracket.rounds;
  const isLastRound = roundIndex === rounds.length - 1;
  if (isLastRound) {
    const match = rounds[roundIndex].matches[matchIndex];
    if (match.winner) {
      tournament.status = 'completed';
      tournament.champion = match.winner;
    }
  }
}

// Clears a decided match and cascades the clear forward through any rounds
// that already inherited its winner (used for admin corrections).
function clearMatchForward(tournament, roundIndex, matchIndex) {
  const rounds = tournament.bracket.rounds;
  const match = rounds[roundIndex].matches[matchIndex];

  if (match.winner) updateTeamStats(tournament, match, -1);

  const nextRoundIndex = roundIndex + 1;
  if (nextRoundIndex < rounds.length) {
    const nextMatchIndex = Math.floor(matchIndex / 2);
    clearMatchForward(tournament, nextRoundIndex, nextMatchIndex);
    const nextMatch = rounds[nextRoundIndex].matches[nextMatchIndex];
    if (matchIndex % 2 === 0) nextMatch.teamA = null;
    else nextMatch.teamB = null;
    nextMatch.status = 'pending';
  }

  if (match.status !== 'bye') {
    match.winner = null;
    match.status = (match.teamA && match.teamB) ? 'ready' : 'pending';
  }

  tournament.status = 'ongoing';
  tournament.champion = null;
}

function getLeaderboard(tournament) {
  return tournament.teams.slice().sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    return a.losses - b.losses;
  });
}

function getClaim(data, tournamentId) {
  const deviceId = getDeviceId();
  return (data.claims[tournamentId] || {})[deviceId] || null;
}

function setClaim(data, tournamentId, teamId) {
  const deviceId = getDeviceId();
  if (!data.claims[tournamentId]) data.claims[tournamentId] = {};
  data.claims[tournamentId][deviceId] = teamId;
  saveData(data);
}

function clearClaim(data, tournamentId) {
  const deviceId = getDeviceId();
  if (data.claims[tournamentId]) delete data.claims[tournamentId][deviceId];
  saveData(data);
}

function exportData(data) {
  const exportObj = { tournaments: data.tournaments, activeTournamentId: data.activeTournamentId };
  const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'data.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function importData(file, onDone) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const json = JSON.parse(reader.result);
      const data = loadData();
      data.tournaments = json.tournaments || [];
      data.activeTournamentId = json.activeTournamentId || (data.tournaments[0] && data.tournaments[0].id) || null;
      saveData(data);
      onDone(null, data);
    } catch (e) {
      onDone(e);
    }
  };
  reader.readAsText(file);
}
