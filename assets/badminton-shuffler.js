document.addEventListener('DOMContentLoaded', function() {
  var BDS_CONFIG = window.bdsConfig || {};
  var W = document.getElementById('bds-app-wrapper');
  if (!W) return;

  var MAX_UNDO = 2;
  var MAX_CUSTOM_GAMES = 3;

  /* ── Admin State ───────────────────────────────────────── */
  var DEFAULT_RVB_LIST = [];
  var adminState = {
    rvbEnabled: true,
    rvbList: DEFAULT_RVB_LIST.slice(),
    adminPin: null
  };

  function saveAdmin() {
    localStorage.setItem('bdsAdminState', JSON.stringify({
      rvbEnabled: adminState.rvbEnabled,
      rvbList: adminState.rvbList,
      adminPin: adminState.adminPin
    }));
  }

  function loadAdmin() {
    var j = localStorage.getItem('bdsAdminState');
    if (j) {
      try {
        var p = JSON.parse(j);
        adminState.rvbEnabled = (p.rvbEnabled !== undefined) ? p.rvbEnabled : true;
        adminState.rvbList = Array.isArray(p.rvbList) ? p.rvbList : DEFAULT_RVB_LIST.slice();
        adminState.adminPin = (typeof p.adminPin === 'string' && p.adminPin.trim())
          ? p.adminPin
          : null;
      } catch(e) {}
    }
  }
  loadAdmin();

  /* ── Helpers ───────────────────────────────────────────── */
  function qs(s, p) { return (p || document).querySelector(s); }
  function qsa(s, p) { return (p || document).querySelectorAll(s); }

  function notify(m, t) {
    var e = qs('#notification');
    if (!e) return;
    e.textContent = m;
    e.className = 'notification ' + (t || 'success') + ' show';
    setTimeout(function() { e.classList.remove('show'); }, 2500);
  }

  function norm(n) { return (n || '').trim().toLowerCase(); }

  function shuf(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
  }

  function oModal(id, cb) {
    var m = qs('#' + id);
    if (m) { m.classList.add('is-open'); if (cb) cb(); }
  }

  function cModal(id) {
    var m = qs('#' + id);
    if (m) {
      m.classList.remove('is-open');
      if (id === 'managementModal') rMM();
      if (id === 'promotionManageModal') rPMM();
    }
  }

  function aTheme(t) {
    if (t === 'dark') { W.classList.add('dark-mode'); qs('#theme-checkbox').checked = true; }
    else { W.classList.remove('dark-mode'); qs('#theme-checkbox').checked = false; }
  }
  function lTheme() { aTheme(localStorage.getItem('theme') || 'light'); }

  if (qs('#theme-checkbox')) {
    qs('#theme-checkbox').addEventListener('change', function(e) {
      var t = e.target.checked ? 'dark' : 'light';
      localStorage.setItem('theme', t);
      aTheme(t);
    });
  }

  W.addEventListener('click', function(e) {
    if (e.target.classList.contains('modal-overlay')) cModal(e.target.id);
  });

  /* ── Confetti ──────────────────────────────────────────── */
  function fireConfetti(ms) {
    ms = ms || 2500;
    var w = document.createElement('div');
    w.className = 'confetti-wrap';
    var cols = ['#00ff66','#ffd166','#4cc9f0','#ff3b3b','#ffffff','#00cc55'];
    for (var i = 0; i < 90; i++) {
      var p = document.createElement('div');
      p.className = 'confetti-piece';
      p.style.left = Math.random() * 100 + '%';
      p.style.background = cols[Math.floor(Math.random() * cols.length)];
      p.style.animationDuration = (1.3 + Math.random() * 1.4) + 's';
      p.style.animationDelay = (Math.random() * 0.5) + 's';
      p.style.width = (6 + Math.random() * 6) + 'px';
      p.style.height = (10 + Math.random() * 12) + 'px';
      w.appendChild(p);
    }
    W.appendChild(w);
    setTimeout(function() { w.remove(); }, ms);
  }

  /* ── UI Utils ──────────────────────────────────────────── */
  var courtLines = '<div class="service-lines"></div><div class="tramline-top"></div><div class="tramline-bottom"></div><div class="short-service-left"></div><div class="short-service-right"></div><div class="court-net"></div>';

  function rES(ic, msg) {
    return '<div class="empty-state"><div class="icon">' + ic + '</div><p>' + msg + '</p></div>';
  }

  function popSel(el, opts, ph, cv) {
    if (!el) return;
    el.innerHTML = '';
    if (ph !== undefined) {
      var o0 = document.createElement('option'); o0.value = ''; o0.textContent = ph; el.appendChild(o0);
    }
    opts.forEach(function(opt) {
      var o = document.createElement('option');
      if (typeof opt === 'object' && opt.value !== undefined) { o.value = opt.value; o.textContent = opt.text !== undefined ? opt.text : opt.value; }
      else { o.value = opt; o.textContent = opt; }
      el.appendChild(o);
    });
    if (cv !== undefined && cv !== null && cv !== '') el.value = cv;
  }

  /* ── Mode & State ──────────────────────────────────────── */
  var MODE = null, PP = [], PR = [];
var PLAYER_ENTRY_MODE = 'single';
var PROMOTION_ENTRY_MODE = 'single';

  var S = {
    courts: [], courtNames: [], restingPlayers: [], playCount: {},
    matchHistory: [], teamPairings: {}, opponentPairings: {},
    allPlayersList: [], playerMeta: {}, gameInProgress: false,
    undoStack: [], completedGameCount: 0,
    tempCourts: []
  };


  var P = {
    gameInProgress: false,
    courts: [],
    courtNames: [],
    seedPool: [],
    winnersPool: [],
    losersPool: [],
    allPlayersList: [],
    playCount: {},
    playerState: {},
    matchHistory: [],
    teamPairings: {},
    opponentPairings: {},
    undoStack: [],
    completedGameCount: 0,
    tempCourts: []
  };

  /* ── Persistence ───────────────────────────────────────── */
  function save() {
    if (MODE === 'session' && S.gameInProgress) {
      localStorage.setItem('badmintonGameState', JSON.stringify(Object.assign({}, S, { undoStack: [] })));
      localStorage.setItem('bdsMode', 'session');
    }
    if (MODE === 'promotion' && P.gameInProgress) {
      localStorage.setItem('badmintonPromotionState', JSON.stringify(Object.assign({}, P, { undoStack: [] })));
      localStorage.setItem('bdsMode', 'promotion');
    }
  }

  function load() {
    var m = localStorage.getItem('bdsMode');
    if (m === 'session') {
      var j = localStorage.getItem('badmintonGameState');
      if (!j) return;
      try {
        var l = JSON.parse(j);
        if (l && l.gameInProgress) {
          if (!l.undoStack) l.undoStack = [];
          if (!l.playerMeta) {
            l.playerMeta = {};
            (l.allPlayersList || []).forEach(function(n) {
              var ln = norm(n);
              if (!l.playerMeta[ln]) l.playerMeta[ln] = { name: n, skill: 'Int', isActive: true };
            });
          }
          if (!l.courtNames || l.courtNames.length !== l.courts.length)
            l.courtNames = Array.from({ length: l.courts.length }, function(_, i) { return 'Court ' + (i + 1); });
          if (!l.tempCourts) {
            if (l.tempCourt && (l.tempCourt.pending || l.tempCourt.active)) {
              var tc0 = Object.assign({}, l.tempCourt);
              if (!tc0.id) tc0.id = Date.now() + 'r' + Math.random();
              l.tempCourts = [tc0];
            } else {
              l.tempCourts = [];
            }
            delete l.tempCourt;
          }
          if (!l.completedGameCount) l.completedGameCount = 0;
          MODE = 'session'; S = l;
          showAppAfterModeSelect();
          qs('#setupControls').classList.add('hidden');
          if (qs('#promotionSetupControls')) qs('#promotionSetupControls').classList.add('hidden');
          qs('#actionBar').classList.remove('hidden');
          rAll();
        }
      } catch(e) {
        console.error(e);
        localStorage.removeItem('badmintonGameState');
        localStorage.removeItem('bdsMode');
      }
    } else if (m === 'promotion') {
      var j3 = localStorage.getItem('badmintonPromotionState');
      if (!j3) return;
      try {
        var l3 = JSON.parse(j3);
        if (l3 && l3.gameInProgress) {
          if (!l3.undoStack) l3.undoStack = [];
          if (!l3.courtNames || l3.courtNames.length !== l3.courts.length)
            l3.courtNames = Array.from({ length: l3.courts.length }, function(_, i) { return 'Court ' + (i + 1); });
          if (!l3.tempCourts) l3.tempCourts = [];
          if (!l3.completedGameCount) l3.completedGameCount = 0;
          if (!l3.teamPairings) l3.teamPairings = {};
          if (!l3.opponentPairings) l3.opponentPairings = {};
          if (!l3.playerState) l3.playerState = {};
          MODE = 'promotion'; P = l3;
          showAppAfterModeSelect();
          qs('#setupControls').classList.add('hidden');
          if (qs('#promotionSetupControls')) qs('#promotionSetupControls').classList.add('hidden');
          qs('#actionBar').classList.remove('hidden');
          rAll();
        }
      } catch(e) {
        console.error(e);
        localStorage.removeItem('badmintonPromotionState');
        localStorage.removeItem('bdsMode');
      }
    }
  }

  function showModeSelect() {
    qs('#modeSelectCard').classList.remove('hidden');
    qs('#setupControls').classList.add('hidden');
    if (qs('#promotionSetupControls')) qs('#promotionSetupControls').classList.add('hidden');
    qs('#results').innerHTML = '';
    qs('#actionBar').classList.add('hidden');
  }
  function showAppAfterModeSelect() { qs('#modeSelectCard').classList.add('hidden'); }

  function backToModeSelect() {
    MODE = null;
    showModeSelect();
  }

  /* ── Undo UI ───────────────────────────────────────────── */
  function updateUndoUI() {
    var btn = qs('#undoBtn'), counter = qs('#undoCounter');
    var rem = 0;
    if (MODE === 'promotion') rem = P.undoStack.length;
    else rem = S.undoStack.length;

    if (btn && counter) {
      btn.disabled = rem === 0;
      counter.textContent = rem > 0 ? rem + ' undo' + (rem > 1 ? 's' : '') + ' remaining' : 'No actions to undo';
    }

    var pb = qs('#pUndoBtn'), pc2 = qs('#pUndoCounter');
    if (pb && pc2) {
      var r3 = P.undoStack.length;
      pb.disabled = r3 === 0;
      pc2.textContent = r3 > 0 ? r3 + ' undo' + (r3 > 1 ? 's' : '') + ' remaining' : 'No actions to undo';
    }
  }

  /* ── Command Pattern ───────────────────────────────────── */
  var cmdSession = {
    execute: function(c) {
      var b = JSON.parse(JSON.stringify(S));
      var ok = c.execute();
      if (ok) {
        S.undoStack.push(function() { S = b; });
        if (S.undoStack.length > MAX_UNDO) S.undoStack.shift();
      }
      rAll(); return ok;
    },
    undo: function() {
      if (S.undoStack.length > 0) { S.undoStack.pop()(); rAll(); notify('Last action has been undone.'); }
      else notify('Nothing to undo.', 'error');
    }
  };

  var cmdPromotion = {
    execute: function(c) {
      var b = JSON.parse(JSON.stringify(P));
      var ok = c.execute();
      if (ok) {
        P.undoStack.push(function() { P = b; });
        if (P.undoStack.length > MAX_UNDO) P.undoStack.shift();
      }
      rAll(); return ok;
    },
    undo: function() {
      if (P.undoStack.length > 0) { P.undoStack.pop()(); rAll(); notify('Last action has been undone.'); }
      else notify('Nothing to undo.', 'error');
    }
  };

  /* ── Player Helpers ────────────────────────────────────── */
  function gSkill(n) { var m = S.playerMeta[norm(n)]; return (m && m.skill) ? m.skill : 'Int'; }
  function iB(n) { return gSkill(n) === 'Beg'; }
  function iA(n) { return gSkill(n) === 'Adv'; }
  function iI(n) { return gSkill(n) === 'Int'; }
  function iR(n) { return adminState.rvbList.indexOf(norm(n)) !== -1; }
  function gCL(i) {
    if (MODE === 'promotion') return P.courtNames[i] || ('Court ' + (i + 1));
    return S.courtNames[i] || ('Court ' + (i + 1));
  }
  function pKey(a, b) { return [a, b].sort().join('|'); }

  function iTL(n) {
    return (S.tempCourts || []).some(function(tc) {
      return tc.pending && tc.players.some(function(p) { return norm(p) === norm(n); });
    });
  }
  function gERP() { return S.restingPlayers.filter(function(p) { return !iTL(p); }); }

  function pITL(n) {
    return (P.tempCourts || []).some(function(tc) {
      return tc.pending && tc.players.some(function(p) { return norm(p) === norm(n); });
    });
  }

  function getPlayerWinRate(n) {
    var pc = S.playCount[n];
    if (!pc || !pc.games) return 0;
    return pc.wins / pc.games;
  }

  function getCurrentWinStreak(n) {
    if (!n || !S.matchHistory || !S.matchHistory.length) return 0;
    var streak = 0;
    for (var i = S.matchHistory.length - 1; i >= 0; i--) {
      var m = S.matchHistory[i];
      var team = null;
      if (m.teamA && m.teamA.indexOf(n) !== -1) team = 'A';
      else if (m.teamB && m.teamB.indexOf(n) !== -1) team = 'B';
      else continue;

      if (m.winner === team) streak++;
      else break;
    }
    return streak;
  }

  function hasHotStreak(n) {
    return getCurrentWinStreak(n) >= 3;
  }

  function bombIcon(n) {
    if (!hasHotStreak(n)) return '';
    return '' +
      '<span class="streak-bomb" title="Win streak: ' + getCurrentWinStreak(n) + '">' +
        '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">' +
          '<rect x="7" y="1" width="2" height="1" fill="#fff3b0"/>' +
          '<rect x="6" y="2" width="4" height="1" fill="#ffd166"/>' +
          '<rect x="5" y="3" width="6" height="1" fill="#ff9f1c"/>' +
          '<rect x="4" y="4" width="8" height="1" fill="#ff6b00"/>' +
          '<rect x="5" y="5" width="6" height="1" fill="#ff3b30"/>' +
          '<rect x="4" y="6" width="8" height="1" fill="#ff6b00"/>' +
          '<rect x="3" y="7" width="10" height="1" fill="#ff9f1c"/>' +
          '<rect x="4" y="8" width="8" height="1" fill="#ff6b00"/>' +
          '<rect x="5" y="9" width="6" height="1" fill="#ff3b30"/>' +
          '<rect x="6" y="10" width="4" height="1" fill="#ffd166"/>' +
          '<rect x="7" y="11" width="2" height="1" fill="#fff3b0"/>' +
        '</svg>' +
      '</span>';
  }

  function pDot(n) { return '<span class="skill-dot skill-' + gSkill(n) + '"></span>'; }
  function pLbl(n) { return '<span class="player-skill">' + gSkill(n) + '</span>' + bombIcon(n); }

  function pLaneLabel(track) {
    if (track === 'winners') return 'Winners Lane';
    if (track === 'losers') return 'Losers Lane';
    if (track === 'custom') return 'Custom Game';
    return 'Seed Match';
  }

  /* ── Mgmt Panel ────────────────────────────────────────── */
  function rMM() {
    qs('#mgmtMenuGrid').style.display = '';
    qsa('.mgmt-sub-panel').forEach(function(p) { p.classList.remove('active'); });
    delete qs('#managementModal').dataset.editingCourt;
    delete qs('#managementModal').dataset.openedFromCourt;
  }
  function showMgmtPanel(id) {
    qs('#mgmtMenuGrid').style.display = 'none';
    qsa('.mgmt-sub-panel').forEach(function(p) { p.classList.remove('active'); });
    var p = qs('#mgmt-' + id);
    if (p) p.classList.add('active');
  }

  function rPMM() {
    var grid = qs('#pmgmtMenuGrid');
    if (grid) grid.style.display = '';
    var panels = qsa('.mgmt-sub-panel', qs('#promotionManageModal'));
    Array.prototype.forEach.call(panels, function(p) { p.classList.remove('active'); });
    var m = qs('#promotionManageModal');
    if (m) {
      delete m.dataset.editingCourt;
      delete m.dataset.openedFromCourt;
    }
  }
  function showPMgmtPanel(id) {
    var grid = qs('#pmgmtMenuGrid');
    if (grid) grid.style.display = 'none';
    var panels = qsa('.mgmt-sub-panel', qs('#promotionManageModal'));
    Array.prototype.forEach.call(panels, function(p) { p.classList.remove('active'); });
    var p = qs('#pmgmt-' + id);
    if (p) p.classList.add('active');
  }

  /* ── Admin Mode ────────────────────────────────────────── */
  function openAdminMode() {
  // First-time setup (no PIN set yet)
  if (!adminState.adminPin) {
    var first = prompt('Set a new Admin PIN:');
    if (first === null) return;
    first = first.trim();

    if (!first) {
      notify('PIN cannot be empty.', 'error');
      return;
    }

    var confirmPin = prompt('Confirm new Admin PIN:');
    if (confirmPin === null) return;
    confirmPin = confirmPin.trim();

    if (first !== confirmPin) {
      notify('PINs do not match.', 'error');
      return;
    }

    adminState.adminPin = first;
    saveAdmin();
    notify('Admin PIN created.');
    showAdminPanel();
    return;
  }

  // Normal unlock flow
  var pin = prompt('Enter Admin PIN:');
  if (pin === null) return;

  if (pin.trim() === adminState.adminPin) {
    notify('Admin Mode unlocked.');
    showAdminPanel();
  } else {
    notify('Incorrect PIN.', 'error');
  }
}
  function showAdminPanel() {
    qs('#mgmtMenuGrid').style.display = 'none';
    qsa('.mgmt-sub-panel').forEach(function(p) { p.classList.remove('active'); });
    qs('#mgmt-adminMode').classList.add('active');
    qs('#rvbToggle').checked = adminState.rvbEnabled;
    rRvbList();
  }

  function rRvbList() {
    var el = qs('#rvbPlayerList');
    if (!el) return;
    el.innerHTML = '';
    if (!adminState.rvbList.length) {
      el.innerHTML = rES('📋', 'No players in RVB list.');
      return;
    }
    adminState.rvbList.forEach(function(name) {
      var r = document.createElement('div');
      r.className = 'pending-item';
      r.innerHTML = '<div class="meta">' + name + '</div><button class="remove-btn" data-rvb-remove="' + name + '">Remove</button>';
      el.appendChild(r);
    });
  }

  if (qs('#rvbToggle')) {
    qs('#rvbToggle').addEventListener('change', function(e) {
      adminState.rvbEnabled = e.target.checked;
      saveAdmin();
      notify('RVB restriction ' + (adminState.rvbEnabled ? 'enabled' : 'disabled') + '.');
    });
  }

  if (qs('#rvbAddBtn')) {
    qs('#rvbAddBtn').addEventListener('click', function() {
      var val = (qs('#rvbAddInput').value || '').trim();
      if (!val) { notify('Enter a name.', 'error'); return; }
      var ln = norm(val);
      if (adminState.rvbList.indexOf(ln) !== -1) { notify('Already in RVB list.', 'error'); return; }
      adminState.rvbList.push(ln);
      qs('#rvbAddInput').value = '';
      saveAdmin();
      notify(val + ' added to RVB list.');
      rRvbList();
    });
  }

  if (qs('#rvbPlayerList')) {
    qs('#rvbPlayerList').addEventListener('click', function(e) {
      var btn = e.target.closest('button[data-rvb-remove]');
      if (!btn) return;
      var name = btn.dataset.rvbRemove;
      adminState.rvbList = adminState.rvbList.filter(function(x) { return x !== name; });
      saveAdmin();
      notify(name + ' removed from RVB list.');
      rRvbList();
    });
  }

  /* ── Pairing Tracking ──────────────────────────────────── */
  function initP(ps) {
    S.teamPairings = {}; S.opponentPairings = {};
    for (var i = 0; i < ps.length; i++) {
      for (var j = i + 1; j < ps.length; j++) {
        var k = pKey(ps[i], ps[j]);
        S.teamPairings[k] = 0; S.opponentPairings[k] = 0;
      }
    }
  }

  function initPP(ps) {
    P.teamPairings = {}; P.opponentPairings = {};
    for (var i = 0; i < ps.length; i++) {
      for (var j = i + 1; j < ps.length; j++) {
        var k = pKey(ps[i], ps[j]);
        P.teamPairings[k] = 0; P.opponentPairings[k] = 0;
      }
    }
  }

  function uPNP(np) {
    var ap = S.allPlayersList;
    for (var ni = 0; ni < np.length; ni++) {
      for (var ei = 0; ei < ap.length; ei++) {
        if (np[ni] === ap[ei]) continue;
        var k = pKey(np[ni], ap[ei]);
        if (!(k in S.teamPairings)) S.teamPairings[k] = 0;
        if (!(k in S.opponentPairings)) S.opponentPairings[k] = 0;
      }
    }
  }

  function uPNPP(np) {
    var ap = P.allPlayersList;
    for (var ni = 0; ni < np.length; ni++) {
      for (var ei = 0; ei < ap.length; ei++) {
        if (np[ni] === ap[ei]) continue;
        var k = pKey(np[ni], ap[ei]);
        if (!(k in P.teamPairings)) P.teamPairings[k] = 0;
        if (!(k in P.opponentPairings)) P.opponentPairings[k] = 0;
      }
    }
  }

  function uPS(tA, tB, inc) {
    if (inc === undefined) inc = 1;
    if (!tA || tA.length < 2 || !tB || tB.length < 2) return;
    var kAA = pKey(tA[0], tA[1]); S.teamPairings[kAA] = (S.teamPairings[kAA] || 0) + inc;
    var kBB = pKey(tB[0], tB[1]); S.teamPairings[kBB] = (S.teamPairings[kBB] || 0) + inc;
    tA.forEach(function(p1) { tB.forEach(function(p2) { var k = pKey(p1, p2); S.opponentPairings[k] = (S.opponentPairings[k] || 0) + inc; }); });
  }

  function uPSP(tA, tB, inc) {
    if (inc === undefined) inc = 1;
    if (!tA || tA.length < 2 || !tB || tB.length < 2) return;
    var kAA = pKey(tA[0], tA[1]); P.teamPairings[kAA] = (P.teamPairings[kAA] || 0) + inc;
    var kBB = pKey(tB[0], tB[1]); P.teamPairings[kBB] = (P.teamPairings[kBB] || 0) + inc;
    tA.forEach(function(p1) { tB.forEach(function(p2) { var k = pKey(p1, p2); P.opponentPairings[k] = (P.opponentPairings[k] || 0) + inc; }); });
  }

  function rebuildP() {
    initP(S.allPlayersList);
    S.matchHistory.forEach(function(m) { uPS(m.teamA, m.teamB, 1); });
    S.courts.forEach(function(c) { if (c.players && c.players.length === 4) uPS(c.teamA, c.teamB, 1); });
  }

  function rebuildPP() {
    initPP(P.allPlayersList);
    P.matchHistory.forEach(function(m) { uPSP(m.teamA, m.teamB, 1); });
    P.courts.forEach(function(c) { if (c.players && c.players.length === 4) uPSP(c.teamA, c.teamB, 1); });
  }
  /* ── Matchmaking ───────────────────────────────────────── */
  function getComb(a, sz) {
    var result = [];
    function f(px, ar) {
      if (px.length === sz) { result.push(px); return; }
      for (var i = 0; i < ar.length; i++) f(px.concat(ar[i]), ar.slice(i + 1));
    }
    f([], a); return result;
  }

  function gVC1(g) { return g.some(iB) && g.some(iA); }
  function gVC2(g) { return adminState.rvbEnabled && g.some(iB) && g.some(iR); }

  function valCT(tA, tB) {
    var g = tA.concat(tB);
    if (g.some(iB) && g.some(iA)) return { ok: false, msg: 'Invalid combination.' };
    if (adminState.rvbEnabled && g.some(iB) && g.some(iR)) return { ok: false, msg: 'Invalid combination.' };
    var adv = g.filter(iA);
    if (adv.length === 2) {
      var a1 = adv[0], a2 = adv[1];
      if ((tA.indexOf(a1) !== -1 ? 'A' : 'B') === (tA.indexOf(a2) !== -1 ? 'A' : 'B')) return { ok: false, msg: 'Invalid combination.' };
    }
    var int2 = g.filter(iI), beg2 = g.filter(iB);
    if (int2.length === 2 && beg2.length === 2) {
      var i1 = int2[0], i2 = int2[1];
      if ((tA.indexOf(i1) !== -1 ? 'A' : 'B') === (tA.indexOf(i2) !== -1 ? 'A' : 'B')) return { ok: false, msg: 'Intermediates must be split across teams when playing with Beginners.' };
    }
    return { ok: true, msg: '' };
  }

  function findBG(cands) {
    if (cands.length < 4) return null;
    var combos = getComb(cands, 4);
    var best = null, bs = Infinity;
    for (var ci2 = 0; ci2 < combos.length; ci2++) {
      var g = combos[ci2];
      if (gVC1(g) || gVC2(g)) continue;
      var ac = g.filter(iA).length, ip = g.filter(iI), bp2 = g.filter(iB);
      var sp = [
        [[g[0], g[1]], [g[2], g[3]]],
        [[g[0], g[2]], [g[1], g[3]]],
        [[g[0], g[3]], [g[1], g[2]]]
      ];
      for (var si = 0; si < sp.length; si++) {
        var tA2 = sp[si][0], tB2 = sp[si][1];
        if (ac === 2) {
          var av2 = g.filter(iA);
          if ((tA2.indexOf(av2[0]) !== -1 ? 'A' : 'B') === (tA2.indexOf(av2[1]) !== -1 ? 'A' : 'B')) continue;
        }
        if (ip.length === 2 && bp2.length === 2) {
          if ((tA2.indexOf(ip[0]) !== -1 ? 'A' : 'B') === (tA2.indexOf(ip[1]) !== -1 ? 'A' : 'B')) continue;
        }
        var sc = (S.teamPairings[pKey(tA2[0], tA2[1])] || 0) + (S.teamPairings[pKey(tB2[0], tB2[1])] || 0);
        tA2.forEach(function(p1) {
          tB2.forEach(function(p2) {
            sc += (S.opponentPairings[pKey(p1, p2)] || 0);
          });
        });

        var teamAWinRate = (getPlayerWinRate(tA2[0]) + getPlayerWinRate(tA2[1])) / 2;
        var teamBWinRate = (getPlayerWinRate(tB2[0]) + getPlayerWinRate(tB2[1])) / 2;
        var stackingPenalty = Math.abs(teamAWinRate - teamBWinRate) * 3;
        sc += stackingPenalty;

        if (sc < bs) { bs = sc; best = { players: g, teamA: tA2, teamB: tB2 }; }
      }
    }
    return best;
  }

  function pFindBG(cands) {
    if (cands.length < 4) return null;
    var combos = getComb(cands, 4);
    var best = null, bs = Infinity;
    for (var ci2 = 0; ci2 < combos.length; ci2++) {
      var g = combos[ci2];
      var sp = [
        [[g[0], g[1]], [g[2], g[3]]],
        [[g[0], g[2]], [g[1], g[3]]],
        [[g[0], g[3]], [g[1], g[2]]]
      ];
      for (var si = 0; si < sp.length; si++) {
        var tA2 = sp[si][0], tB2 = sp[si][1];
        var sc = (P.teamPairings[pKey(tA2[0], tA2[1])] || 0) + (P.teamPairings[pKey(tB2[0], tB2[1])] || 0);
        tA2.forEach(function(p1) {
          tB2.forEach(function(p2) {
            sc += (P.opponentPairings[pKey(p1, p2)] || 0);
          });
        });
        if (sc < bs) { bs = sc; best = { players: g, teamA: tA2, teamB: tB2 }; }
      }
    }
    return best;
  }

  /* ── Custom Games (Session tempCourts[]) ───────────────── */
  function finTemp(ci) {
    var c = S.courts[ci];
    if (!c || !c.isTemp) return;
    S.tempCourts = (S.tempCourts || []).filter(function(tc) { return tc.id !== c.tempId; });
    S.courts[ci] = { players: [], teamA: [], teamB: [], startTime: null };
    notify('Custom game completed. Regular court restored.');
  }

  function hTCA(ci) {
    var tcs = S.tempCourts || [];
    for (var ti = 0; ti < tcs.length; ti++) {
      var tc = tcs[ti];
      if (!tc.pending) continue;
      if (S.completedGameCount < tc.readyAtGameCount) continue;
      var allResting = tc.players.every(function(p) { return S.restingPlayers.indexOf(p) !== -1; });
      if (!allResting) continue;
      tc.pending = false;
      tc.active = true;
      var co = {
        players: tc.players.slice(),
        teamA: [tc.players[0], tc.players[1]],
        teamB: [tc.players[2], tc.players[3]],
        startTime: new Date().toISOString(),
        isTemp: true,
        tempId: tc.id
      };
      S.courts[ci] = co;
      uPS(co.teamA, co.teamB, 1);
      S.restingPlayers = S.restingPlayers.filter(function(p) { return tc.players.indexOf(p) === -1; });
      notify('Custom game is now active!');
      return;
    }
  }

  function refill() {
    var av = S.restingPlayers.slice();
    var ec = [];
    S.courts.forEach(function(c, i) { if (!c.players || c.players.length === 0) ec.push(i); });
    for (var eci = 0; eci < ec.length; eci++) {
      var ci = ec[eci];
      if (av.length < 4) break;
      var pq = av.filter(function(p) { return !iTL(p); });
      pq.sort(function(a, b) { return ((S.playCount[a] && S.playCount[a].lastGameEndTime) || 0) - ((S.playCount[b] && S.playCount[b].lastGameEndTime) || 0); });
      if (pq.length < 4) break;
      var placed = false;
      var sizes = [8, 12, 16];
      for (var si2 = 0; si2 < sizes.length; si2++) {
        var bg = findBG(pq.slice(0, sizes[si2]));
        if (bg) {
          S.courts[ci] = { players: bg.players, teamA: bg.teamA, teamB: bg.teamB, startTime: new Date().toISOString() };
          uPS(bg.teamA, bg.teamB, 1);
          av = av.filter(function(p) { return bg.players.indexOf(p) === -1; });
          placed = true;
          break;
        }
      }
      if (!placed) { notify('No compatible match for ' + gCL(ci) + ' yet.', 'error'); break; }
    }
    S.restingPlayers = av;
  }

  /* ── Promotion Helpers ─────────────────────────────────── */
  function pWaitingPool() {
    return P.seedPool.concat(P.winnersPool).concat(P.losersPool);
  }

  function pRemoveFromAllPools(name) {
    P.seedPool = P.seedPool.filter(function(p) { return p !== name; });
    P.winnersPool = P.winnersPool.filter(function(p) { return p !== name; });
    P.losersPool = P.losersPool.filter(function(p) { return p !== name; });
  }

  function pCourtHasPlayer(name) {
    return P.courts.some(function(c) { return c.players && c.players.indexOf(name) !== -1; });
  }

  function pEligibleWaitingPlayers() {
    return pWaitingPool().filter(function(p) { return !pITL(p); });
  }

  function pTakeFourFromPool(poolName) {
    var src = P[poolName];
    var candidates = src.filter(function(p) {
      return P.playCount[p] && P.playCount[p].isActive && !pCourtHasPlayer(p) && !pITL(p);
    });
    if (candidates.length < 4) return null;
    candidates.sort(function(a, b) {
      var ga = (P.playCount[a] && P.playCount[a].games) || 0;
      var gb = (P.playCount[b] && P.playCount[b].games) || 0;
      if (ga !== gb) return ga - gb;
      return ((P.playCount[a] && P.playCount[a].lastGameEndTime) || 0) - ((P.playCount[b] && P.playCount[b].lastGameEndTime) || 0);
    });
    return candidates.slice(0, 4);
  }

  function pRemoveSelectedFromPool(poolName, players) {
    players.forEach(function(p) {
      var idx = P[poolName].indexOf(p);
      if (idx !== -1) P[poolName].splice(idx, 1);
    });
  }

  function pActivateTempCourt(ci) {
    var tcs = P.tempCourts || [];
    for (var ti = 0; ti < tcs.length; ti++) {
      var tc = tcs[ti];
      if (!tc.pending) continue;
      if (P.completedGameCount < tc.readyAtGameCount) continue;

      var waiting = pWaitingPool();
      var allReady = tc.players.every(function(p) {
        return waiting.indexOf(p) !== -1 && !pCourtHasPlayer(p);
      });
      if (!allReady) continue;

      tc.pending = false;
      tc.active = true;

      tc.players.forEach(function(p) { pRemoveFromAllPools(p); });

      var co = {
        players: tc.players.slice(),
        teamA: [tc.players[0], tc.players[1]],
        teamB: [tc.players[2], tc.players[3]],
        startTime: new Date().toISOString(),
        isTemp: true,
        tempId: tc.id,
        track: 'custom'
      };
      P.courts[ci] = co;
      uPSP(co.teamA, co.teamB, 1);
      tc.players.forEach(function(p) {
        if (P.playerState[p]) P.playerState[p].lane = 'oncourt';
      });
      notify('Custom game is now active!');
      return true;
    }
    return false;
  }

  function pRefill() {
    var emptyCourts = [];
    P.courts.forEach(function(c, i) {
      if (!c.players || c.players.length === 0) emptyCourts.push(i);
    });

    function activePlayers() {
      return P.allPlayersList.filter(function(p) {
        return P.playCount[p] && P.playCount[p].isActive;
      });
    }

    function waitingFrom(arr) {
      return arr.filter(function(p) {
        return P.playCount[p] &&
               P.playCount[p].isActive &&
               !pCourtHasPlayer(p) &&
               !pITL(p);
      });
    }

    function sortByFairness(players) {
      return players.slice().sort(function(a, b) {
        var ga = (P.playCount[a] && P.playCount[a].games) || 0;
        var gb = (P.playCount[b] && P.playCount[b].games) || 0;
        if (ga !== gb) return ga - gb;
        return ((P.playCount[a] && P.playCount[a].lastGameEndTime) || 0) -
               ((P.playCount[b] && P.playCount[b].lastGameEndTime) || 0);
      });
    }

    function groupStats(players) {
      var games = players.map(function(p) {
        return (P.playCount[p] && P.playCount[p].games) || 0;
      });
      return {
        min: Math.min.apply(null, games),
        max: Math.max.apply(null, games),
        sum: games.reduce(function(a, b) { return a + b; }, 0),
        wait: Math.min.apply(null, players.map(function(p) {
          return (P.playCount[p] && P.playCount[p].lastGameEndTime) || 0;
        }))
      };
    }

    function buildMixedSeedGroup() {
      var seedWaiting = sortByFairness(waitingFrom(P.seedPool));
      if (!seedWaiting.length || seedWaiting.length >= 4) return null;

      var need = 4 - seedWaiting.length;
      var otherWaiting = sortByFairness(
        waitingFrom(P.winnersPool).concat(waitingFrom(P.losersPool))
      ).filter(function(p) {
        return seedWaiting.indexOf(p) === -1;
      });

      if (otherWaiting.length < need) return null;

      return {
        source: 'mixed-seed',
        track: 'seed',
        players: seedWaiting.concat(otherWaiting.slice(0, need)),
        mixed: true
      };
    }

    function removeChosenPlayers(group, chosenPlayers) {
      chosenPlayers.forEach(function(p) {
        pRemoveFromAllPools(p);
      });
    }

    for (var eci = 0; eci < emptyCourts.length; eci++) {
      var ci = emptyCourts[eci];

      if (pActivateTempCourt(ci)) continue;

      var seed4 = pTakeFourFromPool('seedPool');
      var winners4 = pTakeFourFromPool('winnersPool');
      var losers4 = pTakeFourFromPool('losersPool');
      var mixedSeed = buildMixedSeedGroup();

      var groups = [];
      if (seed4) groups.push({ source: 'seedPool', track: 'seed', players: seed4 });
      if (winners4) groups.push({ source: 'winnersPool', track: 'winners', players: winners4 });
      if (losers4) groups.push({ source: 'losersPool', track: 'losers', players: losers4 });
      if (mixedSeed) groups.push(mixedSeed);

      if (!groups.length) continue;

      var active = activePlayers();
      var globalGames = active.map(function(p) {
        return (P.playCount[p] && P.playCount[p].games) || 0;
      });
      var globalMax = globalGames.length ? Math.max.apply(null, globalGames) : 0;

      groups.forEach(function(g) {
        g.stats = groupStats(g.players);
      });

      var pureSeedGroup = groups.find(function(g) { return g.source === 'seedPool'; });
      var mixedSeedGroup = groups.find(function(g) { return g.source === 'mixed-seed'; });

      var chosen = null;

      if (pureSeedGroup && pureSeedGroup.stats.min < globalMax) {
        chosen = pureSeedGroup;
      } else if (mixedSeedGroup && mixedSeedGroup.stats.min < globalMax) {
        chosen = mixedSeedGroup;
      } else {
        groups.sort(function(a, b) {
          if (a.stats.min !== b.stats.min) return a.stats.min - b.stats.min;
          if (a.stats.sum !== b.stats.sum) return a.stats.sum - b.stats.sum;
          if (a.stats.wait !== b.stats.wait) return a.stats.wait - b.stats.wait;

          var rank = {
            'seedPool': 0,
            'mixed-seed': 1,
            'winnersPool': 2,
            'losersPool': 3
          };
          return rank[a.source] - rank[b.source];
        });
        chosen = groups[0];
      }

      var bg = pFindBG(chosen.players);
      if (!bg) continue;

      removeChosenPlayers(chosen, bg.players);

      P.courts[ci] = {
        players: bg.players.slice(),
        teamA: bg.teamA.slice(),
        teamB: bg.teamB.slice(),
        startTime: new Date().toISOString(),
        track: chosen.track
      };

      uPSP(bg.teamA, bg.teamB, 1);

      bg.players.forEach(function(p) {
        if (P.playerState[p]) P.playerState[p].lane = 'oncourt';
      });
    }
  }

  /* ── Record Win (Session) ──────────────────────────────── */
  function RecWin(ci, w) {
    return {
      execute: function() {
        var c = S.courts[ci];
        if (!c || !c.players || c.players.length !== 4) return false;
        var wT = !!c.isTemp;
        var tempId = c.tempId;
        var tA = c.teamA, tB = c.teamB, st = c.startTime, ps = c.players.slice();
        var now = Date.now();
        ps.forEach(function(p) {
          var pc = S.playCount[p];
          pc.games++; pc.lastGameEndTime = now;
          if ((w === 'A' && tA.indexOf(p) !== -1) || (w === 'B' && tB.indexOf(p) !== -1)) pc.wins++;
          else pc.losses++;
        });
        S.restingPlayers = S.restingPlayers.concat(ps);
        S.matchHistory.push({
          mode: 'session', court: ci + 1, courtName: gCL(ci),
          teamA: tA, teamB: tB, winner: w,
          startTime: st, endTime: new Date(now).toISOString()
        });
        S.courts[ci] = { players: [], teamA: [], teamB: [], startTime: null };
        S.completedGameCount++;
        notify('Winner Recorded!');
        if (wT && tempId) {
          S.tempCourts = (S.tempCourts || []).filter(function(tc) { return tc.id !== tempId; });
        }
        hTCA(ci);
        refill();
        return true;
      }
    };
  }

  /* ── Record Win (Promotion) ────────────────────────────── */
  function pRecWin(ci, w) {
    return {
      execute: function() {
        var c = P.courts[ci];
        if (!c || !c.players || c.players.length !== 4) return false;

        var wT = !!c.isTemp;
        var tempId = c.tempId;
        var tA = c.teamA.slice();
        var tB = c.teamB.slice();
        var st = c.startTime;
        var ps = c.players.slice();
        var track = c.track || 'seed';
        var now = Date.now();

        var winners = (w === 'A') ? tA.slice() : tB.slice();
        var losers = (w === 'A') ? tB.slice() : tA.slice();

        ps.forEach(function(p) {
          var pc = P.playCount[p];
          pc.games++;
          pc.lastGameEndTime = now;
          if (winners.indexOf(p) !== -1) pc.wins++;
          else pc.losses++;

          if (track === 'seed') pc.seedGames = (pc.seedGames || 0) + 1;
          else if (track === 'winners') pc.winnersGames = (pc.winnersGames || 0) + 1;
          else if (track === 'losers') pc.losersGames = (pc.losersGames || 0) + 1;
          else if (track === 'custom') pc.customGames = (pc.customGames || 0) + 1;
        });

        winners.forEach(function(p) {
          P.winnersPool.push(p);
          if (P.playerState[p]) {
            P.playerState[p].lane = 'winners';
            P.playerState[p].lastKnownLane = 'winners';
          }
        });

        losers.forEach(function(p) {
          P.losersPool.push(p);
          if (P.playerState[p]) {
            P.playerState[p].lane = 'losers';
            P.playerState[p].lastKnownLane = 'losers';
          }
        });

        P.matchHistory.push({
          mode: 'promotion',
          court: ci + 1,
          courtName: gCL(ci),
          teamA: tA,
          teamB: tB,
          winner: w,
          track: track,
          startTime: st,
          endTime: new Date(now).toISOString()
        });

        P.courts[ci] = { players: [], teamA: [], teamB: [], startTime: null, track: 'seed' };
        P.completedGameCount++;
        notify('Winner Recorded!');

        if (wT && tempId) {
          P.tempCourts = (P.tempCourts || []).filter(function(tc) { return tc.id !== tempId; });
        }

        pRefill();
        return true;
      }
    };
  }

  function SaveTeams(ci, nA, nB) {
    return {
      execute: function() {
        var all = nA.concat(nB);
        var unique = all.filter(function(v, i) { return all.indexOf(v) === i; });
        if (unique.length !== 4) { notify('Each player must be unique.', 'error'); return false; }
        var v = valCT(nA, nB);
        if (!v.ok) { notify(v.msg, 'error'); return false; }
        var oA = S.courts[ci].teamA.slice(), oB = S.courts[ci].teamB.slice();
        uPS(oA, oB, -1);
        uPS(nA, nB, 1);
        S.courts[ci].teamA = nA;
        S.courts[ci].teamB = nB;
        S.courts[ci].players = nA.concat(nB);
        notify('Teams for ' + gCL(ci) + ' updated.');
        cModal('managementModal');
        return true;
      }
    };
  }

  function pSaveTeams(ci, nA, nB) {
    return {
      execute: function() {
        var all = nA.concat(nB);
        var unique = all.filter(function(v, i) { return all.indexOf(v) === i; });
        if (unique.length !== 4) { notify('Each player must be unique.', 'error'); return false; }
        var oA = P.courts[ci].teamA.slice(), oB = P.courts[ci].teamB.slice();
        uPSP(oA, oB, -1);
        uPSP(nA, nB, 1);
        P.courts[ci].teamA = nA;
        P.courts[ci].teamB = nB;
        P.courts[ci].players = nA.concat(nB);
        notify('Teams for ' + gCL(ci) + ' updated.');
        cModal('promotionManageModal');
        return true;
      }
    };
  }

  function SwapP(ci, pO, pI) {
    return {
      execute: function() {
        var c = S.courts[ci];
        if (!c || !pO || !pI) return false;
        var nA = c.teamA.slice(), nB = c.teamB.slice();
        if (nA.indexOf(pO) !== -1) nA[nA.indexOf(pO)] = pI;
        else if (nB.indexOf(pO) !== -1) nB[nB.indexOf(pO)] = pI;
        else { notify('Selected player is not on this court.', 'error'); return false; }
        var v = valCT(nA, nB);
        if (!v.ok) { notify(v.msg, 'error'); return false; }
        uPS(c.teamA, c.teamB, -1);
        c.teamA = nA;
        c.teamB = nB;
        c.players = nA.concat(nB);
        uPS(c.teamA, c.teamB, 1);
        S.restingPlayers = S.restingPlayers.filter(function(p) { return p !== pI; });
        S.restingPlayers.push(pO);
        notify(pI + ' swapped with ' + pO + '.');
        cModal('managementModal');
        return true;
      }
    };
  }

  function pSwapP(ci, pO, pI) {
    return {
      execute: function() {
        var c = P.courts[ci];
        if (!c || !pO || !pI) return false;

        var lane = (c.track === 'winners') ? 'winners' : (c.track === 'losers' ? 'losers' : 'seed');
        var sourcePool = lane === 'winners' ? P.winnersPool : lane === 'losers' ? P.losersPool : P.seedPool;

        if (sourcePool.indexOf(pI) === -1) {
          notify('Replacement must come from the same lane.', 'error');
          return false;
        }

        var nA = c.teamA.slice(), nB = c.teamB.slice();
        if (nA.indexOf(pO) !== -1) nA[nA.indexOf(pO)] = pI;
        else if (nB.indexOf(pO) !== -1) nB[nB.indexOf(pO)] = pI;
        else { notify('Selected player is not on this court.', 'error'); return false; }

        uPSP(c.teamA, c.teamB, -1);
        c.teamA = nA;
        c.teamB = nB;
        c.players = nA.concat(nB);
        uPSP(c.teamA, c.teamB, 1);

        var idx = sourcePool.indexOf(pI);
        if (idx !== -1) sourcePool.splice(idx, 1);
        sourcePool.push(pO);

        if (P.playerState[pI]) P.playerState[pI].lane = 'oncourt';
        if (P.playerState[pO]) {
          P.playerState[pO].lane = lane;
          P.playerState[pO].lastKnownLane = lane;
        }

        notify(pI + ' swapped with ' + pO + '.');
        cModal('promotionManageModal');
        return true;
      }
    };
  }

  /* ── Session Init ──────────────────────────────────────── */
  function initGame() {
    var cc = parseInt(qs('#courtCount').value);
    if (!cc || cc < 1) { notify('Please enter a valid number of courts.', 'error'); return; }
    if (PP.length < 4) { notify('At least 4 players are required.', 'error'); return; }
    if (cc > Math.floor(PP.length / 4)) { notify('Not enough players for the number of courts specified.', 'error'); return; }
    var names = PP.map(function(p) { return p.name; });
    shuf(names);
    MODE = 'session';
    S = {
      courts: Array.from({ length: cc }, function() { return { players: [], teamA: [], teamB: [], startTime: null }; }),
      courtNames: Array.from({ length: cc }, function(_, i) { return 'Court ' + (i + 1); }),
      restingPlayers: names.slice(),
      playCount: {},
      matchHistory: [],
      teamPairings: {},
      opponentPairings: {},
      allPlayersList: names.slice(),
      playerMeta: {},
      gameInProgress: true,
      undoStack: [],
      completedGameCount: 0,
      tempCourts: []
    };
    PP.forEach(function(p) {
      var l = norm(p.name);
      S.playerMeta[l] = { name: p.name, skill: p.skill, isActive: true };
      S.playCount[p.name] = { wins: 0, losses: 0, games: 0, isActive: true, lastGameEndTime: 0, removalTimestamp: null };
    });
    initP(names);
    qs('#setupControls').classList.add('hidden');
    qs('#actionBar').classList.remove('hidden');
    refill();
    rAll();
  }

 function addPP() {
  var singleInput = qs('#playerNameInput');
  var bulkInput = qs('#playerNameBulkInput');
  var sk = qs('#playerSkillSelect').value;

  if (PLAYER_ENTRY_MODE === 'single') {
    var rawSingle = (singleInput.value || '').trim();
    if (!rawSingle) { notify('Enter player name.', 'error'); return; }

    var n = rawSingle;
    var l = norm(n);
    if (!l) { notify('Invalid name.', 'error'); return; }
    if (PP.some(function(p) { return p.lower === l; })) {
      notify('Player already added.', 'error');
      return;
    }

    PP.push({ name: n, lower: l, skill: sk });
    singleInput.value = '';
    rPL();
    return;
  }

  var rawBulk = (bulkInput.value || '').trim();
  if (!rawBulk) { notify('Enter player names.', 'error'); return; }

  var names = rawBulk
    .split(/\r?\n|,/)
    .map(function(x) { return x.trim(); })
    .filter(Boolean);

  if (!names.length) {
    notify('Enter at least one player.', 'error');
    return;
  }

  var added = 0;
  var skipped = 0;

  names.forEach(function(n) {
    var l = norm(n);
    if (!l) { skipped++; return; }
    if (PP.some(function(p) { return p.lower === l; })) { skipped++; return; }
    PP.push({ name: n, lower: l, skill: sk });
    added++;
  });

  bulkInput.value = '';
  rPL();

  if (added && skipped) notify('Added ' + added + ' player(s), skipped ' + skipped + '.');
  else if (added) notify('Added ' + added + ' player(s).');
  else notify('No new players were added.', 'error');
}
function setPlayerEntryMode(mode) {
  PLAYER_ENTRY_MODE = (mode === 'bulk') ? 'bulk' : 'single';

  var singleBtn = qs('#entryModeSingleBtn');
  var bulkBtn = qs('#entryModeBulkBtn');
  var singleInput = qs('#playerNameInput');
  var bulkInput = qs('#playerNameBulkInput');
  var hint = qs('#playerEntryHint');
  var label = qs('label[for="playerNameInput"]');

  if (singleBtn) singleBtn.classList.toggle('btn-secondary', PLAYER_ENTRY_MODE === 'single');
  if (singleBtn) singleBtn.classList.toggle('btn-toggle', PLAYER_ENTRY_MODE !== 'single');

  if (bulkBtn) bulkBtn.classList.toggle('btn-secondary', PLAYER_ENTRY_MODE === 'bulk');
  if (bulkBtn) bulkBtn.classList.toggle('btn-toggle', PLAYER_ENTRY_MODE !== 'bulk');

  if (PLAYER_ENTRY_MODE === 'bulk') {
    if (singleInput) singleInput.classList.add('hidden');
    if (bulkInput) bulkInput.classList.remove('hidden');
    if (hint) hint.textContent = 'Bulk mode: all entered names will use the currently selected skill.';
    if (label) label.textContent = 'Player Names';
  } else {
    if (singleInput) singleInput.classList.remove('hidden');
    if (bulkInput) bulkInput.classList.add('hidden');
    if (hint) hint.textContent = 'Single mode: add one player at a time.';
    if (label) label.textContent = 'Player Name';
  }
}

function setPromotionEntryMode(mode) {
  PROMOTION_ENTRY_MODE = (mode === 'bulk') ? 'bulk' : 'single';

  var singleBtn = qs('#pEntryModeSingleBtn');
  var bulkBtn = qs('#pEntryModeBulkBtn');
  var singleInput = qs('#pPlayerNameInput');
  var bulkInput = qs('#pPlayerNameBulkInput');
  var hint = qs('#pPlayerEntryHint');
  var label = qs('label[for="pPlayerNameInput"]');

  if (singleBtn) singleBtn.classList.toggle('btn-secondary', PROMOTION_ENTRY_MODE === 'single');
  if (singleBtn) singleBtn.classList.toggle('btn-toggle', PROMOTION_ENTRY_MODE !== 'single');

  if (bulkBtn) bulkBtn.classList.toggle('btn-secondary', PROMOTION_ENTRY_MODE === 'bulk');
  if (bulkBtn) bulkBtn.classList.toggle('btn-toggle', PROMOTION_ENTRY_MODE !== 'bulk');

  if (PROMOTION_ENTRY_MODE === 'bulk') {
    if (singleInput) singleInput.classList.add('hidden');
    if (bulkInput) bulkInput.classList.remove('hidden');
    if (hint) hint.textContent = 'Bulk mode: add multiple players at once.';
    if (label) label.textContent = 'Player Names';
  } else {
    if (singleInput) singleInput.classList.remove('hidden');
    if (bulkInput) bulkInput.classList.add('hidden');
    if (hint) hint.textContent = 'Single mode: add one player at a time.';
    if (label) label.textContent = 'Player Name';
  }
}


  function rPL() {
    var l = qs('#pendingPlayersList');
    var countEl = qs('#pendingPlayerCount');
    if (countEl) countEl.textContent = PP.length;
    if (!l) return;
    l.innerHTML = '';
    if (!PP.length) { l.innerHTML = rES('➕', 'Add players one by one to get started.'); }
    else PP.forEach(function(p, i) {
      var r = document.createElement('div');
      r.className = 'pending-item';
      r.innerHTML = '<div class="meta">' + p.name + ' <span class="player-skill">' + p.skill + '</span></div><button class="remove-btn" data-remove-index="' + i + '">Remove</button>';
      l.appendChild(r);
    });
    valStart();
  }

  function valStart() {
    var b = qs('#startBtn'), c = parseInt(qs('#courtCount').value) || 0;
    if (b) b.disabled = !(PP.length >= 4 && c >= 1 && c <= Math.floor(PP.length / 4));
  }

  /* ── Promotion Init ────────────────────────────────────── */
  function pInitGame() {
    var cc = parseInt(qs('#pCourtCount').value);
    if (!cc || cc < 1) { notify('Please enter a valid number of courts.', 'error'); return; }
    if (PR.length < 4) { notify('At least 4 players are required.', 'error'); return; }
    if (cc > Math.floor(PR.length / 4)) { notify('Not enough players for the number of courts specified.', 'error'); return; }

    var names = PR.slice();
    shuf(names);
    MODE = 'promotion';

    P = {
      gameInProgress: true,
      courts: Array.from({ length: cc }, function() { return { players: [], teamA: [], teamB: [], startTime: null, track: 'seed' }; }),
      courtNames: Array.from({ length: cc }, function(_, i) { return 'Court ' + (i + 1); }),
      seedPool: names.slice(),
      winnersPool: [],
      losersPool: [],
      allPlayersList: names.slice(),
      playCount: {},
      playerState: {},
      matchHistory: [],
      teamPairings: {},
      opponentPairings: {},
      undoStack: [],
      completedGameCount: 0,
      tempCourts: []
    };

    names.forEach(function(n) {
      P.playCount[n] = {
        wins: 0,
        losses: 0,
        games: 0,
        seedGames: 0,
        winnersGames: 0,
        losersGames: 0,
        customGames: 0,
        isActive: true,
        lastGameEndTime: 0,
        removalTimestamp: null
      };
      P.playerState[n] = {
        lane: 'seed',
        lastKnownLane: 'seed',
        isActive: true
      };
    });

    initPP(names);

    qs('#promotionSetupControls').classList.add('hidden');
    qs('#actionBar').classList.remove('hidden');
    pRefill();
    rAll();
  }

  function pAddPlayer() {
  var singleInput = qs('#pPlayerNameInput');
  var bulkInput = qs('#pPlayerNameBulkInput');

  if (PROMOTION_ENTRY_MODE === 'single') {
    var n = (singleInput.value || '').trim();
    if (!n) { notify('Enter a player name.', 'error'); return; }
    var l = norm(n);
    if (!l) { notify('Invalid name.', 'error'); return; }
    if (PR.some(function(p) { return norm(p) === l; })) {
      notify('Player already added.', 'error');
      return;
    }
    PR.push(n);
    singleInput.value = '';
    pRenderPendingPlayers();
    return;
  }

  var raw = (bulkInput.value || '').trim();
  if (!raw) { notify('Enter player names.', 'error'); return; }

  var names = raw
    .split(/\r?\n|,/)
    .map(function(x) { return x.trim(); })
    .filter(Boolean);

  if (!names.length) {
    notify('Enter at least one player.', 'error');
    return;
  }

  var added = 0;
  var skipped = 0;

  names.forEach(function(n) {
    var l = norm(n);
    if (!l) { skipped++; return; }
    if (PR.some(function(p) { return norm(p) === l; })) { skipped++; return; }
    PR.push(n);
    added++;
  });

  bulkInput.value = '';
  pRenderPendingPlayers();

  if (added && skipped) notify('Added ' + added + ' player(s), skipped ' + skipped + '.');
  else if (added) notify('Added ' + added + ' player(s).');
  else notify('No new players were added.', 'error');
}

  function pRenderPendingPlayers() {
    var l = qs('#pPlayersList');
    var countEl = qs('#promotionPendingPlayerCount');
    if (countEl) countEl.textContent = PR.length;
    if (!l) return;
    l.innerHTML = '';
    if (!PR.length) { l.innerHTML = rES('➕', 'Add players one by one to get started.'); }
    else PR.forEach(function(p, i) {
      var r = document.createElement('div');
      r.className = 'pending-item';
      r.innerHTML = '<div class="meta">' + p + '</div><button class="remove-btn" data-premove-index="' + i + '">Remove</button>';
      l.appendChild(r);
    });
    pValStart();
  }

  function pValStart() {
    var b = qs('#pStartBtn'), c = parseInt(qs('#pCourtCount').value) || 0;
    if (b) b.disabled = !(PR.length >= 4 && c >= 1 && c <= Math.floor(PR.length / 4));
  }
  /* ── Session Mgmt Actions ──────────────────────────────── */
  function activeSessionPlayers() {
    return S.allPlayersList.filter(function(n) {
      return S.playCount[n] && S.playCount[n].isActive;
    });
  }

  function removedSessionPlayers() {
    return S.allPlayersList.filter(function(n) {
      return S.playCount[n] && !S.playCount[n].isActive;
    });
  }

  function addMid() {
    var n = (qs('#mgmtNewPlayerName').value || '').trim();
    var sk = qs('#mgmtNewPlayerSkill').value;
    if (!n) { notify('Enter a player name.', 'error'); return; }
    if (S.playCount[n]) { notify('Player already exists.', 'error'); return; }

    S.allPlayersList.push(n);
    S.playerMeta[norm(n)] = { name: n, skill: sk, isActive: true };
    S.playCount[n] = {
      wins: 0, losses: 0, games: 0,
      isActive: true, lastGameEndTime: 0, removalTimestamp: null
    };
    S.restingPlayers.push(n);
    uPNP([n]);
    qs('#mgmtNewPlayerName').value = '';
    notify(n + ' added.');
    rAll();
  }

  function chSkill() {
    var p = qs('#skillChangePlayerSelect').value;
    var sk = qs('#skillChangeSkillSelect').value;
    if (!p) { notify('Select a player.', 'error'); return; }
    if (!S.playerMeta[norm(p)]) { notify('Player not found.', 'error'); return; }
    S.playerMeta[norm(p)].skill = sk;
    notify('Skill updated for ' + p + '.');
    rAll();
  }

  function renP() {
    var oldName = qs('#renamePlayerSelect').value;
    var newName = (qs('#renamePlayerInput').value || '').trim();
    if (!oldName || !newName) { notify('Select a player and enter a new name.', 'error'); return; }
    if (oldName === newName) { notify('New name must be different.', 'error'); return; }
    if (S.playCount[newName]) { notify('A player with that name already exists.', 'error'); return; }

    var oldNorm = norm(oldName), newNorm = norm(newName);

    S.allPlayersList = S.allPlayersList.map(function(n) { return n === oldName ? newName : n; });
    S.restingPlayers = S.restingPlayers.map(function(n) { return n === oldName ? newName : n; });

    S.courts.forEach(function(c) {
      c.players = c.players.map(function(n) { return n === oldName ? newName : n; });
      c.teamA = c.teamA.map(function(n) { return n === oldName ? newName : n; });
      c.teamB = c.teamB.map(function(n) { return n === oldName ? newName : n; });
    });

    S.tempCourts = (S.tempCourts || []).map(function(tc) {
      tc.players = tc.players.map(function(n) { return n === oldName ? newName : n; });
      tc.teamA = (tc.teamA || []).map(function(n) { return n === oldName ? newName : n; });
      tc.teamB = (tc.teamB || []).map(function(n) { return n === oldName ? newName : n; });
      return tc;
    });

    S.matchHistory.forEach(function(m) {
      m.teamA = m.teamA.map(function(n) { return n === oldName ? newName : n; });
      m.teamB = m.teamB.map(function(n) { return n === oldName ? newName : n; });
    });

    S.playCount[newName] = S.playCount[oldName];
    delete S.playCount[oldName];

    S.playerMeta[newNorm] = {
      name: newName,
      skill: (S.playerMeta[oldNorm] && S.playerMeta[oldNorm].skill) || 'Int',
      isActive: (S.playerMeta[oldNorm] && S.playerMeta[oldNorm].isActive !== false)
    };
    delete S.playerMeta[oldNorm];

    rebuildP();

    qs('#renamePlayerInput').value = '';
    notify(oldName + ' renamed to ' + newName + '.');
    rAll();
  }

  function remP() {
    var p = qs('#playerToRemove').value;
    if (!p) { notify('Select a player.', 'error'); return; }
    if (!S.playCount[p] || !S.playCount[p].isActive) { notify('Player is already removed.', 'error'); return; }

    S.playCount[p].isActive = false;
    S.playCount[p].removalTimestamp = Date.now();
    if (S.playerMeta[norm(p)]) S.playerMeta[norm(p)].isActive = false;

    S.restingPlayers = S.restingPlayers.filter(function(n) { return n !== p; });

    S.courts.forEach(function(c, ci) {
      if (c.players.indexOf(p) !== -1) {
        c.players = c.players.filter(function(n) { return n !== p; });
        c.teamA = c.teamA.filter(function(n) { return n !== p; });
        c.teamB = c.teamB.filter(function(n) { return n !== p; });
        if (c.players.length < 4) {
          S.courts[ci] = { players: [], teamA: [], teamB: [], startTime: null };
        }
      }
    });

    S.tempCourts = (S.tempCourts || []).filter(function(tc) {
      return tc.players.indexOf(p) === -1;
    });

    rebuildP();
    refill();
    notify(p + ' removed.');
    rAll();
  }

  function reinstP() {
    var p = qs('#playerToReinstate').value;
    if (!p) { notify('Select a player.', 'error'); return; }
    if (!S.playCount[p] || S.playCount[p].isActive) { notify('Player is already active.', 'error'); return; }

    S.playCount[p].isActive = true;
    S.playCount[p].removalTimestamp = null;
    if (S.playerMeta[norm(p)]) S.playerMeta[norm(p)].isActive = true;
    S.restingPlayers.push(p);
    uPNP([p]);
    refill();
    notify(p + ' reinstated.');
    rAll();
  }

  function addCt() {
    S.courts.push({ players: [], teamA: [], teamB: [], startTime: null });
    S.courtNames.push('Court ' + S.courts.length);
    refill();
    notify('Court added.');
    rAll();
  }

  function remCt() {
    var idx = parseInt(qs('#courtToRemove').value, 10);
    if (isNaN(idx) || idx < 0 || idx >= S.courts.length) { notify('Select a valid court.', 'error'); return; }
    var c = S.courts[idx];
    if (c && c.players && c.players.length) {
      S.restingPlayers = S.restingPlayers.concat(c.players);
    }
    S.courts.splice(idx, 1);
    S.courtNames.splice(idx, 1);
    refill();
    notify('Court removed.');
    rAll();
  }

  function renCt() {
    var idx = parseInt(qs('#courtToRename').value, 10);
    var name = (qs('#courtRenameInput').value || '').trim();
    if (isNaN(idx) || idx < 0 || idx >= S.courts.length || !name) { notify('Select a court and enter a name.', 'error'); return; }
    S.courtNames[idx] = name;
    qs('#courtRenameInput').value = '';
    notify('Court renamed.');
    rAll();
  }

  function schTemp() {
    var ids = ['#tempPlayer1', '#tempPlayer2', '#tempPlayer3', '#tempPlayer4'];
    var picks = ids.map(function(id) { return qs(id).value; }).filter(Boolean);
    var uniq = picks.filter(function(v, i) { return picks.indexOf(v) === i; });
    var after = parseInt(qs('#tempAfterGames').value || '0', 10);

    if (picks.length !== 4 || uniq.length !== 4) { notify('Select 4 unique players.', 'error'); return; }
    if ((S.tempCourts || []).length >= MAX_CUSTOM_GAMES) { notify('Maximum custom games reached.', 'error'); return; }
    if (isNaN(after) || after < 0) after = 0;

    var tc = {
      id: Date.now() + 'r' + Math.random(),
      players: picks.slice(),
      teamA: [picks[0], picks[1]],
      teamB: [picks[2], picks[3]],
      readyAtGameCount: S.completedGameCount + after,
      pending: true,
      active: false
    };
    S.tempCourts.push(tc);

    ids.forEach(function(id) { qs(id).value = ''; });
    qs('#tempAfterGames').value = '';
    notify('Custom game scheduled.');
    rAll();
  }

  /* ── Promotion Mgmt Actions ────────────────────────────── */
  function activePromotionPlayers() {
    return P.allPlayersList.filter(function(n) {
      return P.playCount[n] && P.playCount[n].isActive;
    });
  }

  function removedPromotionPlayers() {
    return P.allPlayersList.filter(function(n) {
      return P.playCount[n] && !P.playCount[n].isActive;
    });
  }

  function pAddMid() {
    var n = (qs('#pMgmtNewPlayerName').value || '').trim();
    if (!n) { notify('Enter a player name.', 'error'); return; }
    if (P.playCount[n]) { notify('Player already exists.', 'error'); return; }

    P.allPlayersList.push(n);
    P.playCount[n] = {
      wins: 0, losses: 0, games: 0,
      seedGames: 0, winnersGames: 0, losersGames: 0, customGames: 0,
      isActive: true, lastGameEndTime: 0, removalTimestamp: null
    };
    P.playerState[n] = { lane: 'seed', lastKnownLane: 'seed', isActive: true };
    P.seedPool.push(n);
    uPNPP([n]);
    qs('#pMgmtNewPlayerName').value = '';
    notify(n + ' added.');
    rAll();
  }

  function pRen() {
    var oldName = qs('#pRenamePlayerSelect').value;
    var newName = (qs('#pRenamePlayerInput').value || '').trim();
    if (!oldName || !newName) { notify('Select a player and enter a new name.', 'error'); return; }
    if (oldName === newName) { notify('New name must be different.', 'error'); return; }
    if (P.playCount[newName]) { notify('A player with that name already exists.', 'error'); return; }

    P.allPlayersList = P.allPlayersList.map(function(n) { return n === oldName ? newName : n; });
    P.seedPool = P.seedPool.map(function(n) { return n === oldName ? newName : n; });
    P.winnersPool = P.winnersPool.map(function(n) { return n === oldName ? newName : n; });
    P.losersPool = P.losersPool.map(function(n) { return n === oldName ? newName : n; });

    P.courts.forEach(function(c) {
      c.players = c.players.map(function(n) { return n === oldName ? newName : n; });
      c.teamA = c.teamA.map(function(n) { return n === oldName ? newName : n; });
      c.teamB = c.teamB.map(function(n) { return n === oldName ? newName : n; });
    });

    P.tempCourts = (P.tempCourts || []).map(function(tc) {
      tc.players = tc.players.map(function(n) { return n === oldName ? newName : n; });
      tc.teamA = (tc.teamA || []).map(function(n) { return n === oldName ? newName : n; });
      tc.teamB = (tc.teamB || []).map(function(n) { return n === oldName ? newName : n; });
      return tc;
    });

    P.matchHistory.forEach(function(m) {
      m.teamA = m.teamA.map(function(n) { return n === oldName ? newName : n; });
      m.teamB = m.teamB.map(function(n) { return n === oldName ? newName : n; });
    });

    P.playCount[newName] = P.playCount[oldName];
    delete P.playCount[oldName];

    P.playerState[newName] = P.playerState[oldName];
    delete P.playerState[oldName];

    rebuildPP();
    qs('#pRenamePlayerInput').value = '';
    notify(oldName + ' renamed to ' + newName + '.');
    rAll();
  }
  function pRem() {
    var p = qs('#pPlayerToRemove').value;
    if (!p) { notify('Select a player.', 'error'); return; }
    if (!P.playCount[p] || !P.playCount[p].isActive) { notify('Player is already removed.', 'error'); return; }

    P.playCount[p].isActive = false;
    P.playCount[p].removalTimestamp = Date.now();
    if (P.playerState[p]) P.playerState[p].isActive = false;

    pRemoveFromAllPools(p);

    P.courts.forEach(function(c, ci) {
      if (c.players.indexOf(p) !== -1) {
        c.players = c.players.filter(function(n) { return n !== p; });
        c.teamA = c.teamA.filter(function(n) { return n !== p; });
        c.teamB = c.teamB.filter(function(n) { return n !== p; });
        if (c.players.length < 4) {
          P.courts[ci] = { players: [], teamA: [], teamB: [], startTime: null, track: 'seed' };
        }
      }
    });

    P.tempCourts = (P.tempCourts || []).filter(function(tc) {
      return tc.players.indexOf(p) === -1;
    });

    rebuildPP();
    pRefill();
    notify(p + ' removed.');
    rAll();
  }

  function pReinst() {
    var p = qs('#pPlayerToReinstate').value;
    if (!p) { notify('Select a player.', 'error'); return; }
    if (!P.playCount[p] || P.playCount[p].isActive) { notify('Player is already active.', 'error'); return; }

    P.playCount[p].isActive = true;
    P.playCount[p].removalTimestamp = null;
    if (!P.playerState[p]) P.playerState[p] = { lane: 'seed', lastKnownLane: 'seed', isActive: true };
    P.playerState[p].isActive = true;
    P.playerState[p].lane = 'seed';
    P.playerState[p].lastKnownLane = 'seed';
    P.seedPool.push(p);
    uPNPP([p]);
    pRefill();
    notify(p + ' reinstated.');
    rAll();
  }

  function pAddCt() {
    P.courts.push({ players: [], teamA: [], teamB: [], startTime: null, track: 'seed' });
    P.courtNames.push('Court ' + P.courts.length);
    pRefill();
    notify('Court added.');
    rAll();
  }

  function pRemCt() {
    var idx = parseInt(qs('#pCourtToRemove').value, 10);
    if (isNaN(idx) || idx < 0 || idx >= P.courts.length) { notify('Select a valid court.', 'error'); return; }

    var c = P.courts[idx];
    if (c && c.players && c.players.length) {
      var lane = c.track === 'winners' ? 'winners' : c.track === 'losers' ? 'losers' : 'seed';
      c.players.forEach(function(n) {
        if (lane === 'winners') P.winnersPool.push(n);
        else if (lane === 'losers') P.losersPool.push(n);
        else P.seedPool.push(n);
        if (P.playerState[n]) {
          P.playerState[n].lane = lane;
          P.playerState[n].lastKnownLane = lane;
        }
      });
    }

    P.courts.splice(idx, 1);
    P.courtNames.splice(idx, 1);
    pRefill();
    notify('Court removed.');
    rAll();
  }

  function pRenCt() {
    var idx = parseInt(qs('#pCourtToRename').value, 10);
    var name = (qs('#pCourtRenameInput').value || '').trim();
    if (isNaN(idx) || idx < 0 || idx >= P.courts.length || !name) { notify('Select a court and enter a name.', 'error'); return; }
    P.courtNames[idx] = name;
    qs('#pCourtRenameInput').value = '';
    notify('Court renamed.');
    rAll();
  }

  function pSchTemp() {
    var ids = ['#pTempPlayer1', '#pTempPlayer2', '#pTempPlayer3', '#pTempPlayer4'];
    var picks = ids.map(function(id) { return qs(id).value; }).filter(Boolean);
    var uniq = picks.filter(function(v, i) { return picks.indexOf(v) === i; });
    var after = parseInt(qs('#pTempAfterGames').value || '0', 10);

    if (picks.length !== 4 || uniq.length !== 4) { notify('Select 4 unique players.', 'error'); return; }
    if ((P.tempCourts || []).length >= MAX_CUSTOM_GAMES) { notify('Maximum custom games reached.', 'error'); return; }
    if (isNaN(after) || after < 0) after = 0;

    var waiting = pWaitingPool();
    var okAllWaiting = picks.every(function(n) { return waiting.indexOf(n) !== -1; });
    if (!okAllWaiting) { notify('Custom players must be waiting (not currently on court).', 'error'); return; }

    var tc = {
      id: Date.now() + 'r' + Math.random(),
      players: picks.slice(),
      teamA: [picks[0], picks[1]],
      teamB: [picks[2], picks[3]],
      readyAtGameCount: P.completedGameCount + after,
      pending: true,
      active: false
    };
    P.tempCourts.push(tc);

    ids.forEach(function(id) { qs(id).value = ''; });
    qs('#pTempAfterGames').value = '';
    notify('Custom game scheduled.');
    rAll();
  }

  /* ── Dropdown Data ─────────────────────────────────────── */
  function pDD() {
    popSel(qs('#playerToRemove'), activeSessionPlayers(), 'Select Player');
    popSel(qs('#playerToReinstate'), removedSessionPlayers(), 'Select Player');
    popSel(qs('#skillChangePlayerSelect'), activeSessionPlayers(), 'Select Player');
    popSel(qs('#renamePlayerSelect'), activeSessionPlayers(), 'Select Player');

    var courtOpts = S.courts.map(function(_, i) { return { value: String(i), text: gCL(i) }; });
    popSel(qs('#courtToRemove'), courtOpts, 'Select Court to Remove');
    popSel(qs('#courtToRename'), courtOpts, 'Select Court to Rename');

    var resting = gERP();
    ['#tempPlayer1', '#tempPlayer2', '#tempPlayer3', '#tempPlayer4'].forEach(function(id) {
      popSel(qs(id), resting, id.replace('#tempPlayer','Select Player '));
    });

    /* Promotion dropdowns */
    popSel(qs('#pPlayerToRemove'), activePromotionPlayers(), 'Select Player');
    popSel(qs('#pPlayerToReinstate'), removedPromotionPlayers(), 'Select Player');
    popSel(qs('#pRenamePlayerSelect'), activePromotionPlayers(), 'Select Player');

    var pCourtOpts = P.courts.map(function(_, i) { return { value: String(i), text: gCL(i) }; });
    popSel(qs('#pCourtToRemove'), pCourtOpts, 'Select Court to Remove');
    popSel(qs('#pCourtToRename'), pCourtOpts, 'Select Court to Rename');

    var pWaiting = pEligibleWaitingPlayers();
    ['#pTempPlayer1', '#pTempPlayer2', '#pTempPlayer3', '#pTempPlayer4'].forEach(function(id) {
      popSel(qs(id), pWaiting, id.replace('#pTempPlayer','Select Player '));
    });
  }

  /* ── Court Submodals ───────────────────────────────────── */
  function oEdit(ci) {
    var c = S.courts[ci];
    if (!c || !c.players || c.players.length !== 4) { notify('No active game on this court.', 'error'); return; }
    var m = qs('#managementModal');
    m.dataset.editingCourt = String(ci);
    m.dataset.openedFromCourt = 'true';

    qs('#mgmtMenuGrid').style.display = 'none';
    qsa('.mgmt-sub-panel').forEach(function(p) { p.classList.remove('active'); });
    qs('#editTeamsPanel').classList.add('active');
    qs('#editCourtTitle').textContent = 'Edit Teams - ' + gCL(ci);

    var opts = c.players.slice();
    popSel(qs('#editPlayerA1'), opts, undefined, c.teamA[0]);
    popSel(qs('#editPlayerA2'), opts, undefined, c.teamA[1]);
    popSel(qs('#editPlayerB1'), opts, undefined, c.teamB[0]);
    popSel(qs('#editPlayerB2'), opts, undefined, c.teamB[1]);

    oModal('managementModal');
  }

  function oSwap(ci) {
    var c = S.courts[ci];
    if (!c || !c.players || c.players.length !== 4) { notify('No active game on this court.', 'error'); return; }

    var resting = gERP();
    if (!resting.length) { notify('No eligible resting players.', 'error'); return; }

    var m = qs('#managementModal');
    m.dataset.editingCourt = String(ci);
    m.dataset.openedFromCourt = 'true';

    qs('#mgmtMenuGrid').style.display = 'none';
    qsa('.mgmt-sub-panel').forEach(function(p) { p.classList.remove('active'); });
    qs('#swapPlayerPanel').classList.add('active');
    qs('#swapCourtTitle').textContent = 'Swap Player - ' + gCL(ci);

    popSel(qs('#playerToSwapOut'), c.players, 'Select On-court Player');
    popSel(qs('#playerToSwapIn'), resting, 'Select Resting Player');

    oModal('managementModal');
  }

  function pOpenEdit(ci) {
    var c = P.courts[ci];
    if (!c || !c.players || c.players.length !== 4) { notify('No active game on this court.', 'error'); return; }

    var m = qs('#promotionManageModal');
    m.dataset.editingCourt = String(ci);
    m.dataset.openedFromCourt = 'true';

    var grid = qs('#pmgmtMenuGrid');
    if (grid) grid.style.display = 'none';
    var panels = qsa('.mgmt-sub-panel', m);
    Array.prototype.forEach.call(panels, function(p) { p.classList.remove('active'); });
    qs('#pEditTeamsPanel').classList.add('active');
    qs('#pEditCourtTitle').textContent = 'Edit Teams - ' + gCL(ci);

    var opts = c.players.slice();
    popSel(qs('#pEditPlayerA1'), opts, undefined, c.teamA[0]);
    popSel(qs('#pEditPlayerA2'), opts, undefined, c.teamA[1]);
    popSel(qs('#pEditPlayerB1'), opts, undefined, c.teamB[0]);
    popSel(qs('#pEditPlayerB2'), opts, undefined, c.teamB[1]);

    oModal('promotionManageModal');
  }

  function pOpenSwap(ci) {
    var c = P.courts[ci];
    if (!c || !c.players || c.players.length !== 4) { notify('No active game on this court.', 'error'); return; }

    var lane = (c.track === 'winners') ? 'winners' : (c.track === 'losers' ? 'losers' : 'seed');
    var sourcePool = lane === 'winners' ? P.winnersPool : lane === 'losers' ? P.losersPool : P.seedPool;
    var candidates = sourcePool.filter(function(n) { return !pITL(n); });

    if (!candidates.length) { notify('No eligible replacements in ' + lane + ' lane.', 'error'); return; }

    var m = qs('#promotionManageModal');
    m.dataset.editingCourt = String(ci);
    m.dataset.openedFromCourt = 'true';

    var grid = qs('#pmgmtMenuGrid');
    if (grid) grid.style.display = 'none';
    var panels = qsa('.mgmt-sub-panel', m);
    Array.prototype.forEach.call(panels, function(p) { p.classList.remove('active'); });
    qs('#pSwapPlayerPanel').classList.add('active');
    qs('#pSwapCourtTitle').textContent = 'Swap Player - ' + gCL(ci) + ' (' + pLaneLabel(c.track) + ')';

    popSel(qs('#pPlayerToSwapOut'), c.players, 'Select On-court Player');
    popSel(qs('#pPlayerToSwapIn'), candidates, 'Select Waiting Player');

    oModal('promotionManageModal');
  }

  /* ── Renders: Courts/Results ───────────────────────────── */
  function rSessionCourts() {
  var out = '';
  if (!S.courts.length) {
    qs('#results').innerHTML = rES('🏸', 'No courts yet.');
    return;
  }

  function pb(name, teamClass) {
    return '<div class="player-box ' + teamClass + '">' +
      '<span>' + name + '</span>' +
      '<span class="player-skill">' + pLbl(name).replace(/<\/?[^>]+(>|$)/g, '') + '</span>' +
    '</div>';
  }

  S.courts.forEach(function(c, i) {
    var hasGame = c.players && c.players.length === 4;

    out += '<div class="court" data-court="' + i + '">';
    out += '<h3>' + gCL(i) + (c.isTemp ? ' <span class="mode-badge">Custom</span>' : '') + '</h3>';

    out += '<div class="badminton-court">';
    out += courtLines;

    if (hasGame) {
      out += '<div class="court-side side-a">';
      out += pb(c.teamA[0], 'team-a');
      out += pb(c.teamA[1], 'team-a');
      out += '</div>';

      out += '<div class="vs">VS</div>';

      out += '<div class="court-side side-b">';
      out += pb(c.teamB[0], 'team-b');
      out += pb(c.teamB[1], 'team-b');
      out += '</div>';
    } else {
      out += '<div class="no-game">Waiting for players...</div>';
    }

    out += '<div class="court-net"></div>';
    out += '</div>';

    if (hasGame) {
      out += '<button class="complete-button" data-action="complete">Complete Game</button>';

      out += '<div class="court-action-buttons">';
      out += '<button data-action="edit-teams" class="btn-info">Edit</button>';
      out += '<button data-action="sitout" class="btn-warning">Swap</button>';
      out += '</div>';

      out += '<div class="winner-selection" style="display:none;">';
      out += '<button class="btn-primary" data-action="record-winner-a">Team A Won</button>';
      out += '<button class="btn-primary" data-action="record-winner-b">Team B Won</button>';
      out += '<button class="btn-secondary" data-action="cancel-win">Cancel</button>';
      out += '</div>';
    }

    out += '</div>';
  });

  var waiting = S.restingPlayers.slice();
  out += '<div class="waiting-list">';
  out += '<h3>Resting Players (' + waiting.length + ')</h3>';

  if (!waiting.length) {
    out += '<div class="empty-state"><div class="icon">😴</div><p>All players are on court!</p></div>';
  } else {
    out += '<div class="player-tag-container">';
    waiting.forEach(function(n) {
      out += '<div class="player-tag">' + pDot(n) + n + ' ' + pLbl(n) + '</div>';
    });
    out += '</div>';
  }

  out += '</div>';

  qs('#results').innerHTML = out;
}

 function rPromotionCourts() {
  var out = '';
  if (!P.courts.length) {
    qs('#results').innerHTML = rES('📈', 'No promotion courts.');
    return;
  }

  function pBox(name, teamClass) {
  return '<div class="player-box ' + teamClass + '">' +
    '<span>' + name + '</span>' +
  '</div>';
}

  P.courts.forEach(function(c, i) {
    var hasGame = c.players && c.players.length === 4;

    out += '<div class="court" data-court="' + i + '">';
    out += '<h3>' + gCL(i) + ' <span class="mode-badge">' + pLaneLabel(c.track || 'seed') + '</span></h3>';

    out += '<div class="badminton-court">';
    out += courtLines;

    if (hasGame) {
      out += '<div class="court-side side-a">';
      out += pBox(c.teamA[0], 'team-a');
      out += pBox(c.teamA[1], 'team-a');
      out += '</div>';

      out += '<div class="vs">VS</div>';

      out += '<div class="court-side side-b">';
      out += pBox(c.teamB[0], 'team-b');
      out += pBox(c.teamB[1], 'team-b');
      out += '</div>';
    } else {
      out += '<div class="no-game">Waiting for players...</div>';
    }

    out += '<div class="court-net"></div>';
    out += '</div>';

    if (hasGame) {
      out += '<button class="complete-button" data-action="p-complete">Complete Game</button>';

      out += '<div class="court-action-buttons">';
      out += '<button data-action="p-edit-teams" class="btn-info">Edit</button>';
      out += '<button data-action="p-swap" class="btn-warning">Swap</button>';
      out += '</div>';

      out += '<div class="winner-selection" style="display:none;">';
      out += '<button class="btn-primary" data-action="p-record-winner-a">Team A Won</button>';
      out += '<button class="btn-primary" data-action="p-record-winner-b">Team B Won</button>';
      out += '<button class="btn-secondary" data-action="p-cancel-win">Cancel</button>';
      out += '</div>';
    }

    out += '</div>';
  });

  function laneHtml(title, arr) {
    var s = '<div class="waiting-list"><h3>' + title + ' (' + arr.length + ')</h3>';
    if (!arr.length) {
      s += '<div class="empty-state"><div class="icon">😴</div><p>No players.</p></div>';
    } else {
      s += '<div class="player-tag-container">';
      arr.forEach(function(n) {
        s += '<div class="player-tag">' + n + '</div>';
      });
      s += '</div>';
    }
    s += '</div>';
    return s;
  }

  out += laneHtml('Seed Lane', P.seedPool);
  out += laneHtml('Winners Lane', P.winnersPool);
  out += laneHtml('Losers Lane', P.losersPool);

  qs('#results').innerHTML = out;
}

  /* ── History / Stats / About / Help ───────────────────── */
  function rHist() {
    var body = qs('#historyModalBody');
    if (!body) return;
    var h = [];
    if (MODE === 'promotion') h = P.matchHistory || [];
    else h = S.matchHistory || [];

    if (!h.length) {
      body.innerHTML = rES('📝', 'No match history yet.');
      return;
    }

    body.innerHTML = h.slice().reverse().map(function(m) {
      var tA = (m.teamA || []).join(' & ');
      var tB = (m.teamB || []).join(' & ');
      var wn = m.winner === 'A' ? tA : tB;
      return '<div class="history-item">' +
        '<strong>' + (m.courtName || ('Court ' + m.court)) + '</strong><br>' +
        tA + ' vs ' + tB + '<br>' +
        'Winner: <strong>' + wn + '</strong>' +
      '</div>';
    }).join('');
  }

  function rPS() {
    var box = qs('#player-stats-content');
    if (!box) return;

    var html = '';
    if (MODE === 'promotion') {
      html += '<h4>Promotion Stats</h4>';
      var act = activePromotionPlayers();
      if (!act.length) html += rES('📊', 'No players.');
      else {
        html += '<div class="stats-list">';
        act.forEach(function(n) {
          var pc = P.playCount[n] || {};
          html += '<div class="stats-row"><span>' + n + '</span><strong>' + (pc.wins || 0) + 'W / ' + (pc.losses || 0) + 'L</strong></div>';
        });
        html += '</div>';
      }
    } else {
      html += '<h4>Session Stats</h4>';
      var a = activeSessionPlayers();
      if (!a.length) html += rES('📊', 'No players.');
      else {
        html += '<div class="stats-list">';
        a.forEach(function(n) {
          var pc2 = S.playCount[n] || {};
          html += '<div class="stats-row"><span>' + n + '</span><strong>' + (pc2.wins || 0) + 'W / ' + (pc2.losses || 0) + 'L</strong></div>';
        });
        html += '</div>';
      }
    }

    box.innerHTML = html;
    var d = qs('#stats-date');
    if (d) d.textContent = new Date().toLocaleString();
  }
function rAbout(modeOverride) {
  var mode = modeOverride || MODE || 'session';
  var body = qs('#aboutModalBody');
  if (!body) return;

  function commonTips() {
    return '' +
      '<h4>General Tips</h4>' +
      '<ul>' +
        '<li><strong>Manage</strong> lets you add/remove players, adjust courts, and fix live matches.</li>' +
        '<li><strong>Undo</strong> can revert recent actions (limited history).</li>' +
        '<li><strong>Stats</strong> shows performance summaries.</li>' +
        '<li><strong>History</strong> logs completed matches.</li>' +
        '<li>Your data is saved locally on this device.</li>' +
      '</ul>';
  }

  var html = '';
  html += '<h3>BlackSheep Shuffler <span class="version-tag">v6.1.0</span></h3>';
  html += '<p>Smart badminton scheduling for different play formats.</p>';

  if (mode === 'session') {
    html += '' +
      '<h4>Session Mode (Shuffle)</h4>' +
      '<p>Best for casual club nights. The app continuously reshuffles players into fair doubles matches while reducing repeated pairings.</p>' +

      '<h4>How it works</h4>' +
      '<ol>' +
        '<li>Add players and assign each one a skill (Beginner / Intermediate / Advanced).</li>' +
        '<li>Set number of courts and tap <strong>Start</strong>.</li>' +
        '<li>Each court gets 4 players split into Team A vs Team B.</li>' +
        '<li>After a game, tap <strong>Complete Game</strong> and record the winner.</li>' +
        '<li>The system rotates players, tracks results, and generates the next fair games.</li>' +
      '</ol>' +

      '<h4>Balancing rules</h4>' +
      '<ul>' +
        '<li>Avoids extreme team imbalance where possible.</li>' +
        '<li>Reduces repeated teammates/opponents over time.</li>' +
        '<li>Supports RVB restriction when enabled in Admin Mode.</li>' +
      '</ul>' +

      '<h4>Session tools</h4>' +
      '<ul>' +
        '<li><strong>Edit Teams</strong>: rearrange current court teams.</li>' +
        '<li><strong>Swap Player</strong>: replace an on-court player with a resting player.</li>' +
        '<li><strong>Custom Game</strong>: schedule a specific 4-player match after X games.</li>' +
      '</ul>';
  }

  else if (mode === 'promotion') {
    html += '' +
      '<h4>Promotion / Relegation Mode (Queue)</h4>' +
      '<p>Best for ladder-style flow. Winners move upward, losers move downward, and teams reshuffle every game.</p>' +

      '<h4>Lane concept</h4>' +
      '<ul>' +
        '<li><strong>Seed Lane</strong>: starting pool for new/neutral players.</li>' +
        '<li><strong>Winners Lane</strong>: players who won recent games.</li>' +
        '<li><strong>Losers Lane</strong>: players who lost recent games.</li>' +
      '</ul>' +

      '<h4>How it works</h4>' +
      '<ol>' +
        '<li>Add players and set number of courts.</li>' +
        '<li>Tap <strong>Start Queue</strong>.</li>' +
        '<li>Games are generated from available lane pools.</li>' +
        '<li>Record winner: winners go up, losers go down.</li>' +
        '<li>System immediately refills empty courts from eligible pools.</li>' +
      '</ol>' +

      '<h4>Promotion tools</h4>' +
      '<ul>' +
        '<li><strong>Edit Teams</strong> on an active court.</li>' +
        '<li><strong>Swap Player</strong> with a waiting player from the same lane context.</li>' +
        '<li><strong>Custom Game</strong> scheduling (max 3 queued custom games).</li>' +
      '</ul>';
  }

  html += commonTips();
  html += '<p><em>Tip:</em> Use the Back button in setup to return to mode selection before starting.</p>';

  body.innerHTML = html;
}
  function rHelp() {
    var body = qs('#helpModalBody');
    if (!body) return;

    body.innerHTML =
      '<h4>Quick Help</h4>' +
      '<ol>' +
        '<li>Select a mode from the home screen.</li>' +
        '<li>Add players and set court count.</li>' +
        '<li>Start and record winners for each game.</li>' +
        '<li>Use Manage for edits, swaps, and admin tools.</li>' +
      '</ol>' +
      '<p>Tip: Your progress auto-saves in local storage.</p>';
  }

  /* ── Unified Render ────────────────────────────────────── */
  function rAll() {
    if (!MODE) return;

    if (MODE === 'session') rSessionCourts();
    else if (MODE === 'promotion') rPromotionCourts();

    pDD();
    updateUndoUI();
    save();
  }

  /* ── Delegated Events ──────────────────────────────────── */
  W.addEventListener('click', function(e) {
    var t = e.target.closest('button');
    if (!t) return;

    var id = t.id;

    if (
      id === 'backToModeSelectFromSession' ||
      id === 'backToModeSelectFromPromotion'
    ) {
      backToModeSelect();
      return;
    }

    var act = t.dataset.action;
    var pact = t.dataset.paction;
    var mgmt = t.dataset.mgmt;
    var pmgmt = t.dataset.pmgmt;
    var mgmtBackTo = t.dataset.mgmtBackTo;

    if (mgmt) { showMgmtPanel(mgmt); return; }
    if (pmgmt) { showPMgmtPanel(pmgmt); return; }

    if (t.hasAttribute('data-mgmt-back')) {
      qs('#mgmtMenuGrid').style.display = '';
      qsa('.mgmt-sub-panel').forEach(function(p) { p.classList.remove('active'); });
      return;
    }

    if (t.hasAttribute('data-pmgmt-back')) {
      var grid = qs('#pmgmtMenuGrid');
      if (grid) grid.style.display = '';
      var panels = qsa('.mgmt-sub-panel', qs('#promotionManageModal'));
      Array.prototype.forEach.call(panels, function(p) { p.classList.remove('active'); });
      return;
    }

    if (mgmtBackTo) {
      showMgmtPanel(mgmtBackTo);
      return;
    }

    if (t.matches('.close-modal-btn')) {
      var mo = t.closest('.modal-overlay');
      if (mo) cModal(mo.id);
      return;
    }

    var acts = {
      backToModeSelectFromSession: backToModeSelect,
      backToModeSelectFromPromotion: backToModeSelect,
	entryModeSingleBtn: function() { setPlayerEntryMode('single'); },
entryModeBulkBtn: function() { setPlayerEntryMode('bulk'); },
pEntryModeSingleBtn: function() { setPromotionEntryMode('single'); },
pEntryModeBulkBtn: function() { setPromotionEntryMode('bulk'); },

      selectSessionModeBtn: function() {
        MODE = 'session';
        showAppAfterModeSelect();
        qs('#setupControls').classList.remove('hidden');
        if (qs('#promotionSetupControls')) qs('#promotionSetupControls').classList.add('hidden');
      },
      selectPromotionModeBtn: function() {
        MODE = 'promotion';
        showAppAfterModeSelect();
        qs('#setupControls').classList.add('hidden');
        if (qs('#promotionSetupControls')) qs('#promotionSetupControls').classList.remove('hidden');
      },

      aboutBtn:  function() { oModal('aboutModal', function() { rAbout('session'); }); },
      pAboutBtn: function() { oModal('aboutModal', function() { rAbout('promotion'); }); },
      helpBtn: function() { oModal('helpModal', rHelp); },
      statsBtn: function() { oModal('statsModal', rPS); },
      historyBtn: function() { oModal('historyModal', rHist); },

      manageGameBtn: function() {
        if (MODE === 'promotion') { pDD(); oModal('promotionManageModal'); }
        else if (MODE === 'session') oModal('managementModal');
        else notify('Select a mode first.', 'error');
      },

      undoBtn: function() {
        if (MODE === 'promotion') cmdPromotion.undo();
        else cmdSession.undo();
      },

      resetGameBtn: function() {
        if (confirm('Are you sure? This will erase all data.')) {
          localStorage.removeItem('badmintonGameState');
          localStorage.removeItem('badmintonPromotionState');
          localStorage.removeItem('bdsMode');
	localStorage.removeItem('bdsAdminState');
          window.location.reload();
        }
      },

      adminModeBtn: function() { openAdminMode(); },

      pUndoBtn: function() { cmdPromotion.undo(); },
      pResetBtn: function() {
        if (confirm('Reset the promotion mode? This erases all promotion data.')) {
          localStorage.removeItem('badmintonPromotionState');
          localStorage.removeItem('bdsMode');
          window.location.reload();
        }
      },

      addPendingPlayerBtn: addPP,
      startBtn: initGame,

      pAddPlayerBtn: pAddPlayer,
      pStartBtn: pInitGame,

      addPlayerBtn: addMid,
      changeSkillBtn: chSkill,
      renamePlayerBtn: renP,
      removePlayerBtn: remP,
      reinstatePlayerBtn: reinstP,
      addCourtBtn: addCt,
      removeCourtBtn: remCt,
      renameCourtBtn: renCt,
      scheduleTempBtn: schTemp,

      pMgmtAddPlayerBtn: pAddMid,
      pRenamePlayerBtn: pRen,
      pRemovePlayerBtn: pRem,
      pReinstatePlayerBtn: pReinst,
      pAddCourtBtn: pAddCt,
      pRemoveCourtBtn: pRemCt,
      pRenameCourtBtn: pRenCt,
      pScheduleTempBtn: pSchTemp,

      saveTeamsBtn: function() {
        var i = parseInt(qs('#managementModal').dataset.editingCourt, 10);
        cmdSession.execute(SaveTeams(
          i,
          [qs('#editPlayerA1').value, qs('#editPlayerA2').value],
          [qs('#editPlayerB1').value, qs('#editPlayerB2').value]
        ));
      },

      pSaveTeamsBtn: function() {
        var i = parseInt(qs('#promotionManageModal').dataset.editingCourt, 10);
        cmdPromotion.execute(pSaveTeams(
          i,
          [qs('#pEditPlayerA1').value, qs('#pEditPlayerA2').value],
          [qs('#pEditPlayerB1').value, qs('#pEditPlayerB2').value]
        ));
      },

      confirmSwapBtn: function() {
        var i = parseInt(qs('#managementModal').dataset.editingCourt, 10);
        cmdSession.execute(SwapP(i, qs('#playerToSwapOut').value, qs('#playerToSwapIn').value));
      },

      pConfirmSwapBtn: function() {
        var i = parseInt(qs('#promotionManageModal').dataset.editingCourt, 10);
        cmdPromotion.execute(pSwapP(i, qs('#pPlayerToSwapOut').value, qs('#pPlayerToSwapIn').value));
      }
    };

    if (acts[id]) { acts[id](); return; }

    if (act) {
      var cd = t.closest('.court');
      if (!cd) return;
      var ci = parseInt(cd.dataset.court, 10);

      if (MODE === 'session') {
        if (act === 'complete') {
          qs('.winner-selection', cd).style.display = 'grid';
          qs('.complete-button', cd).style.display = 'none';
          var cab = qs('.court-action-buttons', cd);
          if (cab) cab.style.display = 'none';
        } else if (act === 'cancel-win') {
          qs('.winner-selection', cd).style.display = 'none';
          qs('.complete-button', cd).style.display = '';
          var cab2 = qs('.court-action-buttons', cd);
          if (cab2) cab2.style.display = 'grid';
        } else if (act === 'record-winner-a') {
          cmdSession.execute(RecWin(ci, 'A'));
        } else if (act === 'record-winner-b') {
          cmdSession.execute(RecWin(ci, 'B'));
        } else if (act === 'edit-teams') {
          oEdit(ci);
        } else if (act === 'sitout') {
          oSwap(ci);
        } else if (act === 'cancel-submodal') {
          if (qs('#managementModal').dataset.openedFromCourt === 'true') {
            cModal('managementModal');
          } else {
            qs('#mgmtMenuGrid').style.display = '';
            qsa('.mgmt-sub-panel').forEach(function(p) { p.classList.remove('active'); });
          }
        }
      } else if (MODE === 'promotion') {
        if (act === 'p-complete') {
          qs('.winner-selection', cd).style.display = 'grid';
          qs('.complete-button', cd).style.display = 'none';
          var pcab = qs('.court-action-buttons', cd);
          if (pcab) pcab.style.display = 'none';
        } else if (act === 'p-cancel-win') {
          qs('.winner-selection', cd).style.display = 'none';
          qs('.complete-button', cd).style.display = '';
          var pcab2 = qs('.court-action-buttons', cd);
          if (pcab2) pcab2.style.display = 'grid';
        } else if (act === 'p-record-winner-a') {
          cmdPromotion.execute(pRecWin(ci, 'A'));
        } else if (act === 'p-record-winner-b') {
          cmdPromotion.execute(pRecWin(ci, 'B'));
        } else if (act === 'p-edit-teams') {
          pOpenEdit(ci);
        } else if (act === 'p-swap') {
          pOpenSwap(ci);
        }
      }
    }

    if (pact === 'cancel-submodal') {
      if (qs('#promotionManageModal').dataset.openedFromCourt === 'true') {
        cModal('promotionManageModal');
      } else {
        var grid2 = qs('#pmgmtMenuGrid');
        if (grid2) grid2.style.display = '';
        var panels2 = qsa('.mgmt-sub-panel', qs('#promotionManageModal'));
        Array.prototype.forEach.call(panels2, function(p) { p.classList.remove('active'); });
      }
    }
  });

  /* ── Non-button delegated clicks ───────────────────────── */
  W.addEventListener('click', function(e) {
    var btn1 = e.target.closest('button[data-remove-index]');
    if (btn1) {
      var i1 = parseInt(btn1.dataset.removeIndex, 10);
      if (!isNaN(i1)) {
        PP.splice(i1, 1);
        rPL();
      }
      return;
    }

    var btn2 = e.target.closest('button[data-premove-index]');
    if (btn2) {
      var i2 = parseInt(btn2.dataset.premoveIndex, 10);
      if (!isNaN(i2)) {
        PR.splice(i2, 1);
        pRenderPendingPlayers();
      }
      return;
    }
  });

  /* ── Inputs / Validation hooks ─────────────────────────── */
  if (qs('#courtCount')) qs('#courtCount').addEventListener('input', valStart);
  if (qs('#pCourtCount')) qs('#pCourtCount').addEventListener('input', pValStart);

  /* ── Startup ───────────────────────────────────────────── */
  lTheme();
  showModeSelect();
  rPL();
  pRenderPendingPlayers();
  pDD();
setPlayerEntryMode('single');
setPromotionEntryMode('single');
  load();
});