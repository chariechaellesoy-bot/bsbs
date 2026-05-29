/* ================================================================
   BlackSheep Shuffler — badminton-shuffler.js
   ================================================================ */
'use strict';

// ================================================================
// GLOBAL ENTRY MODE STATE
// ================================================================
var SESSION_ENTRY_MODE    = 'single';
var PROMOTION_ENTRY_MODE  = 'single';
var TOURNAMENT_ENTRY_MODE = 'single';

// ================================================================
// CURRENT MODE
// ================================================================
var MODE = 'home'; // 'home' | 'session' | 'tournament' | 'promotion'

// ================================================================
// SESSION STATE
// ================================================================
var S = {
  players: [],          // [{name, skill:'beg'|'int'|'adv', isActive:true}]
  courts: [],           // [{name, players:[4 names]|null, isActive:bool, pendingWinner:bool}]
  courtCount: 1,
  playCount: {},        // {name:{games,wins,losses,lastGameIndex}}
  history: [],          // [{court,teamA:[],teamB:[],winner:'A'|'B',time}]
  gameIndex: 0,
  undoStack: [],
  adminPin: null,
  rvbMode: false,
  customGames: [],      // [{courtIdx, players:[4]}] queue
  started: false
};

// ================================================================
// TOURNAMENT STATE
// ================================================================
var T = {
  players: [],          // [name]
  teams: [],            // [{name, p1, p2}]
  courts: [],           // [{name}]
  courtCount: 1,
  schedule: [],         // [{team1Idx, team2Idx}]
  results: [],          // [{team1Idx, team2Idx, winner:1|2}]
  courtAssignments: {}, // {courtIdx: scheduleIdx | null}
  nextMatchIdx: 0,
  undoStack: [],
  started: false
};

// ================================================================
// PROMOTION STATE
// ================================================================
var P = {
  players: {},          // {name: {lane:'seed'|'winners'|'losers'|'oncourt', isActive:bool, waitSince:gameIdx}}
  courts: [],           // [{name, players:[4], lane:'seed'|'winners'|'losers'|'custom', isActive:bool}]
  courtCount: 1,
  playCount: {},        // {name:{games,wins,losses,lanes:{seed,winners,losers,custom}}}
  history: [],
  gameIndex: 0,
  undoStack: [],
  started: false
};

// ================================================================
// UTILITIES
// ================================================================
function $id(id) { return document.getElementById(id); }
function show(id) { var el = $id(id); if (el) el.classList.remove('hidden'); }
function hide(id) { var el = $id(id); if (el) el.classList.add('hidden'); }
function setHtml(id, html) { var el = $id(id); if (el) el.innerHTML = html; }
function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function toast(msg, duration) {
  duration = duration || 2500;
  var el = $id('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(el._timer);
  el._timer = setTimeout(function() { el.classList.add('hidden'); }, duration);
}

function deepCopy(obj) { return JSON.parse(JSON.stringify(obj)); }

// ================================================================
// SAVE / LOAD
// ================================================================
function saveState() {
  try {
    localStorage.setItem('bsbs_mode', MODE);
    localStorage.setItem('bsbs_S', JSON.stringify(S));
    localStorage.setItem('bsbs_T', JSON.stringify(T));
    localStorage.setItem('bsbs_P', JSON.stringify(P));
    localStorage.setItem('bsbs_sem', SESSION_ENTRY_MODE);
    localStorage.setItem('bsbs_pem', PROMOTION_ENTRY_MODE);
    localStorage.setItem('bsbs_tem', TOURNAMENT_ENTRY_MODE);
  } catch(e) { /* storage unavailable */ }
}

function loadState() {
  try {
    var m = localStorage.getItem('bsbs_mode');
    if (m) MODE = m;
    var s = localStorage.getItem('bsbs_S');
    if (s) S = JSON.parse(s);
    var t = localStorage.getItem('bsbs_T');
    if (t) T = JSON.parse(t);
    var p = localStorage.getItem('bsbs_P');
    if (p) P = JSON.parse(p);
    var sem = localStorage.getItem('bsbs_sem');
    if (sem) SESSION_ENTRY_MODE = sem;
    var pem = localStorage.getItem('bsbs_pem');
    if (pem) PROMOTION_ENTRY_MODE = pem;
    var tem = localStorage.getItem('bsbs_tem');
    if (tem) TOURNAMENT_ENTRY_MODE = tem;
  } catch(e) { /* ignore */ }
}

// ================================================================
// SCREEN NAVIGATION
// ================================================================
function showScreen(name) {
  hide('homeScreen');
  hide('sessionScreen');
  hide('tournamentScreen');
  hide('promotionScreen');
  if (name === 'home') {
    show('homeScreen');
    hide('bottomNav');
  } else if (name === 'session') {
    show('sessionScreen');
    if (S.started) { show('bottomNav'); } else { hide('bottomNav'); }
  } else if (name === 'tournament') {
    show('tournamentScreen');
    if (T.started) { show('bottomNav'); } else { hide('bottomNav'); }
  } else if (name === 'promotion') {
    show('promotionScreen');
    if (P.started) { show('bottomNav'); } else { hide('bottomNav'); }
  }
}

// ================================================================
// ENTRY MODE: SESSION
// ================================================================
function setPlayerEntryMode(mode) {
  SESSION_ENTRY_MODE = mode;
  var sBtn = $id('entryModeSingleBtn');
  var bBtn = $id('entryModeBulkBtn');
  var inp  = $id('playerNameInput');
  var bulk = $id('playerNameBulkInput');
  var bulkAdd = $id('bulkAddBtn');
  var hint = $id('playerEntryHint');
  var lbl  = document.querySelector('label[for="playerNameInput"]');

  if (mode === 'single') {
    if (sBtn) sBtn.classList.add('active');
    if (bBtn) bBtn.classList.remove('active');
    if (inp)  { inp.classList.remove('hidden'); inp.closest('.input-row').classList.remove('hidden'); }
    if (bulk)   bulk.classList.add('hidden');
    if (bulkAdd) bulkAdd.classList.add('hidden');
    if (hint) hint.textContent = 'Type a name and press Add or Enter';
    if (lbl)  lbl.textContent = 'Add Players';
  } else {
    if (sBtn) sBtn.classList.remove('active');
    if (bBtn) bBtn.classList.add('active');
    if (inp && inp.closest('.input-row')) inp.closest('.input-row').classList.add('hidden');
    if (bulk)   bulk.classList.remove('hidden');
    if (bulkAdd) bulkAdd.classList.remove('hidden');
    if (hint) hint.textContent = 'Enter multiple names — one per line or comma-separated';
    if (lbl)  lbl.textContent = 'Add Players (Bulk)';
  }
}

// ================================================================
// ENTRY MODE: PROMOTION
// ================================================================
function setPromotionEntryMode(mode) {
  PROMOTION_ENTRY_MODE = mode;
  var sBtn = $id('pEntryModeSingleBtn');
  var bBtn = $id('pEntryModeBulkBtn');
  var inp  = $id('pPlayerNameInput');
  var bulk = $id('pPlayerNameBulkInput');
  var bulkAdd = $id('pBulkAddBtn');
  var hint = $id('pPlayerEntryHint');
  var lbl  = document.querySelector('label[for="pPlayerNameInput"]');

  if (mode === 'single') {
    if (sBtn) sBtn.classList.add('active');
    if (bBtn) bBtn.classList.remove('active');
    if (inp && inp.closest('.input-row')) inp.closest('.input-row').classList.remove('hidden');
    if (bulk)   bulk.classList.add('hidden');
    if (bulkAdd) bulkAdd.classList.add('hidden');
    if (hint) hint.textContent = 'Type a name and press Add or Enter';
    if (lbl)  lbl.textContent = 'Add Players';
  } else {
    if (sBtn) sBtn.classList.remove('active');
    if (bBtn) bBtn.classList.add('active');
    if (inp && inp.closest('.input-row')) inp.closest('.input-row').classList.add('hidden');
    if (bulk)   bulk.classList.remove('hidden');
    if (bulkAdd) bulkAdd.classList.remove('hidden');
    if (hint) hint.textContent = 'Enter multiple names — one per line or comma-separated';
    if (lbl)  lbl.textContent = 'Add Players (Bulk)';
  }
}

// ================================================================
// ENTRY MODE: TOURNAMENT
// ================================================================
function setTournamentEntryMode(mode) {
  TOURNAMENT_ENTRY_MODE = mode;
  var sBtn = $id('tEntryModeSingleBtn');
  var bBtn = $id('tEntryModeBulkBtn');
  var inp  = $id('tPlayerNameInput');
  var bulk = $id('tPlayerNameBulkInput');
  var bulkAdd = $id('tBulkAddBtn');
  var hint = $id('tPlayerEntryHint');
  var lbl  = document.querySelector('label[for="tPlayerNameInput"]');

  if (mode === 'single') {
    if (sBtn) sBtn.classList.add('active');
    if (bBtn) bBtn.classList.remove('active');
    if (inp && inp.closest('.input-row')) inp.closest('.input-row').classList.remove('hidden');
    if (bulk)   bulk.classList.add('hidden');
    if (bulkAdd) bulkAdd.classList.add('hidden');
    if (hint) hint.textContent = 'Type a name and press Add or Enter';
    if (lbl)  lbl.textContent = 'Add Players';
  } else {
    if (sBtn) sBtn.classList.remove('active');
    if (bBtn) bBtn.classList.add('active');
    if (inp && inp.closest('.input-row')) inp.closest('.input-row').classList.add('hidden');
    if (bulk)   bulk.classList.remove('hidden');
    if (bulkAdd) bulkAdd.classList.remove('hidden');
    if (hint) hint.textContent = 'Enter multiple names — one per line or comma-separated';
    if (lbl)  lbl.textContent = 'Add Players (Bulk)';
  }
}

// ================================================================
// PARSE BULK NAMES
// ================================================================
function parseBulkNames(raw) {
  return raw.split(/[\n,]+/)
    .map(function(n){ return n.trim(); })
    .filter(function(n){ return n.length > 0; });
}

// ================================================================
// SESSION: ADD PLAYER
// ================================================================
function addPlayer() {
  var added = 0, skipped = 0;
  var existing = S.players.map(function(p){ return p.name.toLowerCase(); });

  if (SESSION_ENTRY_MODE === 'bulk') {
    var raw = $id('playerNameBulkInput').value;
    var names = parseBulkNames(raw);
    names.forEach(function(name) {
      if (!name) return;
      if (existing.indexOf(name.toLowerCase()) >= 0) { skipped++; return; }
      S.players.push({ name: name, skill: 'int', isActive: true });
      S.playCount[name] = { games: 0, wins: 0, losses: 0, lastGameIndex: -999 };
      existing.push(name.toLowerCase());
      added++;
    });
    $id('playerNameBulkInput').value = '';
  } else {
    var name = $id('playerNameInput').value.trim();
    if (!name) return;
    if (existing.indexOf(name.toLowerCase()) >= 0) {
      toast('⚠️ "' + esc(name) + '" is already in the list');
      return;
    }
    S.players.push({ name: name, skill: 'int', isActive: true });
    S.playCount[name] = { games: 0, wins: 0, losses: 0, lastGameIndex: -999 };
    $id('playerNameInput').value = '';
    added = 1;
  }

  if (added > 0 || skipped > 0) {
    var msg = added > 0 ? added + ' player' + (added > 1 ? 's' : '') + ' added' : '';
    if (skipped > 0) msg += (msg ? ', ' : '') + skipped + ' duplicate' + (skipped > 1 ? 's' : '') + ' skipped';
    toast('✅ ' + msg);
  }
  renderSessionPlayerList();
  saveState();
}

function renderSessionPlayerList() {
  var html = '';
  S.players.forEach(function(p, i) {
    if (!p.isActive) return;
    html += '<div class="player-setup-item">' +
      '<span class="player-setup-name">' + esc(p.name) + '</span>' +
      '<div class="skill-selector">' +
        ['beg','int','adv'].map(function(sk){
          return '<button class="skill-btn ' + sk + (p.skill===sk?' active':'') + '" ' +
            'onclick="act(\'setSkill\',[' + i + ',\'' + sk + '\'])">' + sk.toUpperCase() + '</button>';
        }).join('') +
      '</div>' +
      '<button class="remove-player-btn" onclick="act(\'removeSetupPlayer\',' + i + ')">✕</button>' +
    '</div>';
  });
  setHtml('sessionPlayerList', html || '<div style="color:var(--color-dimmed);font-size:13px;text-align:center;padding:8px">No players yet</div>');
}

// ================================================================
// SESSION: SKILL
// ================================================================
function setSkill(args) {
  var idx = args[0], sk = args[1];
  if (S.players[idx]) { S.players[idx].skill = sk; }
  renderSessionPlayerList();
  saveState();
}

function removeSetupPlayer(idx) {
  S.players.splice(idx, 1);
  renderSessionPlayerList();
  saveState();
}

// ================================================================
// SESSION: COURT COUNT
// ================================================================
function sCourtMinus() { if (S.courtCount > 1) { S.courtCount--; $id('courtCountDisplay').textContent = S.courtCount; saveState(); } }
function sCourtPlus()  { if (S.courtCount < 8) { S.courtCount++; $id('courtCountDisplay').textContent = S.courtCount; saveState(); } }

// ================================================================
// SESSION: START
// ================================================================
function startSession() {
  var active = S.players.filter(function(p){ return p.isActive; });
  if (active.length < 4) { toast('⚠️ Need at least 4 players to start'); return; }
  S.courts = [];
  for (var i = 0; i < S.courtCount; i++) {
    S.courts.push({ name: 'Court ' + (i+1), players: null, isActive: true, pendingWinner: false });
  }
  // Reset play counts
  S.players.forEach(function(p) {
    S.playCount[p.name] = S.playCount[p.name] || { games: 0, wins: 0, losses: 0, lastGameIndex: -999 };
  });
  S.started = true;
  S.gameIndex = 0;
  S.history = [];
  fillAllSessionCourts();
  show('bottomNav');
  hide('setupControls');
  show('sessionGame');
  renderSessionGame();
  saveState();
  toast('🏸 Session started!');
}

// ================================================================
// SESSION: PLAYER SELECTION
// ================================================================
function restingSessionPlayers() {
  var onCourt = [];
  S.courts.forEach(function(c) { if (c.players) onCourt = onCourt.concat(c.players); });
  return S.players.filter(function(p) {
    return p.isActive && onCourt.indexOf(p.name) < 0;
  });
}

function fillSessionCourt(courtIdx) {
  var court = S.courts[courtIdx];
  if (court.players) return; // already filled
  var resting = restingSessionPlayers();
  if (resting.length < 4) return;

  // Sort: least games first, then by wait time (lastGameIndex ascending)
  resting.sort(function(a, b) {
    var ga = S.playCount[a.name] ? S.playCount[a.name].games : 0;
    var gb = S.playCount[b.name] ? S.playCount[b.name].games : 0;
    if (ga !== gb) return ga - gb;
    var la = S.playCount[a.name] ? S.playCount[a.name].lastGameIndex : -999;
    var lb = S.playCount[b.name] ? S.playCount[b.name].lastGameIndex : -999;
    return la - lb;
  });

  // Pick top 4 respecting skill constraints
  var picked = skillBalance(resting);
  court.players = picked.map(function(p){ return p.name; });
}

function fillAllSessionCourts() {
  S.courts.forEach(function(c, i) { fillSessionCourt(i); });
}

function skillBalance(players) {
  // Grab up to 4 players; try to keep adv-adv separation
  var adv  = players.filter(function(p){ return p.skill === 'adv'; });
  var beg  = players.filter(function(p){ return p.skill === 'beg'; });
  var ints = players.filter(function(p){ return p.skill === 'int'; });
  var pool = players.slice(0, Math.min(players.length, 8));
  var chosen = pool.slice(0, 4);
  return chosen;
}

// ================================================================
// SESSION: RENDER GAME
// ================================================================
function renderSessionGame() {
  var courtsHtml = '';
  S.courts.forEach(function(court, i) {
    courtsHtml += renderSessionCourt(court, i);
  });
  setHtml('sessionCourts', courtsHtml);

  // Resting players
  var resting = restingSessionPlayers();
  var rHtml = resting.length === 0
    ? '<div style="color:var(--color-dimmed);font-size:13px">All players are on court</div>'
    : resting.map(function(p) {
        return '<div class="resting-chip">' +
          '<span class="skill-dot ' + p.skill + '"></span>' +
          esc(p.name) +
        '</div>';
      }).join('');
  setHtml('sessionRestingList', rHtml);
}

function renderSessionCourt(court, i) {
  if (!court.players) {
    return '<div class="court">' +
      '<div class="court-header"><span class="court-name">' + esc(court.name) + '</span>' +
      '<span style="color:var(--color-dimmed);font-size:13px">Waiting for players…</span></div></div>';
  }

  var teamA = [court.players[0], court.players[1]];
  var teamB = [court.players[2], court.players[3]];

  function pBox(name) {
    var pl = S.players.find(function(p){ return p.name === name; });
    var sk = pl ? pl.skill : 'int';
    return '<div class="player-box"><span class="skill-dot ' + sk + '"></span>' + esc(name) + '</div>';
  }

  var courtHtml = '<div class="court">' +
    '<div class="court-header"><span class="court-name">' + esc(court.name) + '</span></div>' +
    '<div class="badminton-court">' +
      '<div class="court-side side-a">' + teamA.map(pBox).join('') + '</div>' +
      '<div class="vs"><span>VS</span></div>' +
      '<div class="court-side side-b">' + teamB.map(pBox).join('') + '</div>' +
    '</div>';

  if (court.pendingWinner) {
    courtHtml += '<div class="winner-selection">' +
      '<div class="winner-label">Who won?</div>' +
      '<div class="winner-btns">' +
        '<button class="winner-btn" onclick="act(\'sessionWinner\',[' + i + ',\'A\'])">' + esc(teamA.join(' & ')) + '</button>' +
        '<button class="winner-btn" onclick="act(\'sessionWinner\',[' + i + ',\'B\'])">' + esc(teamB.join(' & ')) + '</button>' +
      '</div>' +
    '</div>';
  } else {
    courtHtml += '<div class="court-actions">' +
      '<button class="court-action-btn complete" onclick="act(\'sessionComplete\',' + i + ')">✓ Complete Game</button>' +
      '<button class="court-action-btn" onclick="act(\'sessionSwap\',' + i + ')">⇄ Swap</button>' +
      '<button class="court-action-btn" onclick="act(\'sessionEdit\',' + i + ')">✏️ Edit</button>' +
    '</div>';
  }

  courtHtml += '</div>';
  return courtHtml;
}

// ================================================================
// SESSION: COMPLETE GAME
// ================================================================
function sessionComplete(courtIdx) {
  var court = S.courts[courtIdx];
  if (!court || !court.players) return;
  court.pendingWinner = true;
  renderSessionGame();
  saveState();
}

function sessionWinner(args) {
  var courtIdx = args[0], side = args[1];
  var court = S.courts[courtIdx];
  if (!court || !court.players) return;

  var teamA = [court.players[0], court.players[1]];
  var teamB = [court.players[2], court.players[3]];
  var winners = side === 'A' ? teamA : teamB;
  var losers  = side === 'A' ? teamB : teamA;

  // Update play counts
  winners.forEach(function(name) {
    S.playCount[name] = S.playCount[name] || { games: 0, wins: 0, losses: 0, lastGameIndex: -999 };
    S.playCount[name].games++;
    S.playCount[name].wins++;
    S.playCount[name].lastGameIndex = S.gameIndex;
  });
  losers.forEach(function(name) {
    S.playCount[name] = S.playCount[name] || { games: 0, wins: 0, losses: 0, lastGameIndex: -999 };
    S.playCount[name].games++;
    S.playCount[name].losses++;
    S.playCount[name].lastGameIndex = S.gameIndex;
  });

  // History
  S.history.unshift({
    court: court.name,
    teamA: teamA,
    teamB: teamB,
    winner: side,
    time: new Date().toLocaleTimeString()
  });

  S.gameIndex++;
  court.players = null;
  court.pendingWinner = false;
  fillSessionCourt(courtIdx);
  renderSessionGame();
  saveState();
  toast('🏆 Game recorded!');
}

// ================================================================
// SESSION: SWAP (simple: show modal)
// ================================================================
function sessionSwap(courtIdx) {
  var court = S.courts[courtIdx];
  if (!court || !court.players) return;
  var resting = restingSessionPlayers();
  if (resting.length === 0) { toast('No resting players available for swap'); return; }

  var html = '<p style="color:var(--color-muted);font-size:13px;margin-bottom:12px">Select an on-court player to swap out:</p>';
  html += '<div class="manage-list">';
  court.players.forEach(function(name, idx) {
    html += '<div class="manage-player-row">' +
      '<span class="manage-player-name">' + esc(name) + '</span>' +
      '<button class="manage-btn" onclick="act(\'doSwapOut\',[' + courtIdx + ',' + idx + '])">Swap Out</button>' +
    '</div>';
  });
  html += '</div>';
  setHtml('manageModalBody', html);
  show('manageModal');
}

function doSwapOut(args) {
  var courtIdx = args[0], playerIdx = args[1];
  var court = S.courts[courtIdx];
  var outName = court.players[playerIdx];
  var resting = restingSessionPlayers();
  if (resting.length === 0) { toast('No resting players'); return; }

  var html = '<p style="color:var(--color-muted);font-size:13px;margin-bottom:12px">Replace <strong style="color:var(--color-text)">' + esc(outName) + '</strong> with:</p>';
  html += '<div class="manage-list">';
  resting.forEach(function(rp) {
    html += '<div class="manage-player-row">' +
      '<span class="manage-player-name">' + esc(rp.name) + '</span>' +
      '<button class="manage-btn success" onclick="act(\'doSwapIn\',[' + courtIdx + ',' + playerIdx + ',' + JSON.stringify(rp.name) + '])">Sub In</button>' +
    '</div>';
  });
  html += '</div>';
  setHtml('manageModalBody', html);
}

function doSwapIn(args) {
  var courtIdx = args[0], playerIdx = args[1], inName = args[2];
  S.courts[courtIdx].players[playerIdx] = inName;
  hide('manageModal');
  renderSessionGame();
  saveState();
  toast('✅ Player swapped');
}

// ================================================================
// SESSION: EDIT TEAMS (swap any two on-court players)
// ================================================================
function sessionEdit(courtIdx) {
  toast('💡 Tap Swap to replace a specific player');
  sessionSwap(courtIdx);
}

// ================================================================
// SESSION: UNDO
// ================================================================
function sessionUndo() {
  if (S.undoStack.length === 0) { toast('Nothing to undo'); return; }
  var prev = S.undoStack.pop();
  S.courts = prev.courts;
  S.playCount = prev.playCount;
  S.history = prev.history;
  S.gameIndex = prev.gameIndex;
  renderSessionGame();
  saveState();
  toast('↩️ Undone');
}

// ================================================================
// TOURNAMENT: ADD PLAYER
// ================================================================
function tAddPlayer() {
  var added = 0, skipped = 0;
  var existing = T.players.map(function(n){ return n.toLowerCase(); });

  if (TOURNAMENT_ENTRY_MODE === 'bulk') {
    var raw = $id('tPlayerNameBulkInput').value;
    var names = parseBulkNames(raw);
    names.forEach(function(name) {
      if (!name) return;
      if (existing.indexOf(name.toLowerCase()) >= 0) { skipped++; return; }
      T.players.push(name);
      existing.push(name.toLowerCase());
      added++;
    });
    $id('tPlayerNameBulkInput').value = '';
  } else {
    var name = $id('tPlayerNameInput').value.trim();
    if (!name) return;
    if (existing.indexOf(name.toLowerCase()) >= 0) {
      toast('⚠️ "' + esc(name) + '" already added');
      return;
    }
    T.players.push(name);
    $id('tPlayerNameInput').value = '';
    added = 1;
  }

  if (added > 0 || skipped > 0) {
    var msg = added > 0 ? added + ' player' + (added > 1 ? 's' : '') + ' added' : '';
    if (skipped > 0) msg += (msg ? ', ' : '') + skipped + ' duplicate' + (skipped > 1 ? 's' : '') + ' skipped';
    toast('✅ ' + msg);
  }
  renderTPlayerList();
  saveState();
}

function renderTPlayerList() {
  var html = T.players.map(function(name, i) {
    return '<div class="player-setup-item">' +
      '<span class="player-setup-name">' + esc(name) + '</span>' +
      '<button class="remove-player-btn" onclick="act(\'tRemovePlayer\',' + i + ')">✕</button>' +
    '</div>';
  }).join('');
  setHtml('tPlayerList', html || '<div style="color:var(--color-dimmed);font-size:13px;text-align:center;padding:8px">No players yet</div>');
  renderTTeamList();
}

function tRemovePlayer(idx) {
  T.players.splice(idx, 1);
  // Remove teams that had this player
  T.teams = T.teams.filter(function(tm) {
    return T.players.indexOf(tm.p1) >= 0 && T.players.indexOf(tm.p2) >= 0;
  });
  renderTPlayerList();
  saveState();
}

// ================================================================
// TOURNAMENT: TEAMS
// ================================================================
function renderTTeamList() {
  var html = T.teams.map(function(tm, i) {
    return '<div class="team-setup-item">' +
      '<span class="team-setup-name">' + esc(tm.name) + '</span>' +
      '<span class="team-setup-players">' + esc(tm.p1) + ' & ' + esc(tm.p2) + '</span>' +
      '<button class="remove-player-btn" onclick="act(\'tRemoveTeam\',' + i + ')">✕</button>' +
    '</div>';
  }).join('');
  setHtml('tTeamList', html || '<div style="color:var(--color-dimmed);font-size:13px;text-align:center;padding:8px">No teams yet — add players and auto-create or pair manually</div>');
}

function tRemoveTeam(idx) {
  T.teams.splice(idx, 1);
  renderTTeamList();
  saveState();
}

function tAutoTeams() {
  // Pair players sequentially in order of addition
  var unassigned = T.players.filter(function(name) {
    return !T.teams.some(function(tm){ return tm.p1 === name || tm.p2 === name; });
  });
  if (unassigned.length < 2) { toast('Need at least 2 unassigned players'); return; }
  var paired = 0;
  while (unassigned.length >= 2) {
    var p1 = unassigned.shift();
    var p2 = unassigned.shift();
    var tNum = T.teams.length + 1;
    T.teams.push({ name: 'Team ' + tNum, p1: p1, p2: p2 });
    paired++;
  }
  if (unassigned.length === 1) toast('ℹ️ ' + unassigned[0] + ' has no partner yet');
  renderTTeamList();
  saveState();
  toast('✅ ' + paired + ' team' + (paired > 1 ? 's' : '') + ' created');
}

// ================================================================
// TOURNAMENT: COURT COUNT
// ================================================================
function tCourtMinus() { if (T.courtCount > 1) { T.courtCount--; $id('tCourtCountDisplay').textContent = T.courtCount; saveState(); } }
function tCourtPlus()  { if (T.courtCount < 8) { T.courtCount++; $id('tCourtCountDisplay').textContent = T.courtCount; saveState(); } }

// ================================================================
// TOURNAMENT: START
// ================================================================
function buildRoundRobin(teams) {
  var schedule = [];
  for (var i = 0; i < teams.length; i++) {
    for (var j = i + 1; j < teams.length; j++) {
      schedule.push({ team1: i, team2: j });
    }
  }
  return schedule;
}

function startTournament() {
  if (T.teams.length < 2) { toast('⚠️ Need at least 2 teams to start'); return; }
  T.courts = [];
  for (var i = 0; i < T.courtCount; i++) {
    T.courts.push({ name: 'Court ' + (i+1) });
  }
  T.schedule = buildRoundRobin(T.teams);
  T.results = [];
  T.nextMatchIdx = 0;
  T.courtAssignments = {};
  T.started = true;

  // Assign first matches to courts
  for (var c = 0; c < T.courts.length && T.nextMatchIdx < T.schedule.length; c++) {
    T.courtAssignments[c] = T.nextMatchIdx++;
  }

  show('bottomNav');
  hide('tournamentSetupControls');
  show('tournamentGame');
  rTournamentCourts();
  renderTournamentQueue();
  saveState();
  toast('🏆 Tournament started!');
}

// ================================================================
// TOURNAMENT: RENDER COURTS
// ================================================================
function rTournamentCourts() {
  var html = '';
  T.courts.forEach(function(court, ci) {
    var matchIdx = T.courtAssignments[ci];
    if (matchIdx === undefined || matchIdx === null) {
      html += '<div class="court">' +
        '<div class="court-header"><span class="court-name">' + esc(court.name) + '</span>' +
        '<span style="color:var(--color-dimmed);font-size:13px">No match queued</span></div></div>';
      return;
    }
    var match = T.schedule[matchIdx];
    var tm1 = T.teams[match.team1];
    var tm2 = T.teams[match.team2];

    function pBox(name) {
      return '<div class="player-box">' + esc(name) + '</div>';
    }
    function teamSide(tm) {
      return '<div class="court-side">' +
        '<div style="font-size:11px;font-weight:700;color:var(--color-muted);text-transform:uppercase;margin-bottom:4px">' + esc(tm.name) + '</div>' +
        pBox(tm.p1) + pBox(tm.p2) +
      '</div>';
    }

    html += '<div class="court">' +
      '<div class="court-header"><span class="court-name">' + esc(court.name) + '</span>' +
      '<span style="color:var(--color-dimmed);font-size:12px">Match ' + (matchIdx+1) + ' of ' + T.schedule.length + '</span></div>' +
      '<div class="badminton-court">' +
        teamSide(tm1) +
        '<div class="vs"><span>VS</span></div>' +
        teamSide(tm2) +
      '</div>' +
      '<div class="winner-selection">' +
        '<div class="winner-label">Record Winner:</div>' +
        '<div class="winner-btns">' +
          '<button class="winner-btn" onclick="act(\'tRecordResult\',[' + ci + ',1])">' + esc(tm1.name) + '</button>' +
          '<button class="winner-btn" onclick="act(\'tRecordResult\',[' + ci + ',2])">' + esc(tm2.name) + '</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  });
  setHtml('tournamentCourts', html);
}

function renderTournamentQueue() {
  var remaining = [];
  for (var i = T.nextMatchIdx; i < T.schedule.length; i++) {
    // Check if already assigned to a court
    var assigned = false;
    Object.keys(T.courtAssignments).forEach(function(ci) {
      if (T.courtAssignments[ci] === i) assigned = true;
    });
    if (!assigned) remaining.push(i);
  }
  var html = remaining.length === 0
    ? '<div style="color:var(--color-dimmed);font-size:13px">All matches assigned or complete</div>'
    : remaining.map(function(idx) {
        var m = T.schedule[idx];
        return '<div class="match-queue-item">' +
          '<span class="match-idx">#' + (idx+1) + '</span>' +
          '<span>' + esc(T.teams[m.team1].name) + '</span>' +
          '<span style="color:var(--color-dimmed)">vs</span>' +
          '<span>' + esc(T.teams[m.team2].name) + '</span>' +
        '</div>';
      }).join('');
  setHtml('tournamentMatchQueue', html);
}

// ================================================================
// TOURNAMENT: RECORD RESULT
// ================================================================
function tRecordResult(args) {
  var courtIdx = args[0], winner = args[1];
  var matchIdx = T.courtAssignments[courtIdx];
  if (matchIdx === undefined || matchIdx === null) return;
  var match = T.schedule[matchIdx];

  T.results.push({ team1: match.team1, team2: match.team2, winner: winner });

  // Assign next unplayed match to this court
  var nextUnplayed = findNextUnplayedMatch();
  if (nextUnplayed !== null) {
    T.courtAssignments[courtIdx] = nextUnplayed;
    // Advance nextMatchIdx past this one if needed
    if (nextUnplayed >= T.nextMatchIdx) T.nextMatchIdx = nextUnplayed + 1;
  } else {
    delete T.courtAssignments[courtIdx];
  }

  rTournamentCourts();
  renderTournamentQueue();
  saveState();

  // Check if all matches done
  if (T.results.length >= T.schedule.length) {
    setTimeout(function() { showTournamentChampion(); }, 300);
  } else {
    toast('🏆 Match recorded!');
  }
}

function findNextUnplayedMatch() {
  var playedIndices = T.results.map(function(r, i) {
    // Find schedule index matching this result
    for (var s = 0; s < T.schedule.length; s++) {
      var m = T.schedule[s];
      if (m.team1 === r.team1 && m.team2 === r.team2) return s;
    }
    return -1;
  });
  var assignedIndices = Object.values ? Object.values(T.courtAssignments) : Object.keys(T.courtAssignments).map(function(k){ return T.courtAssignments[k]; });

  for (var i = 0; i < T.schedule.length; i++) {
    if (playedIndices.indexOf(i) < 0 && assignedIndices.indexOf(i) < 0) return i;
  }
  return null;
}

function showTournamentChampion() {
  var standings = getTournamentStandings();
  if (standings.length === 0) return;
  var champ = standings[0];
  toast('🎉 Champion: ' + champ.team.name + '! (' + champ.wins + 'W-' + champ.losses + 'L)', 5000);
  launchConfetti();
}

function getTournamentStandings() {
  var teamStats = T.teams.map(function(tm, i) {
    return { team: tm, idx: i, wins: 0, losses: 0, played: 0 };
  });
  T.results.forEach(function(r) {
    teamStats[r.team1].played++;
    teamStats[r.team2].played++;
    if (r.winner === 1) { teamStats[r.team1].wins++; teamStats[r.team2].losses++; }
    else                { teamStats[r.team2].wins++; teamStats[r.team1].losses++; }
  });
  teamStats.sort(function(a,b) {
    if (b.wins !== a.wins) return b.wins - a.wins;
    return a.losses - b.losses;
  });
  return teamStats;
}

// ================================================================
// PROMOTION: ADD PLAYER
// ================================================================
function pAddPlayer() {
  var added = 0, skipped = 0;
  var existing = Object.keys(P.players).map(function(n){ return n.toLowerCase(); });

  if (PROMOTION_ENTRY_MODE === 'bulk') {
    var raw = $id('pPlayerNameBulkInput').value;
    var names = parseBulkNames(raw);
    names.forEach(function(name) {
      if (!name) return;
      if (existing.indexOf(name.toLowerCase()) >= 0) { skipped++; return; }
      P.players[name] = { lane: 'seed', isActive: true, waitSince: 0 };
      P.playCount[name] = { games: 0, wins: 0, losses: 0, lanes: { seed: 0, winners: 0, losers: 0, custom: 0 } };
      existing.push(name.toLowerCase());
      added++;
    });
    $id('pPlayerNameBulkInput').value = '';
  } else {
    var name = $id('pPlayerNameInput').value.trim();
    if (!name) return;
    if (existing.indexOf(name.toLowerCase()) >= 0) {
      toast('⚠️ "' + esc(name) + '" already added');
      return;
    }
    P.players[name] = { lane: 'seed', isActive: true, waitSince: 0 };
    P.playCount[name] = { games: 0, wins: 0, losses: 0, lanes: { seed: 0, winners: 0, losers: 0, custom: 0 } };
    $id('pPlayerNameInput').value = '';
    added = 1;
  }

  if (added > 0 || skipped > 0) {
    var msg = added > 0 ? added + ' player' + (added > 1 ? 's' : '') + ' added' : '';
    if (skipped > 0) msg += (msg ? ', ' : '') + skipped + ' duplicate' + (skipped > 1 ? 's' : '') + ' skipped';
    toast('✅ ' + msg);
  }
  renderPPlayerList();
  saveState();
}

function renderPPlayerList() {
  var names = Object.keys(P.players);
  var html = names.map(function(name, i) {
    return '<div class="player-setup-item">' +
      '<span class="player-setup-name">' + esc(name) + '</span>' +
      '<button class="remove-player-btn" onclick="act(\'pRemoveSetup\',' + JSON.stringify(name) + ')">✕</button>' +
    '</div>';
  }).join('');
  setHtml('pPlayerList', html || '<div style="color:var(--color-dimmed);font-size:13px;text-align:center;padding:8px">No players yet</div>');
}

function pRemoveSetup(name) {
  delete P.players[name];
  delete P.playCount[name];
  renderPPlayerList();
  saveState();
}

// ================================================================
// PROMOTION: COURT COUNT
// ================================================================
function pCourtMinus() { if (P.courtCount > 1) { P.courtCount--; $id('pCourtCountDisplay').textContent = P.courtCount; saveState(); } }
function pCourtPlus()  { if (P.courtCount < 8) { P.courtCount++; $id('pCourtCountDisplay').textContent = P.courtCount; saveState(); } }

// ================================================================
// PROMOTION: PLAYER QUERIES
// ================================================================
function activePromotionPlayers() {
  return Object.keys(P.players).filter(function(n) { return P.players[n].isActive; });
}

function removedPromotionPlayers() {
  return Object.keys(P.players).filter(function(n) { return !P.players[n].isActive; });
}

function playersInLane(lane) {
  return activePromotionPlayers().filter(function(n) {
    return P.players[n].lane === lane;
  });
}

function waitingInLane(lane) {
  return playersInLane(lane).filter(function(n) {
    return P.players[n].lane !== 'oncourt';
  });
}

// ================================================================
// PROMOTION: START
// ================================================================
function startPromotion() {
  var active = activePromotionPlayers();
  if (active.length < 4) { toast('⚠️ Need at least 4 players to start'); return; }
  P.courts = [];
  for (var i = 0; i < P.courtCount; i++) {
    P.courts.push({ name: 'Court ' + (i+1), players: null, lane: 'seed', isActive: true });
  }
  P.gameIndex = 0;
  P.history = [];
  P.started = true;
  fillAllPromotionCourts();
  show('bottomNav');
  hide('promotionSetupControls');
  show('promotionGame');
  renderPromotionGame();
  saveState();
  toast('⬆️ Queue started!');
}

// ================================================================
// PROMOTION: FILL COURTS
// ================================================================
function fillPromotionCourt(courtIdx) {
  var court = P.courts[courtIdx];
  if (court.players) return; // already active

  // Try to fill from lanes in order: winners, losers, seed
  var lanes = ['winners', 'losers', 'seed'];
  for (var li = 0; li < lanes.length; li++) {
    var lane = lanes[li];
    var pool = waitingPool(lane);
    if (pool.length >= 4) {
      var chosen = pool.slice(0, 4);
      court.players = chosen.map(function(n){ return n; });
      court.lane = lane;
      chosen.forEach(function(n) { P.players[n].lane = 'oncourt'; });
      return;
    }
  }

  // Try seed if nothing else has 4
  var seedPool = waitingPool('seed');
  if (seedPool.length >= 4) {
    var chosen = seedPool.slice(0, 4);
    court.players = chosen;
    court.lane = 'seed';
    chosen.forEach(function(n) { P.players[n].lane = 'oncourt'; });
  }
}

function waitingPool(lane) {
  return activePromotionPlayers()
    .filter(function(n) { return P.players[n].lane === lane; })
    .sort(function(a, b) {
      var ga = P.playCount[a] ? P.playCount[a].games : 0;
      var gb = P.playCount[b] ? P.playCount[b].games : 0;
      if (ga !== gb) return ga - gb;
      var wa = P.players[a].waitSince || 0;
      var wb = P.players[b].waitSince || 0;
      return wa - wb;
    });
}

function fillAllPromotionCourts() {
  P.courts.forEach(function(c, i) { fillPromotionCourt(i); });
}

// ================================================================
// PROMOTION: RENDER GAME
// ================================================================
function renderPromotionGame() {
  var html = '';
  P.courts.forEach(function(court, i) {
    html += renderPromotionCourt(court, i);
  });
  setHtml('promotionCourts', html);

  // Lane pools
  ['seed','winners','losers'].forEach(function(lane) {
    var pool = activePromotionPlayers().filter(function(n){ return P.players[n].lane === lane; });
    var poolHtml = pool.length === 0
      ? '<div style="color:var(--color-dimmed);font-size:13px">Empty</div>'
      : pool.map(function(n) {
          return '<div class="resting-chip">' + esc(n) + '</div>';
        }).join('');
    setHtml(lane + 'PoolList', poolHtml);
  });
}

function renderPromotionCourt(court, i) {
  if (!court.players) {
    return '<div class="court">' +
      '<div class="court-header"><span class="court-name">' + esc(court.name) + '</span>' +
      '<span style="color:var(--color-dimmed);font-size:13px">Waiting for players…</span></div></div>';
  }
  var teamA = [court.players[0], court.players[1]];
  var teamB = [court.players[2], court.players[3]];
  var laneCls = court.lane || 'seed';
  var laneLabel = { seed: '🌱 Seed', winners: '🏆 Winners', losers: '💪 Losers', custom: '⭐ Custom' }[laneCls] || laneCls;

  function pBox(name) {
    return '<div class="player-box">' + esc(name) + '</div>';
  }

  return '<div class="court">' +
    '<div class="court-header"><span class="court-name">' + esc(court.name) + '</span>' +
    '<span class="court-lane-badge ' + laneCls + '">' + laneLabel + '</span></div>' +
    '<div class="badminton-court">' +
      '<div class="court-side side-a">' + teamA.map(pBox).join('') + '</div>' +
      '<div class="vs"><span>VS</span></div>' +
      '<div class="court-side side-b">' + teamB.map(pBox).join('') + '</div>' +
    '</div>' +
    '<div class="winner-selection">' +
      '<div class="winner-label">Who won?</div>' +
      '<div class="winner-btns">' +
        '<button class="winner-btn" onclick="act(\'pWinner\',[' + i + ',\'A\'])">' + esc(teamA.join(' & ')) + '</button>' +
        '<button class="winner-btn" onclick="act(\'pWinner\',[' + i + ',\'B\'])">' + esc(teamB.join(' & ')) + '</button>' +
      '</div>' +
    '</div>' +
  '</div>';
}

// ================================================================
// PROMOTION: RECORD WINNER
// ================================================================
function pWinner(args) {
  var courtIdx = args[0], side = args[1];
  var court = P.courts[courtIdx];
  if (!court || !court.players) return;

  var teamA = [court.players[0], court.players[1]];
  var teamB = [court.players[2], court.players[3]];
  var winners = side === 'A' ? teamA : teamB;
  var losers  = side === 'A' ? teamB : teamA;
  var lane    = court.lane || 'seed';

  winners.forEach(function(name) {
    P.playCount[name] = P.playCount[name] || { games:0, wins:0, losses:0, lanes:{seed:0,winners:0,losers:0,custom:0} };
    P.playCount[name].games++;
    P.playCount[name].wins++;
    P.playCount[name].lanes[lane] = (P.playCount[name].lanes[lane] || 0) + 1;
    // Promote: winners go to winners lane
    P.players[name].lane = 'winners';
    P.players[name].waitSince = P.gameIndex;
  });
  losers.forEach(function(name) {
    P.playCount[name] = P.playCount[name] || { games:0, wins:0, losses:0, lanes:{seed:0,winners:0,losers:0,custom:0} };
    P.playCount[name].games++;
    P.playCount[name].losses++;
    P.playCount[name].lanes[lane] = (P.playCount[name].lanes[lane] || 0) + 1;
    // Demote: losers go to losers lane (unless in seed already)
    P.players[name].lane = lane === 'seed' ? 'seed' : 'losers';
    P.players[name].waitSince = P.gameIndex;
  });

  P.history.unshift({ court: court.name, teamA: teamA, teamB: teamB, winner: side, lane: lane, time: new Date().toLocaleTimeString() });
  P.gameIndex++;
  court.players = null;
  court.lane = 'seed';
  fillPromotionCourt(courtIdx);
  renderPromotionGame();
  saveState();
  toast('🏆 Game recorded!');
}

// ================================================================
// PROMOTION: REMOVE PLAYER (pRem) — preserves stats
// ================================================================
function pRem(name) {
  if (!P.players[name]) return;
  // Remove from any court
  P.courts.forEach(function(court) {
    if (court.players) {
      var idx = court.players.indexOf(name);
      if (idx >= 0) {
        court.players.splice(idx, 1);
        // If court now has < 4, mark as needing refill
        if (court.players.length < 4) { court.players = null; }
      }
    }
  });
  P.players[name].isActive = false;
  // NOTE: P.playCount[name] is intentionally NOT deleted — stats are preserved
  fillAllPromotionCourts();
  renderPromotionGame();
  hide('manageModal');
  saveState();
  toast('🚫 ' + name + ' removed (stats preserved)');
}

function pReinstate(name) {
  if (!P.players[name]) return;
  P.players[name].isActive = true;
  P.players[name].lane = 'seed';
  P.players[name].waitSince = P.gameIndex;
  hide('manageModal');
  fillAllPromotionCourts();
  renderPromotionGame();
  saveState();
  toast('✅ ' + name + ' reinstated');
}

// ================================================================
// RENDER: PLAYER STATS  (rPS)
// ================================================================
function rPS() {
  var html = '';

  if (MODE === 'session') {
    // Session stats
    var players = S.players.slice().sort(function(a,b) {
      var wa = S.playCount[a.name] ? S.playCount[a.name].wins : 0;
      var wb = S.playCount[b.name] ? S.playCount[b.name].wins : 0;
      return wb - wa;
    });
    var activePl = players.filter(function(p){ return p.isActive; });
    var removedPl = players.filter(function(p){ return !p.isActive; });

    function sessionStatRow(p, removed) {
      var pc = S.playCount[p.name] || { games:0, wins:0, losses:0 };
      var pct = pc.games > 0 ? Math.round(pc.wins / pc.games * 100) : 0;
      return '<div class="stats-row">' +
        '<span class="stats-name' + (removed ? ' removed-name' : '') + '">' +
          '<span class="skill-dot ' + p.skill + '"></span>' + esc(p.name) +
        '</span>' +
        '<span class="stats-nums">' +
          '<span class="stats-win">' + pc.wins + 'W</span>' +
          '<span class="stats-loss">' + pc.losses + 'L</span>' +
          '<span>' + pct + '%</span>' +
          '<span style="color:var(--color-dimmed)">' + pc.games + 'G</span>' +
        '</span>' +
      '</div>';
    }

    html += '<div class="stats-list">';
    if (activePl.length > 0) {
      html += '<div class="stats-section-heading">Active Players</div>';
      html += activePl.map(function(p){ return sessionStatRow(p, false); }).join('');
    }
    if (removedPl.length > 0) {
      html += '<div class="stats-section-heading">Removed Players</div>';
      html += removedPl.map(function(p){ return sessionStatRow(p, true); }).join('');
    }
    if (activePl.length === 0 && removedPl.length === 0) {
      html = '<div style="color:var(--color-dimmed);text-align:center;padding:20px">No players yet</div>';
    }
    html += '</div>';

  } else if (MODE === 'tournament') {
    // Tournament standings
    var standings = getTournamentStandings();
    if (standings.length === 0) {
      html = '<div style="color:var(--color-dimmed);text-align:center;padding:20px">No matches played yet</div>';
    } else {
      html += '<div class="stats-list">';
      standings.forEach(function(s, i) {
        html += '<div class="stats-row">' +
          '<span style="color:var(--color-dimmed);font-weight:700;width:20px">' + (i+1) + '</span>' +
          '<span class="stats-name">' + esc(s.team.name) + '</span>' +
          '<span style="font-size:12px;color:var(--color-dimmed)">' + esc(s.team.p1) + ' & ' + esc(s.team.p2) + '</span>' +
          '<span class="stats-nums">' +
            '<span class="stats-win">' + s.wins + 'W</span>' +
            '<span class="stats-loss">' + s.losses + 'L</span>' +
            '<span>' + s.played + 'G</span>' +
          '</span>' +
        '</div>';
      });
      html += '</div>';
    }

  } else if (MODE === 'promotion') {
    // Promotion stats — styled rows with full breakdown
    var active  = activePromotionPlayers();
    var removed = removedPromotionPlayers();

    function laneLabel(lane) {
      return { seed:'Seed', winners:'Winners', losers:'Losers', oncourt:'On Court', custom:'Custom' }[lane] || lane;
    }
    function laneCls(lane) {
      return { seed:'seed', winners:'winners', losers:'losers', oncourt:'oncourt', custom:'custom' }[lane] || 'seed';
    }

    function promoStatRow(name, isRemoved) {
      var pc = P.playCount[name] || { games:0, wins:0, losses:0, lanes:{seed:0,winners:0,losers:0,custom:0} };
      var pct = pc.games > 0 ? Math.round(pc.wins / pc.games * 100) : 0;
      var lanes = pc.lanes || { seed:0, winners:0, losers:0, custom:0 };
      var lane = P.players[name] ? P.players[name].lane : 'removed';
      var badgeCls = isRemoved ? 'removed' : laneCls(lane);
      var badgeText = isRemoved ? 'Removed' : laneLabel(lane);

      return '<div class="promotion-stat-row">' +
        '<div class="promotion-stat-name">' +
          (isRemoved ? '<span class="removed-name">' + esc(name) + '</span>' : esc(name)) +
          '<span class="lane-badge ' + badgeCls + '">' + badgeText + '</span>' +
        '</div>' +
        '<div class="promotion-stat-nums">' +
          '<div><span class="stats-win">' + pc.wins + 'W</span>' +
          ' <span class="stats-loss">' + pc.losses + 'L</span>' +
          ' <span>' + pct + '%</span>' +
          ' <span style="color:var(--color-dimmed)">' + pc.games + 'G</span></div>' +
          '<div class="promotion-stat-detail">' +
            'Seed:' + (lanes.seed||0) +
            ' W:' + (lanes.winners||0) +
            ' L:' + (lanes.losers||0) +
            ' C:' + (lanes.custom||0) +
          '</div>' +
        '</div>' +
      '</div>';
    }

    if (active.length === 0 && removed.length === 0) {
      html = '<div style="color:var(--color-dimmed);text-align:center;padding:20px">No players yet</div>';
    } else {
      if (active.length > 0) {
        html += '<div class="promotion-stat-section-heading">Active Players</div>';
        // Sort by wins desc
        var sortedActive = active.slice().sort(function(a,b) {
          var wa = P.playCount[a] ? P.playCount[a].wins : 0;
          var wb = P.playCount[b] ? P.playCount[b].wins : 0;
          return wb - wa;
        });
        html += sortedActive.map(function(n){ return promoStatRow(n, false); }).join('');
      }
      if (removed.length > 0) {
        html += '<div class="promotion-stat-section-heading">Removed Players</div>';
        html += removed.map(function(n){ return promoStatRow(n, true); }).join('');
      }
    }
  }

  setHtml('statsModalBody', html);
}

// ================================================================
// RENDER: HISTORY
// ================================================================
function rHistory() {
  var history = MODE === 'session' ? S.history : (MODE === 'promotion' ? P.history : []);
  var html = '';
  if (MODE === 'tournament') {
    // Tournament history: completed matches
    if (T.results.length === 0) {
      html = '<div style="color:var(--color-dimmed);text-align:center;padding:20px">No completed matches</div>';
    } else {
      html = T.results.slice().reverse().map(function(r, i) {
        var tm1 = T.teams[r.team1];
        var tm2 = T.teams[r.team2];
        var winnerTeam = r.winner === 1 ? tm1 : tm2;
        return '<div class="history-item">' +
          '<div class="history-teams"><strong>' + esc(tm1.name) + '</strong> vs <strong>' + esc(tm2.name) + '</strong></div>' +
          '<div class="history-winner">🏆 ' + esc(winnerTeam.name) + ' won</div>' +
        '</div>';
      }).join('');
    }
  } else {
    if (history.length === 0) {
      html = '<div style="color:var(--color-dimmed);text-align:center;padding:20px">No completed games yet</div>';
    } else {
      html = history.map(function(h) {
        var winTeam = h.winner === 'A' ? h.teamA : h.teamB;
        return '<div class="history-item">' +
          '<div class="history-court">' + esc(h.court) + ' · ' + (h.time||'') + '</div>' +
          '<div class="history-teams">' + esc(h.teamA.join(' & ')) + ' <span style="color:var(--color-dimmed)">vs</span> ' + esc(h.teamB.join(' & ')) + '</div>' +
          '<div class="history-winner">🏆 ' + esc(winTeam.join(' & ')) + ' won</div>' +
        '</div>';
      }).join('');
    }
  }
  setHtml('historyModalBody', html);
}

// ================================================================
// RENDER: ABOUT  (rAbout)
// ================================================================
function rAbout() {
  var html = '<div class="about-content">' +
    '<div class="about-logo">🏸</div>' +
    '<div class="about-name">BlackSheep Shuffler</div>' +
    '<div class="about-ver"><span class="version-tag">v6.3.0</span></div>' +
    '<p class="about-desc">A smart badminton court management app designed for casual sessions, structured tournaments, and competitive queue-promotion play.</p>' +
    '<p class="about-desc">Features skill-balanced team generation, round-robin scheduling, and lane-based promotion for fair, fun gameplay at any group size.</p>' +
    '<p class="about-desc" style="font-size:12px;color:var(--color-dimmed)">Progress auto-saves to your device\'s local storage. No account required.</p>' +
  '</div>';
  setHtml('aboutModalBody', html);
}

// ================================================================
// RENDER: HELP  (rHelp) — full manual content, mode-aware
// ================================================================
function rHelp() {
  var html = '';

  if (MODE === 'session' || MODE === 'home') {
    html = '<div class="help-content">' +
      '<h4>🏸 Session Mode — User Manual</h4>' +

      '<h4>Getting Started</h4>' +
      '<ol>' +
        '<li>Add players using <code>Single</code> or <code>Bulk</code> entry mode.</li>' +
        '<li>Assign skill levels: <strong>Beg</strong> (orange), <strong>Int</strong> (blue), <strong>Adv</strong> (green).</li>' +
        '<li>Set the number of courts with the stepper.</li>' +
        '<li>Tap <code>▶ Start Session</code> — courts fill automatically.</li>' +
      '</ol>' +

      '<h4>Skill Levels</h4>' +
      '<ul>' +
        '<li><strong>Beginner</strong> — orange dot. Beginners cannot be paired with Advanced players.</li>' +
        '<li><strong>Intermediate</strong> — blue dot. Flexible; pairs with anyone.</li>' +
        '<li><strong>Advanced</strong> — green dot. Advanced players are always split across opposing teams.</li>' +
      '</ul>' +

      '<h4>During a Session</h4>' +
      '<ul>' +
        '<li>Tap <code>✓ Complete Game</code> on a court when the game ends, then select the winning team.</li>' +
        '<li>The court refills automatically from the resting pool.</li>' +
        '<li>Resting players queue by fairness: fewest total games first, then longest wait time.</li>' +
      '</ul>' +

      '<h4>Edit Teams / Swap Player</h4>' +
      '<ul>' +
        '<li><strong>Swap</strong> — replace one on-court player with a resting player without ending the game.</li>' +
        '<li><strong>Edit</strong> — opens the same swap interface to change the 4-player court composition.</li>' +
      '</ul>' +

      '<h4>Custom Game</h4>' +
      '<p>Schedule a specific 4-player match. Available from the Manage menu. Max 3 custom games queued at once.</p>' +

      '<h4>Manage Menu (⚙️)</h4>' +
      '<ul>' +
        '<li><strong>Add Player</strong> — add a player mid-session.</li>' +
        '<li><strong>Change Skill</strong> — update a player\'s skill level.</li>' +
        '<li><strong>Rename Player</strong> — change a player\'s name.</li>' +
        '<li><strong>Remove Player</strong> — removes from courts; stats are preserved.</li>' +
        '<li><strong>Reinstate Player</strong> — restore a removed player.</li>' +
        '<li><strong>Court Management</strong> — add, remove, or rename courts.</li>' +
        '<li><strong>Admin Mode</strong> — PIN-protected. Enables RVB restriction (blocks RVB-listed players from pairing with Beginners). First use sets the PIN.</li>' +
      '</ul>' +

      '<h4>Undo</h4>' +
      '<p>The Undo button in Manage reverts the last 2 game actions.</p>' +

      '<h4>Stats &amp; History</h4>' +
      '<ul>' +
        '<li><strong>Stats</strong> — shows W/L per player, sorted by wins. Removed players shown separately with preserved stats.</li>' +
        '<li><strong>History</strong> — all completed matches in reverse order.</li>' +
      '</ul>' +

      '<h4>Auto-save</h4>' +
      '<p>Progress saves automatically to your device\'s local storage. No account required.</p>' +
    '</div>';

  } else if (MODE === 'tournament') {
    html = '<div class="help-content">' +
      '<h4>🏆 Tournament Mode — User Manual</h4>' +

      '<h4>Getting Started</h4>' +
      '<ol>' +
        '<li>Add all players using <code>Single</code> or <code>Bulk</code> entry mode.</li>' +
        '<li>Create 2-player fixed teams — use <code>Auto-create Teams</code> or pair manually.</li>' +
        '<li>Set the court count.</li>' +
        '<li>Tap <code>▶ Start Tournament</code>.</li>' +
      '</ol>' +

      '<h4>Round Robin Format</h4>' +
      '<p>Every team plays every other team exactly once. The schedule is generated automatically. Courts are filled with the next scheduled match as soon as they free up.</p>' +

      '<h4>During the Tournament</h4>' +
      '<ul>' +
        '<li>Each court shows the current match-up.</li>' +
        '<li>Tap the winning team\'s button to record the result.</li>' +
        '<li>The next queued match fills that court automatically.</li>' +
      '</ul>' +

      '<h4>Standings</h4>' +
      '<p>Open <strong>Stats</strong> to see the live standings, sorted by wins then fewest losses.</p>' +

      '<h4>Champion</h4>' +
      '<p>When all matches are complete, the champion is announced automatically with a celebration.</p>' +

      '<h4>Courts</h4>' +
      '<p>You can have fewer courts than teams — the app queues matches and fills courts as they free up. The upcoming matches are shown in the <em>Upcoming Matches</em> list below the courts.</p>' +

      '<h4>Manage (⚙️)</h4>' +
      '<ul>' +
        '<li><strong>Undo</strong> — reverts the last recorded result.</li>' +
        '<li><strong>Reset Tournament</strong> — clears all results and restarts the schedule.</li>' +
      '</ul>' +
    '</div>';

  } else if (MODE === 'promotion') {
    html = '<div class="help-content">' +
      '<h4>⬆️ Queue / Promotion Mode — User Manual</h4>' +

      '<h4>Getting Started</h4>' +
      '<ol>' +
        '<li>Add players using <code>Single</code> or <code>Bulk</code> entry mode.</li>' +
        '<li>Set the number of courts.</li>' +
        '<li>Tap <code>▶ Start Queue</code>.</li>' +
      '</ol>' +

      '<h4>Lanes Explained</h4>' +
      '<ul>' +
        '<li><strong>Seed Lane</strong> 🌱 — the starting pool. All players begin here. Seed games run first.</li>' +
        '<li><strong>Winners Lane</strong> 🏆 — players who won their last game. Matched together for higher-level play.</li>' +
        '<li><strong>Losers Lane</strong> 💪 — players who lost. Matched together for recovery games.</li>' +
      '</ul>' +
      '<p>Teams reshuffle every game — there are no fixed partnerships.</p>' +

      '<h4>Game Flow</h4>' +
      '<ul>' +
        '<li>Courts prefer to fill with a full lane (4+ players waiting in the same lane).</li>' +
        '<li>After a game: winners move to <code>Winners Lane</code>, losers move to <code>Losers Lane</code> (or stay in Seed if the game was a seed game).</li>' +
        '<li>Each court shows its current lane in the badge at the top.</li>' +
      '</ul>' +

      '<h4>Fairness</h4>' +
      '<p>Within each lane, players with fewer total games are prioritised first, then by longest wait time.</p>' +

      '<h4>Edit Teams / Swap Player</h4>' +
      '<p>Same as Session Mode. Swap candidates must come from the same lane as the court being played.</p>' +

      '<h4>Custom Game</h4>' +
      '<p>Schedule a specific 4-player match (max 3 queued). All 4 players must be in a waiting pool. Available from the Manage menu.</p>' +

      '<h4>Manage Menu (⚙️)</h4>' +
      '<ul>' +
        '<li><strong>Add Player</strong> — add a player mid-queue.</li>' +
        '<li><strong>Rename Player</strong> — change a player\'s name.</li>' +
        '<li><strong>Remove Player</strong> — removes from the pool. Stats are preserved and shown in the Removed Players section of Stats.</li>' +
        '<li><strong>Reinstate Player</strong> — restore a removed player to the Seed lane.</li>' +
        '<li><strong>Court Management</strong> — add, remove, or rename courts.</li>' +
        '<li><strong>Game Actions</strong> — Undo last action / Reset Queue.</li>' +
      '</ul>' +

      '<h4>Stats</h4>' +
      '<ul>' +
        '<li>Shows W/L per player, win %, and lane breakdown (Seed / Winners / Losers / Custom games).</li>' +
        '<li>Current lane badge displayed next to each name.</li>' +
        '<li>Removed players shown separately with all stats preserved.</li>' +
      '</ul>' +
    '</div>';
  }

  setHtml('helpModalBody', html);
}

// ================================================================
// MANAGE MODAL
// ================================================================
function renderManageModal() {
  var html = '';

  if (MODE === 'session') {
    var active = S.players.filter(function(p){ return p.isActive; });
    var removed = S.players.filter(function(p){ return !p.isActive; });

    html += '<div class="manage-section-heading">Active Players</div>';
    html += '<div class="manage-list">';
    active.forEach(function(p) {
      html += '<div class="manage-player-row">' +
        '<span class="skill-dot ' + p.skill + '"></span>' +
        '<span class="manage-player-name">' + esc(p.name) + '</span>' +
        '<button class="manage-btn danger" onclick="act(\'manageRemoveSession\',' + JSON.stringify(p.name) + ')">Remove</button>' +
      '</div>';
    });
    html += '</div>';

    if (removed.length > 0) {
      html += '<div class="manage-section-heading">Removed Players</div>';
      html += '<div class="manage-list">';
      removed.forEach(function(p) {
        html += '<div class="manage-player-row">' +
          '<span class="manage-player-name removed-name">' + esc(p.name) + '</span>' +
          '<button class="manage-btn success" onclick="act(\'manageReinstateSession\',' + JSON.stringify(p.name) + ')">Reinstate</button>' +
        '</div>';
      });
      html += '</div>';
    }

    html += '<div class="manage-section-heading">Game Actions</div>';
    html += '<div class="manage-action-row">' +
      '<button class="btn-secondary" onclick="act(\'sessionUndo\')">↩️ Undo</button>' +
      '<button class="btn-danger" onclick="act(\'resetSession\')">🔄 Reset</button>' +
    '</div>';

  } else if (MODE === 'tournament') {
    html += '<div class="manage-section-heading">Tournament Actions</div>';
    html += '<div class="manage-action-row">' +
      '<button class="btn-danger" onclick="act(\'resetTournament\')">🔄 Reset Tournament</button>' +
    '</div>';

  } else if (MODE === 'promotion') {
    var activePl = activePromotionPlayers();
    var removedPl = removedPromotionPlayers();

    html += '<div class="manage-section-heading">Active Players</div>';
    html += '<div class="manage-list">';
    activePl.forEach(function(name) {
      var lane = P.players[name].lane;
      var laneLabel = { seed:'Seed', winners:'Winners', losers:'Losers', oncourt:'On Court' }[lane] || lane;
      html += '<div class="manage-player-row">' +
        '<span class="manage-player-name">' + esc(name) + '</span>' +
        '<span style="font-size:11px;color:var(--color-dimmed)">' + laneLabel + '</span>' +
        '<button class="manage-btn danger" onclick="act(\'pRem\',' + JSON.stringify(name) + ')">Remove</button>' +
      '</div>';
    });
    html += '</div>';

    if (removedPl.length > 0) {
      html += '<div class="manage-section-heading">Removed Players</div>';
      html += '<div class="manage-list">';
      removedPl.forEach(function(name) {
        html += '<div class="manage-player-row">' +
          '<span class="manage-player-name removed-name">' + esc(name) + '</span>' +
          '<button class="manage-btn success" onclick="act(\'pReinstate\',' + JSON.stringify(name) + ')">Reinstate</button>' +
        '</div>';
      });
      html += '</div>';
    }

    html += '<div class="manage-section-heading">Game Actions</div>';
    html += '<div class="manage-action-row">' +
      '<button class="btn-danger" onclick="act(\'resetPromotion\')">🔄 Reset Queue</button>' +
    '</div>';
  }

  setHtml('manageModalBody', html);
}

// ================================================================
// SESSION: MANAGE — REMOVE / REINSTATE
// ================================================================
function manageRemoveSession(name) {
  var player = S.players.find(function(p){ return p.name === name; });
  if (!player) return;
  player.isActive = false;
  // Remove from courts
  S.courts.forEach(function(court) {
    if (court.players) {
      var idx = court.players.indexOf(name);
      if (idx >= 0) { court.players = null; }
    }
  });
  fillAllSessionCourts();
  renderSessionGame();
  renderManageModal();
  saveState();
  toast('🚫 ' + name + ' removed (stats preserved)');
}

function manageReinstateSession(name) {
  var player = S.players.find(function(p){ return p.name === name; });
  if (!player) return;
  player.isActive = true;
  fillAllSessionCourts();
  renderSessionGame();
  renderManageModal();
  saveState();
  toast('✅ ' + name + ' reinstated');
}

// ================================================================
// RESET FUNCTIONS
// ================================================================
function resetSession() {
  if (!confirm('Reset the entire session? This cannot be undone.')) return;
  S.courts = [];
  S.history = [];
  S.gameIndex = 0;
  S.started = false;
  S.players.forEach(function(p){ p.isActive = true; });
  S.playCount = {};
  hide('sessionGame');
  show('setupControls');
  hide('manageModal');
  hide('bottomNav');
  saveState();
  toast('🔄 Session reset');
}

function resetTournament() {
  if (!confirm('Reset the tournament? This cannot be undone.')) return;
  T.results = [];
  T.nextMatchIdx = 0;
  T.courtAssignments = {};
  T.started = false;
  T.schedule = [];
  hide('tournamentGame');
  show('tournamentSetupControls');
  hide('manageModal');
  hide('bottomNav');
  saveState();
  toast('🔄 Tournament reset');
}

function resetPromotion() {
  if (!confirm('Reset the queue? This cannot be undone.')) return;
  P.courts = [];
  P.history = [];
  P.gameIndex = 0;
  P.started = false;
  Object.keys(P.players).forEach(function(n) {
    P.players[n].isActive = true;
    P.players[n].lane = 'seed';
    P.players[n].waitSince = 0;
  });
  hide('promotionGame');
  show('promotionSetupControls');
  hide('manageModal');
  hide('bottomNav');
  saveState();
  toast('🔄 Queue reset');
}

// ================================================================
// CONFETTI
// ================================================================
function launchConfetti() {
  var container = $id('confettiContainer');
  container.classList.remove('hidden');
  container.innerHTML = '';
  var colors = ['#f59e0b','#ef4444','#8b5cf6','#3b82f6','#22c55e','#ec4899'];
  for (var i = 0; i < 60; i++) {
    (function(idx) {
      var el = document.createElement('div');
      el.className = 'confetti-piece';
      el.style.left = Math.random() * 100 + 'vw';
      el.style.background = colors[Math.floor(Math.random() * colors.length)];
      el.style.width = (6 + Math.random() * 8) + 'px';
      el.style.height = el.style.width;
      el.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
      var dur = (1.5 + Math.random() * 2).toFixed(2);
      el.style.animationDuration = dur + 's';
      el.style.animationDelay = (Math.random() * 1).toFixed(2) + 's';
      container.appendChild(el);
    })(i);
  }
  setTimeout(function() { container.classList.add('hidden'); container.innerHTML = ''; }, 4000);
}

// ================================================================
// ACTION DISPATCHER
// ================================================================
var acts = {
  // Navigation
  'goHome':           function() { MODE = 'home'; showScreen('home'); saveState(); },
  'selectMode':       function(m) {
    MODE = m;
    showScreen(m);
    if (m === 'session') {
      if (S.started) { show('sessionGame'); hide('setupControls'); renderSessionGame(); show('bottomNav'); }
      else { show('setupControls'); hide('sessionGame'); renderSessionPlayerList(); }
    } else if (m === 'tournament') {
      if (T.started) { show('tournamentGame'); hide('tournamentSetupControls'); rTournamentCourts(); renderTournamentQueue(); show('bottomNav'); }
      else { show('tournamentSetupControls'); hide('tournamentGame'); renderTPlayerList(); }
    } else if (m === 'promotion') {
      if (P.started) { show('promotionGame'); hide('promotionSetupControls'); renderPromotionGame(); show('bottomNav'); }
      else { show('promotionSetupControls'); hide('promotionGame'); renderPPlayerList(); }
    }
    saveState();
  },

  // Session entry mode
  'setSessionSingle': function() { setPlayerEntryMode('single'); },
  'setSessionBulk':   function() { setPlayerEntryMode('bulk'); },

  // Tournament entry mode
  'setTournamentSingle': function() { setTournamentEntryMode('single'); },
  'setTournamentBulk':   function() { setTournamentEntryMode('bulk'); },

  // Promotion entry mode
  'setPromotionSingle': function() { setPromotionEntryMode('single'); },
  'setPromotionBulk':   function() { setPromotionEntryMode('bulk'); },

  // Session
  'addPlayer':           function() { addPlayer(); },
  'setSkill':            function(a) { setSkill(a); },
  'removeSetupPlayer':   function(i) { removeSetupPlayer(i); },
  'courtPlus':           function() { sCourtPlus(); },
  'courtMinus':          function() { sCourtMinus(); },
  'startSession':        function() { startSession(); },
  'sessionComplete':     function(i) { sessionComplete(i); },
  'sessionWinner':       function(a) { sessionWinner(a); },
  'sessionSwap':         function(i) { sessionSwap(i); },
  'sessionEdit':         function(i) { sessionEdit(i); },
  'doSwapOut':           function(a) { doSwapOut(a); },
  'doSwapIn':            function(a) { doSwapIn(a); },
  'sessionUndo':         function() { sessionUndo(); },
  'manageRemoveSession': function(n) { manageRemoveSession(n); },
  'manageReinstateSession': function(n) { manageReinstateSession(n); },
  'resetSession':        function() { resetSession(); },

  // Tournament
  'tAddPlayer':          function() { tAddPlayer(); },
  'tRemovePlayer':       function(i) { tRemovePlayer(i); },
  'tRemoveTeam':         function(i) { tRemoveTeam(i); },
  'tAutoTeams':          function() { tAutoTeams(); },
  'tCourtPlus':          function() { tCourtPlus(); },
  'tCourtMinus':         function() { tCourtMinus(); },
  'startTournament':     function() { startTournament(); },
  'tRecordResult':       function(a) { tRecordResult(a); },
  'resetTournament':     function() { resetTournament(); },

  // Promotion
  'pAddPlayer':          function() { pAddPlayer(); },
  'pRemoveSetup':        function(n) { pRemoveSetup(n); },
  'pCourtPlus':          function() { pCourtPlus(); },
  'pCourtMinus':         function() { pCourtMinus(); },
  'startPromotion':      function() { startPromotion(); },
  'pWinner':             function(a) { pWinner(a); },
  'pRem':                function(n) { pRem(n); },
  'pReinstate':          function(n) { pReinstate(n); },
  'resetPromotion':      function() { resetPromotion(); },

  // Modals — Stats
  'showStats':    function() { rPS(); show('statsModal'); },
  'closeStats':   function() { hide('statsModal'); },

  // Modals — History
  'showHistory':  function() { rHistory(); show('historyModal'); },
  'closeHistory': function() { hide('historyModal'); },

  // Modals — Help
  'showHelp':     function() { rHelp(); show('helpModal'); },
  'closeHelp':    function() { hide('helpModal'); },

  // Modals — About
  'showAbout':    function() { rAbout(); show('aboutModal'); },
  'closeAbout':   function() { hide('aboutModal'); },

  // Modals — Manage
  'showManage':    function() { renderManageModal(); show('manageModal'); },
  'closeManage':   function() { hide('manageModal'); },

  // Edit Teams modal
  'closeEditTeams': function() { hide('editTeamsModal'); },
  'saveEditTeams':  function() { hide('editTeamsModal'); }
};

function act(action, data) {
  if (acts[action]) {
    acts[action](data);
  } else {
    console.warn('[BSS] Unknown action:', action, data);
  }
}

// ================================================================
// STARTUP
// ================================================================
(function init() {
  loadState();

  // Restore court count displays
  if ($id('courtCountDisplay'))  $id('courtCountDisplay').textContent  = S.courtCount  || 1;
  if ($id('tCourtCountDisplay')) $id('tCourtCountDisplay').textContent = T.courtCount || 1;
  if ($id('pCourtCountDisplay')) $id('pCourtCountDisplay').textContent = P.courtCount || 1;

  // Set entry modes (restored from localStorage, or default 'single')
  setPlayerEntryMode(SESSION_ENTRY_MODE);
  setPromotionEntryMode(PROMOTION_ENTRY_MODE);
  setTournamentEntryMode(TOURNAMENT_ENTRY_MODE);

  // Navigate to saved mode
  if (MODE && MODE !== 'home') {
    act('selectMode', MODE);
  } else {
    MODE = 'home';
    showScreen('home');
  }
})();
