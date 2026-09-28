/* TIRKI — Tres en línea clásico. Tú = X, la computadora = O. Estilo cartoons. */
(function (global) {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }

  var WIN_LINES = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
  ];

  /* ===================== modos ===================== */

  var MODES = [
    { id: 0, name: 'FÁCIL', tag: 'La compu juega al azar', color: '#57CC99', ai: 0 },
    { id: 1, name: 'MEDIO', tag: 'La compu gana y bloquea', color: '#FF9F1C', ai: 1 },
    { id: 2, name: 'DIFÍCIL', tag: 'La compu juega perfecto', color: '#EF476F', ai: 2 }
  ];

  function modeById(id) {
    for (var i = 0; i < MODES.length; i++) if (MODES[i].id === id) return MODES[i];
    return MODES[0];
  }

  /* ===================== audio ===================== */

  var sfx = {
    ctx: null, master: null, muted: false,
    boot: function () {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
      var AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) return;
      try {
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.3;
        this.master.connect(this.ctx.destination);
      } catch (e) { this.ctx = null; }
    },
    tone: function (f, dur, type, delay, vol, glide) {
      if (!this.ctx || this.muted) return;
      var t0 = this.ctx.currentTime + (delay || 0);
      var o = this.ctx.createOscillator();
      var g = this.ctx.createGain();
      o.type = type || 'triangle';
      o.frequency.setValueAtTime(f, t0);
      if (glide) o.frequency.exponentialRampToValueAtTime(Math.max(30, glide), t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol || 0.3, t0 + 0.014);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(this.master);
      o.start(t0); o.stop(t0 + dur + 0.03);
    },
    buzz: function (dur, delay, vol) {
      if (!this.ctx || this.muted) return;
      var t0 = this.ctx.currentTime + (delay || 0);
      var len = Math.floor(this.ctx.sampleRate * dur);
      var buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      var data = buf.getChannelData(0);
      for (var i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      var src = this.ctx.createBufferSource();
      var f = this.ctx.createBiquadFilter();
      var g = this.ctx.createGain();
      f.type = 'lowpass'; f.frequency.value = 900;
      g.gain.value = vol || 0.22;
      src.buffer = buf; src.connect(f); f.connect(g); g.connect(this.master);
      src.start(t0);
    },
    play: function (name) {
      if (!this.ctx || this.muted) return;
      var i;
      switch (name) {
        case 'click': this.tone(920, 0.045, 'triangle', 0, 0.16, 1180); break;
        case 'place': this.tone(620 + Math.random() * 80, 0.07, 'triangle', 0, 0.2, 760); break;
        case 'cpu': this.tone(430 + Math.random() * 50, 0.08, 'triangle', 0, 0.18, 330); break;
        case 'bad': this.tone(190, 0.2, 'sawtooth', 0, 0.13, 120); this.buzz(0.14, 0, 0.12); break;
        case 'win':
          var mel = [523, 659, 784, 1047, 784, 1047, 1319];
          for (i = 0; i < mel.length; i++) this.tone(mel[i], i === mel.length - 1 ? 0.5 : 0.12, 'triangle', i * 0.1, 0.22);
          break;
        case 'lose':
          var fall = [494, 415, 330, 247];
          for (i = 0; i < fall.length; i++) this.tone(fall[i], 0.22, 'sawtooth', i * 0.14, 0.12);
          break;
        case 'tie':
          this.tone(622, 0.16, 'triangle', 0, 0.18);
          this.tone(494, 0.18, 'triangle', 0.14, 0.18);
          break;
      }
    }
  };

  /* ===================== confeti ===================== */

  function confetti(count) {
    var fx = $('#fx');
    if (!fx) return;
    fx.textContent = '';
    var colors = ['#EF476F', '#4CC9F0', '#FFD93B', '#9B5DE5', '#57CC99', '#FF9F1C'];
    for (var i = 0; i < count; i++) {
      var d = document.createElement('i');
      d.className = 'confetti';
      d.style.left = (Math.random() * 100).toFixed(2) + 'vw';
      d.style.background = colors[i % colors.length];
      d.style.setProperty('--d', (1.5 + Math.random() * 1.7).toFixed(2) + 's');
      d.style.setProperty('--r', (360 + Math.random() * 900).toFixed(0) + 'deg');
      d.style.animationDelay = (Math.random() * 0.55).toFixed(2) + 's';
      fx.appendChild(d);
    }
    setTimeout(function () { fx.textContent = ''; }, 4400);
  }

  /* ===================== marcador persistente ===================== */

  var SCORE_KEY = 'tirkiScoreV1';
  var score = { w: 0, l: 0, d: 0 };

  function loadScore() {
    try {
      var raw = global.localStorage && global.localStorage.getItem(SCORE_KEY);
      if (raw) {
        var o = JSON.parse(raw);
        return { w: o.w | 0, l: o.l | 0, d: o.d | 0 };
      }
    } catch (e) {}
    return { w: 0, l: 0, d: 0 };
  }

  function saveScore() {
    try {
      if (global.localStorage) global.localStorage.setItem(SCORE_KEY, JSON.stringify(score));
    } catch (e) {}
  }

  function renderScore() {
    if (!scX) return;
    scX.textContent = score.w;
    scT.textContent = score.d;
    scO.textContent = score.l;
  }

  /* ===================== estado ===================== */

  var G = {
    screen: 'menu',
    mode: 0,
    cells: null,
    turn: 'X',
    playerFirst: true,
    busy: false,
    over: false,
    winLine: null,
    nextPlayerFirst: true
  };

  /* ===================== llamadas de la mascota ===================== */

  var LINES = {
    hello: ['¡Hola! Soy Tirki. Tú juegas con la X', '¡A por el tres en línea!'],
    youStart: ['Tú abres con la X, ¡a darle!', 'Marca una casilla, ¡tú primero!'],
    cpuStarts: ['Esta vez empiece yo con la O', '¡Esta partida la abro yo!'],
    thinking: ['Deja que piense un momentito…', 'Mmm, ¿me conviene aquí?', 'Estrategia en progreso…', 'Esto no es tan fácil como parece'],
    afterCpu: ['Jajajá, ¡cuidado con mi O!', 'Ahí va eso…', 'No te lo voy a poner fácil'],
    playerWin: ['¡Tres en línea! ¡Impresionante!', '¡Misión cumplida, campeón!'],
    playerLose: ['¡Gané esta! ¿Otra?', 'Jeje, la compu también sabe ganar'],
    draw: ['¡Empate de la amistad!', 'Uy, tablas… ¡de nuevo!'],
    cushion: ['Buena jugada', 'Interesante…', 'Eso, eso…']
  };

  /* ===================== elementos del DOM ===================== */

  var tic, cellEls = [], modePicker, hudMode, turnBadge, loader,
    overlayResult, resultCard, resultTitle, resultStats,
    overlayRules, scX, scT, scO;

  var bubbles = [];
  var moodTimer = 0, lastSay = 0;

  function setMood(mood) {
    $$('[data-mascot]').forEach(function (m) { m.dataset.mood = mood; });
  }

  function say(text, mood, ms, force) {
    ms = ms || 2800;
    var nowMs = Date.now();
    if (!force && nowMs - lastSay < 650) return;
    lastSay = nowMs;
    for (var i = 0; i < bubbles.length; i++) {
      var b = bubbles[i];
      b.text.textContent = text;
      b.el.hidden = false;
      b.el.style.animation = 'none';
      void b.el.offsetWidth;
      b.el.style.animation = '';
      clearTimeout(b.timer);
      (function (bb) { bb.timer = setTimeout(function () { bb.el.hidden = true; }, ms); })(b);
    }
    if (mood) {
      setMood(mood);
      clearTimeout(moodTimer);
      moodTimer = setTimeout(function () { setMood('idle'); }, ms);
    }
  }

  var eyeRaf = 0, eyeTarget = { x: 0, y: 0 };
  function applyEyes() {
    var dx = (eyeTarget.x * 5).toFixed(2);
    var dy = (eyeTarget.y * 3.6).toFixed(2);
    $$('.m-pupil--l').forEach(function (p) { p.style.transform = 'translate(' + dx + 'px,' + dy + 'px)'; });
    $$('.m-pupil--r').forEach(function (p) { p.style.transform = 'translate(' + dx + 'px,' + dy + 'px)'; });
  }

  /* ===================== navegación ===================== */

  function go(screen) {
    G.screen = screen;
    document.body.dataset.screen = screen;
  }

  function toMenu() {
    overlayResult.hidden = true;
    go('menu');
    sfx.play('click');
  }

  /* ===================== modos ===================== */

  function buildModePicker() {
    modePicker.textContent = '';
    MODES.forEach(function (m) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'diff';
      b.style.setProperty('--c', m.color);
      b.style.setProperty('--rot', (m.id % 2 ? -1.3 : 1.3) + 'deg');
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', m.id === G.mode ? 'true' : 'false');
      b.innerHTML = '<span class="diff__face" aria-hidden="true"></span>' +
        '<span class="diff__name">' + m.name + '</span>' +
        '<span class="diff__tag">' + m.tag + '</span>';
      b.addEventListener('click', function () { selectMode(m.id); });
      modePicker.appendChild(b);
    });
  }

  function selectMode(id) {
    G.mode = id;
    $$('.diff', modePicker).forEach(function (b, i) {
      b.setAttribute('aria-checked', MODES[i].id === G.mode ? 'true' : 'false');
    });
    var m = modeById(G.mode);
    if (hudMode) {
      hudMode.textContent = m.name;
      hudMode.style.setProperty('--c', m.color);
    }
    sfx.play('click');
  }

  /* ===================== tablero ===================== */

  function buildBoard() {
    for (var i = 0; i < 9; i++) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'tcell';
      b.dataset.i = i;
      b.setAttribute('aria-label', 'Casilla ' + (i + 1));
      (function (idx, el) {
        el.addEventListener('click', function () { onCell(idx); });
      })(i, b);
      tic.appendChild(b);
      cellEls.push(b);
    }
  }

  function startRound() {
    G.cells = ['', '', '', '', '', '', '', '', ''];
    G.busy = false;
    G.over = false;
    G.winLine = null;
    G.playerFirst = G.nextPlayerFirst;
    G.nextPlayerFirst = !G.nextPlayerFirst;
    G.turn = 'X';
    renderBoard();
    updateTurn();
    if (G.playerFirst) {
      say(pick(LINES.youStart), 'happy', 2400);
    } else {
      say(pick(LINES.cpuStarts), 'thinking', 2200);
      scheduleCpu();
    }
  }

  function renderBoard() {
    for (var i = 0; i < 9; i++) {
      var el = cellEls[i];
      var cls = 'tcell';
      if (G.cells[i]) cls += ' is-' + G.cells[i].toLowerCase();
      if (G.winLine && G.winLine.indexOf(i) !== -1) cls += ' is-win';
      el.className = cls;
      el.disabled = !!G.cells[i] || G.over;
    }
    tic.classList.toggle('is-over', G.over);
  }

  function updateTurn() {
    if (!turnBadge) return;
    if (G.over) return;
    if (G.turn === 'X') {
      turnBadge.textContent = 'Tu turno — juegas con la X';
      turnBadge.classList.remove('is-wait');
    } else {
      turnBadge.textContent = 'Tirki piensa con la O…';
      turnBadge.classList.add('is-wait');
    }
  }

  function onCell(i) {
    if (G.busy || G.over || G.turn !== 'X' || G.cells[i]) { sfx.play('bad'); return; }
    if (place('X', i)) return;
    scheduleCpu();
  }

  function place(sym, i) {
    G.cells[i] = sym;
    var el = cellEls[i];
    el.classList.add('is-' + sym.toLowerCase(), 'just-placed');
    el.disabled = true;
    setTimeout(function () { el.classList.remove('just-placed'); }, 340);
    sfx.play(sym === 'X' ? 'place' : 'cpu');
    if (endedAfterMove()) return true;
    G.turn = sym === 'X' ? 'O' : 'X';
    updateTurn();
    return false;
  }

  function endedAfterMove() {
    var res = computeWinner();
    if (!res) return false;
    G.over = true;
    G.winLine = res.line;
    renderBoard();
    if (res.winner === 'X') {
      score.w++; saveScore(); renderScore();
      sfx.play('win');
      confetti(50);
      say(pick(LINES.playerWin), 'cheer', 3200);
      showResult('win');
    } else if (res.winner === 'O') {
      score.l++; saveScore(); renderScore();
      sfx.play('lose');
      say(pick(LINES.playerLose), 'oops', 3200);
      showResult('lose');
    } else {
      score.d++; saveScore(); renderScore();
      sfx.play('tie');
      say(pick(LINES.draw), 'happy', 3000);
      showResult('tie');
    }
    return true;
  }

  function computeWinner() {
    for (var i = 0; i < WIN_LINES.length; i++) {
      var a = WIN_LINES[i][0], b = WIN_LINES[i][1], c = WIN_LINES[i][2];
      if (G.cells[a] && G.cells[a] === G.cells[b] && G.cells[a] === G.cells[c]) {
        return { winner: G.cells[a], line: WIN_LINES[i] };
      }
    }
    for (var j = 0; j < 9; j++) if (!G.cells[j]) return null;
    return { winner: '', line: null };
  }

  /* ===================== IA ===================== */

  function emptyCells(cells) {
    var out = [];
    for (var i = 0; i < 9; i++) if (!cells[i]) out.push(i);
    return out;
  }

  function winningMove(cells, sym) {
    var e = emptyCells(cells);
    for (var i = 0; i < e.length; i++) {
      cells[e[i]] = sym;
      var w = false;
      for (var k = 0; k < WIN_LINES.length; k++) {
        var L = WIN_LINES[k];
        if (cells[L[0]] === sym && cells[L[1]] === sym && cells[L[2]] === sym) { w = true; break; }
      }
      cells[e[i]] = '';
      if (w) return e[i];
    }
    return -1;
  }

  function minimax(cells, isMe, me, you) {
    var res = null;
    for (var k = 0; k < WIN_LINES.length; k++) {
      var L = WIN_LINES[k];
      if (cells[L[0]] && cells[L[0]] === cells[L[1]] && cells[L[0]] === cells[L[2]]) {
        res = { winner: cells[L[0]] };
        break;
      }
    }
    if (res) {
      if (res.winner === me) return 1;
      if (res.winner === you) return -1;
      return 0;
    }
    var e = emptyCells(cells);
    if (!e.length) return 0;
    var best = isMe ? -Infinity : Infinity;
    for (var i = 0; i < e.length; i++) {
      cells[e[i]] = isMe ? me : you;
      var v = minimax(cells, !isMe, me, you);
      cells[e[i]] = '';
      if (isMe) best = Math.max(best, v);
      else best = Math.min(best, v);
    }
    return best;
  }

  function bestMove(cells, me, you) {
    var e = emptyCells(cells);
    var best = -Infinity, picks = [];
    for (var i = 0; i < e.length; i++) {
      cells[e[i]] = me;
      var v = minimax(cells, false, me, you);
      cells[e[i]] = '';
      if (v > best) { best = v; picks = [e[i]]; }
      else if (v === best) picks.push(e[i]);
    }
    return pick(picks);
  }

  function aiPick(mode, cells) {
    var e = emptyCells(cells);
    if (!e.length) return -1;
    if (mode === 0) return pick(e);
    var me = 'O', you = 'X';
    var w = winningMove(cells, me);
    if (w !== -1) return w;
    if (mode === 1) {
      var b = winningMove(cells, you);
      if (b !== -1) return b;
      if (!cells[4]) return 4;
      var corners = [0, 2, 6, 8].filter(function (i) { return !cells[i]; });
      if (corners.length) return pick(corners);
      return pick(e);
    }
    return bestMove(cells, me, you);
  }

  function scheduleCpu() {
    G.busy = true;
    updateTurn();
    loader.hidden = false;
    say(pick(LINES.thinking), 'thinking', 1100);
    setTimeout(function () { cpuTurn(); }, 420 + Math.random() * 360);
  }

  function cpuTurn() {
    loader.hidden = true;
    var i = aiPick(modeById(G.mode).ai, G.cells);
    if (i === -1) { G.busy = false; return; }
    var ended = place('O', i);
    if (!ended) {
      G.busy = false;
      updateTurn();
      say(pick(LINES.afterCpu), 'happy', 1800);
    }
  }

  /* ===================== resultado ===================== */

  function showResult(kind) {
    resultCard.className = 'card';
    if (kind === 'win') {
      resultTitle.textContent = '¡GANASTE!';
      resultStats.textContent = 'Cierras el marcador: Tú ' + score.w + ' · Empates ' + score.d + ' · Compu ' + score.l;
    } else if (kind === 'lose') {
      resultCard.classList.add('card--lose');
      resultTitle.textContent = '¡PERDISTE!';
      resultStats.textContent = 'La compu suma esta vez. Tú ' + score.w + ' · Empates ' + score.d + ' · Compu ' + score.l;
    } else {
      resultCard.classList.add('card--tie');
      resultTitle.textContent = '¡EMPATE!';
      resultStats.textContent = 'Nadie suma. Tú ' + score.w + ' · Empates ' + score.d + ' · Compu ' + score.l;
    }
    overlayResult.hidden = false;
  }

  /* ===================== sonido ===================== */

  function setMuted(m) {
    sfx.muted = m;
    $$('[id^="btnSound"]').forEach(function (b) { b.setAttribute('aria-pressed', m ? 'false' : 'true'); });
    document.body.classList.toggle('is-muted', m);
  }

  function toggleSound() {
    sfx.boot();
    setMuted(!sfx.muted);
    if (!sfx.muted) sfx.play('click');
  }

  /* ===================== teclado ===================== */

  document.addEventListener('keydown', function (ev) {
    var k = ev.key;
    if (k === 'Escape') {
      if (!overlayRules.hidden) { overlayRules.hidden = true; return; }
      if (!overlayResult.hidden) { toMenu(); return; }
      if (G.screen === 'game') toMenu();
      return;
    }
    if (k === 'm' || k === 'M') { toggleSound(); return; }
    if ((k === 'r' || k === 'R') && G.screen === 'game') { sfx.boot(); startRound(); return; }
    if (k === '1' && G.screen === 'game') { selectMode(0); }
    else if (k === '2' && G.screen === 'game') { selectMode(1); }
    else if (k === '3' && G.screen === 'game') { selectMode(2); }
  });

  /* ===================== arranque ===================== */

  function boot() {
    score = loadScore();

    tic = $('#tic');
    modePicker = $('#modePicker');
    hudMode = $('#hudMode');
    turnBadge = $('#turnBadge');
    loader = $('#loader');
    overlayResult = $('#overlayResult');
    resultCard = $('#resultCard');
    resultTitle = $('#resultTitle');
    resultStats = $('#resultStats');
    overlayRules = $('#overlayRules');
    scX = $('#scX');
    scT = $('#scT');
    scO = $('#scO');

    var tpl = $('#tplStage');
    $$('[data-stage]').forEach(function (host) {
      host.appendChild(tpl.content.cloneNode(true));
    });
    $$('[data-bubble]').forEach(function (el) {
      bubbles.push({ el: el, text: $('[data-bubble-text]', el), timer: 0 });
    });

    buildBoard();
    buildModePicker();
    renderScore();

    $('#btnPlay').addEventListener('click', function () {
      sfx.boot();
      sfx.play('click');
      go('game');
      startRound();
    });
    $('#btnGameMenu').addEventListener('click', function () { sfx.play('click'); toMenu(); });
    $('#btnRestart').addEventListener('click', function () { sfx.boot(); startRound(); });
    $('#btnRulesMenu').addEventListener('click', function () { sfx.play('click'); overlayRules.hidden = false; });
    $('#btnRulesGame').addEventListener('click', function () { sfx.play('click'); overlayRules.hidden = false; });
    $('#rulesClose').addEventListener('click', function () { sfx.play('click'); overlayRules.hidden = true; });
    $('#btnSoundMenu').addEventListener('click', toggleSound);
    $('#btnSoundGame').addEventListener('click', toggleSound);
    $('#btnResetScore').addEventListener('click', function () {
      sfx.play('click');
      score = { w: 0, l: 0, d: 0 };
      saveScore();
      renderScore();
      say('Marcador a cero. ¡Empezamos de nuevo!', 'happy', 2600, true);
    });
    $('#ovAgain').addEventListener('click', function () { sfx.play('click'); overlayResult.hidden = true; startRound(); });
    $('#ovMenu').addEventListener('click', function () { sfx.play('click'); toMenu(); });
    overlayRules.addEventListener('click', function (ev) { if (ev.target === overlayRules) overlayRules.hidden = true; });

    document.addEventListener('pointermove', function (ev) {
      eyeTarget.x = (ev.clientX / Math.max(1, global.innerWidth) - 0.5) * 2;
      eyeTarget.y = (ev.clientY / Math.max(1, global.innerHeight) - 0.5) * 2;
      if (!eyeRaf) eyeRaf = requestAnimationFrame(function () { eyeRaf = 0; applyEyes(); });
    });

    setMuted(false);
    go('menu');
    setMood('idle');
    say(pick(LINES.hello), 'happy', 4200, true);

    global.TIRKI = {
      debug: {
        setMode: function (i) { selectMode(i); },
        play: function (i) { if (G.screen === 'game') onCell(i); },
        state: function () { return { cells: G.cells ? G.cells.slice() : null, turn: G.turn, over: G.over, mode: G.mode, score: { w: score.w, l: score.l, d: score.d } }; },
        newGame: function () { if (G.screen === 'game') startRound(); }
      }
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

})(typeof window !== 'undefined' ? window : globalThis);