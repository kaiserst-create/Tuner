// Tuner: Metronom
// Oben Taktarten, Betonungen, Zeitplan, Tippen fürs Tempo und die Klickklänge ohne Bezug zur Seite
// (skripte/pruefen.js testet sie), unten die Ansicht mit Planer, Anzeige und Bedienung.
// Geplant wird mit der Uhr der Klangausgabe: Solange es läuft, legt ein kurzer Timer immer die Klicks
// der nächsten Zehntelsekunde fest. So bleibt der Takt genau, auch wenn die Seite kurz hakt.
var SC_METRONOM = (function () {
  'use strict';

  // ------------------------------------------------------------------ Taktarten
  var BPM_MIN = 30, BPM_MAX = 250, BPM_STANDARD = 80;
  var TAKTARTEN = [
    { id: '2/4', zaehler: 2, nenner: 4, gruppen: [2] },
    { id: '3/4', zaehler: 3, nenner: 4, gruppen: [3] },
    { id: '4/4', zaehler: 4, nenner: 4, gruppen: [4] },
    { id: '6/8', zaehler: 6, nenner: 8, gruppen: [3, 3] },
  ];
  var TAKT_STANDARD = '4/4';
  var ZAEHLER_MAX = 16, NENNER = [2, 4, 8, 16];
  var EIGEN_STANDARD = { zaehler: 7, nenner: 8 };   // die eigene Taktart beginnt mit 7/8
  var TEILUNGEN = [1, 2, 3];                        // Klicks je Schlag: Schlag, halbiert, Triolen
  var NOTE = { 2: 'Halbe', 4: 'Viertel', 8: 'Achtel', 16: '16tel', 32: '32tel' };
  var TAP_PAUSE = 2000;   // längere Pause beim Tippen: neu anfangen
  var TAP_ANZAHL = 6;     // höchstens so viele Abstände zählen

  function summe(a) { return a.reduce(function (s, x) { return s + x; }, 0); }

  // Betonung von selbst: Achtel und Sechzehntel in Dreier- und Zweiergruppen, sonst nur die Eins
  function autoGruppen(zaehler, nenner) {
    if (nenner < 8 || zaehler <= 3) return [zaehler];
    var g = [], rest = zaehler;
    if (zaehler % 3 === 0) { while (rest > 0) { g.push(3); rest -= 3; } return g; }   // 9/8 = 3+3+3
    if (rest % 2) { g.push(3); rest -= 3; }                                          // ungerade: am Ende eine Drei
    while (rest > 0) { g.unshift(2); rest -= 2; }                                     // 7/8 = 2+2+3, 5/8 = 2+3
    return g;
  }
  // Eingabe wie „2+2+3“, auch mit Leerzeichen, Komma oder Punkt dazwischen.
  // Ergebnis: die Gruppen oder null, wenn die Eingabe leer ist oder nicht zu den Schlägen passt.
  function liesGruppen(text, zaehler) {
    var t = String(text === undefined || text === null ? '' : text).trim();
    if (!/^\d+(?:[\s+,.]+\d+)*$/.test(t)) return null;
    var g = t.split(/[\s+,.]+/).map(Number);
    if (g.some(function (x) { return x < 1; }) || summe(g) !== zaehler) return null;
    return g;
  }
  function gruppenText(g) { return g.join('+'); }

  // Taktart aus den Einstellungen: { name, zaehler, nenner, gruppen, eigen }
  function takt(S) {
    if (S.mTakt !== 'eigen') {
      var t = TAKTARTEN.filter(function (x) { return x.id === S.mTakt; })[0] || TAKTARTEN[2];
      return { name: t.id, zaehler: t.zaehler, nenner: t.nenner, gruppen: t.gruppen.slice(), eigen: false };
    }
    var g = liesGruppen(S.mGruppen, S.mZaehler) || autoGruppen(S.mZaehler, S.mNenner);
    return { name: S.mZaehler + '/' + S.mNenner, zaehler: S.mZaehler, nenner: S.mNenner, gruppen: g, eigen: true };
  }
  function taktName(t) { return t.name + (t.eigen && t.gruppen.length > 1 ? ' · ' + gruppenText(t.gruppen) : ''); }
  // Namen der Unterteilung passend zum Notenwert: bei 4/4 Viertel, Achtel, Triolen
  function teilungNamen(nenner) { return [NOTE[nenner], NOTE[nenner * 2], 'Triolen']; }

  // Was für ein Klick an dieser Stelle kommt: eins, gruppe (Anfang einer weiteren Gruppe), schlag oder unter
  function art(t, betonung, schlag, unter) {
    if (unter) return 'unter';
    if (!betonung) return 'schlag';
    if (schlag === 0) return 'eins';
    for (var i = 0, s = 0; i < t.gruppen.length - 1; i++) { s += t.gruppen[i]; if (s === schlag) return 'gruppe'; }
    return 'schlag';
  }

  // Klicks bis zur Zeit „bis“ (Sekunden der Klangausgabe). z = { t: Zeit des nächsten Klicks, pos: Stelle im Takt }
  // wird dabei weitergeschoben. o = { bpm, takt, teilung, betonung }. Das Tempo zählt die Schläge, bei 6/8 also Achtel.
  function naechste(z, o, bis) {
    var n = o.takt.zaehler * o.teilung, schritt = 60 / o.bpm / o.teilung, liste = [];
    if (!(z.pos >= 0 && z.pos < n)) z.pos = 0;
    while (z.t < bis) {
      var schlag = Math.floor(z.pos / o.teilung), unter = z.pos % o.teilung;
      liste.push({ t: z.t, schlag: schlag, unter: unter, art: art(o.takt, o.betonung, schlag, unter) });
      z.t += schritt;
      z.pos = (z.pos + 1) % n;
    }
    return liste;
  }
  // Hing die Seite länger, als vorausgeplant war: verpasste Klicks fallen aus, der Takt läuft im selben Raster weiter
  function ueberspringen(z, o, ab) {
    var n = o.takt.zaehler * o.teilung, schritt = 60 / o.bpm / o.teilung, k = 0;
    if (!(z.pos >= 0 && z.pos < n)) z.pos = 0;
    while (z.t < ab) { z.t += schritt; z.pos = (z.pos + 1) % n; k++; }
    return k;
  }

  // Tempo aus den Zeitpunkten beim Tippen (Millisekunden, der letzte zuletzt). null, solange es nicht reicht.
  function tapTempo(zeiten) {
    var ab = [];
    for (var i = zeiten.length - 1; i > 0 && ab.length < TAP_ANZAHL; i--) {
      var d = zeiten[i] - zeiten[i - 1];
      if (!(d > 0) || d > TAP_PAUSE) break;
      ab.push(d);
    }
    if (!ab.length) return null;
    var m = ab.slice().sort(function (a, b) { return a - b; })[ab.length >> 1];
    var gut = ab.filter(function (d) { return d > m * 0.6 && d < m * 1.4; });   // verrutschte Tipper zählen nicht
    var bpm = Math.round(60000 / (summe(gut) / gut.length));
    return Math.max(BPM_MIN, Math.min(BPM_MAX, bpm));
  }

  // Klickklang: kurzer Ton mit schnellem Abklingen und hellem Anschlag wie ein Holzblock.
  // Die Eins ist am höchsten, Unterteilungen sind leise.
  var KLICKS = {
    eins: { f: 1760, laut: 0.95 }, gruppe: { f: 1318.5, laut: 0.8 }, schlag: { f: 1046.5, laut: 0.7 }, unter: { f: 880, laut: 0.38 },
  };
  function klickDaten(was, sr) {
    var k = KLICKS[was] || KLICKS.schlag, len = Math.floor(sr * 0.05), d = new Float32Array(len), max = 0, j;
    var ein = Math.max(1, Math.floor(sr * 0.0006)), aus = Math.floor(sr * 0.004);
    for (j = 0; j < len; j++) {
      var t = j / sr;
      var v = Math.sin(2 * Math.PI * k.f * t) * Math.exp(-t / 0.010) + 0.4 * Math.sin(2 * Math.PI * k.f * 2.76 * t) * Math.exp(-t / 0.0035);
      if (j < ein) v *= j / ein;
      if (j > len - aus) v *= (len - j) / aus;
      d[j] = v;
      if (Math.abs(v) > max) max = Math.abs(v);
    }
    for (j = 0; j < len; j++) d[j] *= k.laut / max;
    return d;
  }

  // ------------------------------------------------------------------ Ansicht
  var A = null;       // Verbindung zur App: { S, speichern }
  var el = {}, puffer = null, pufferRate = 0, tipps = [], wach = null, blinkt = 0;
  var VORAUS = 0.2, TAKT_MS = 25;   // so weit im Voraus planen (Sekunden), so oft nachsehen (Millisekunden)
  var lauf = { an: false, z: null, plan: [], timer: 0, raf: 0, gezeigt: -1, verpasst: 0 };
  var ICON_PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l12.5-7.5z"/></svg>';
  var ICON_STOPP = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="1.5"/></svg>';

  function $(id) { return document.getElementById(id); }
  function optionen() { return { bpm: A.S.mTempo, takt: takt(A.S), teilung: A.S.mTeilung, betonung: A.S.mBetonung }; }
  function waehle(box, schluessel, wert) {
    box.querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-checked', String(b.dataset[schluessel] === String(wert))); });
  }

  function render() {
    var S = A.S, t = takt(S), namen = teilungNamen(t.nenner);
    waehle(el.takt, 'takt', S.mTakt);
    el.eigen.hidden = S.mTakt !== 'eigen';
    if (S.mTakt === 'eigen') renderEigen();
    el.teilung.querySelectorAll('button').forEach(function (b, i) { b.textContent = namen[i]; });
    waehle(el.teilung, 'teilung', S.mTeilung);
    el.betonung.setAttribute('aria-pressed', String(S.mBetonung));
    renderTakt();
    renderTempo();
    knopf();
  }
  function renderEigen() {
    var S = A.S, auto = autoGruppen(S.mZaehler, S.mNenner), leer = !S.mGruppen.trim(), g = liesGruppen(S.mGruppen, S.mZaehler);
    el.zaehler.textContent = S.mZaehler;
    waehle(el.nenner, 'nenner', S.mNenner);
    el.gruppen.placeholder = gruppenText(auto);
    if (document.activeElement !== el.gruppen) el.gruppen.value = S.mGruppen;
    var falsch = !leer && !g;
    el.gruppenHinweis.classList.toggle('warm', falsch);
    el.gruppenHinweis.textContent = falsch
      ? 'Die Gruppen müssen zusammen ' + S.mZaehler + ' ergeben. Bis dahin gilt ' + (auto.length > 1 ? gruppenText(auto) : 'nur die Eins') + '.'
      : 'Betonte Gruppen mit Plus, zum Beispiel 3+2+2. Leer lassen: ' + (auto.length > 1 ? gruppenText(auto) : 'nur die Eins') + '.';
  }
  function renderTakt() {   // Name der Taktart und ein Punkt je Schlag, betonte größer
    var t = takt(A.S), h = '';
    el.taktName.textContent = taktName(t);
    for (var j = 0; j < t.zaehler; j++) h += '<i class="mt-punkt ' + art(t, A.S.mBetonung, j, 0) + '" data-schlag="' + j + '"></i>';
    el.punkte.innerHTML = h;
    lauf.gezeigt = -1;
  }
  function zeigeSchlag(i) {
    el.punkte.querySelectorAll('.mt-punkt').forEach(function (p) { p.classList.toggle('jetzt', +p.dataset.schlag === i); });
    lauf.gezeigt = i;
  }
  function renderTempo() {
    el.tempo.value = A.S.mTempo;
    el.bpm.innerHTML = A.S.mTempo + '<small>BPM</small>';
  }
  function knopf() {
    el.start.innerHTML = lauf.an ? ICON_STOPP + 'Stopp' : ICON_PLAY + 'Start';
    el.start.classList.toggle('zweit', lauf.an);
    el.start.setAttribute('aria-pressed', String(lauf.an));
  }
  function hinweis(text, warm) {
    el.hinweis.textContent = text || (lauf.an ? 'Der Bildschirm bleibt an, solange das Metronom läuft.'
      : 'Tippe im Takt auf „Tippen“, dann übernimmt das Metronom dein Tempo. Am Computer startet und stoppt die Leertaste.');
    el.hinweis.classList.toggle('warm', !!(text && warm !== false));
  }

  // ---------------------------------------------------- Einstellungen
  function setzeTempo(v) {
    v = Math.max(BPM_MIN, Math.min(BPM_MAX, Math.round(v)));
    if (v === A.S.mTempo) return renderTempo();
    A.S.mTempo = v;   // läuft es, gilt das neue Tempo ab dem nächsten Klick
    A.speichern();
    renderTempo();
  }
  function neuerTakt() {   // Taktart oder Unterteilung geändert: läuft es, beginnt sofort ein neuer Takt
    A.speichern();
    render();
    if (!lauf.an) return;
    SC.Klang.stopp();
    lauf.z = { t: SC.Klang.zeit() + 0.06, pos: 0 };
    lauf.plan = [];
  }
  function tippe() {
    var jetzt = performance.now();
    if (tipps.length && jetzt - tipps[tipps.length - 1] > TAP_PAUSE) tipps = [];
    tipps.push(jetzt);
    if (tipps.length > TAP_ANZAHL + 1) tipps.shift();
    el.tippen.classList.add('getippt');
    clearTimeout(blinkt);
    blinkt = setTimeout(function () { el.tippen.classList.remove('getippt'); }, 120);
    var bpm = tapTempo(tipps);
    if (bpm) { setzeTempo(bpm); hinweis(''); } else hinweis('Weiter im Takt tippen.', false);
  }

  // ---------------------------------------------------- Abspielen
  function start() {
    var ctx = SC.Klang.kontext();   // im Tipp anlegen, sonst bleibt es auf dem iPhone stumm
    if (!ctx) { hinweis('Dein Browser kann leider keinen Ton abspielen.'); return; }
    if (!puffer || pufferRate !== ctx.sampleRate) {
      puffer = {}; pufferRate = ctx.sampleRate;
      Object.keys(KLICKS).forEach(function (a) {
        var d = klickDaten(a, ctx.sampleRate), b = ctx.createBuffer(1, d.length, ctx.sampleRate);
        b.getChannelData(0).set(d);
        puffer[a] = b;
      });
    }
    lauf.an = true;
    lauf.z = { t: ctx.currentTime + 0.1, pos: 0 };
    lauf.plan = [];
    lauf.verpasst = 0;
    planen();
    anzeige();
    wachHalten(true);
    knopf(); hinweis('');
  }
  function stopp(text) {
    var war = lauf.an;
    lauf.an = false;
    clearTimeout(lauf.timer);
    cancelAnimationFrame(lauf.raf);
    lauf.plan = [];
    if (war) SC.Klang.stopp();
    wachHalten(false);
    if (el.start) { zeigeSchlag(-1); knopf(); hinweis(text); }
  }
  function planen() {
    if (!lauf.an) return;
    var jetzt = SC.Klang.zeit(), o = optionen();
    if (lauf.z.t < jetzt + 0.01) lauf.verpasst += ueberspringen(lauf.z, o, jetzt + 0.01);   // Seite hing: nicht nachholen
    naechste(lauf.z, o, jetzt + VORAUS).forEach(function (k) {
      SC.Klang.klick(puffer[k.art], k.t);
      lauf.plan.push(k);
    });
    lauf.timer = setTimeout(planen, TAKT_MS);
  }
  function anzeige() {   // leuchtender Punkt, nur solange es läuft
    if (!lauf.an) return;
    lauf.raf = requestAnimationFrame(anzeige);
    var jetzt = SC.Klang.zeit() - SC.Klang.latenz();
    while (lauf.plan.length > 1 && lauf.plan[1].t <= jetzt) lauf.plan.shift();
    var k = lauf.plan[0];
    if (!k || k.t > jetzt || k.schlag === lauf.gezeigt) return;
    zeigeSchlag(k.schlag);
  }
  function wachHalten(an) {
    if (!an) { if (wach) { try { wach.release(); } catch (e) { /* egal */ } wach = null; } return; }
    if (navigator.wakeLock && navigator.wakeLock.request) {
      navigator.wakeLock.request('screen').then(function (l) { if (lauf.an) wach = l; else l.release(); }).catch(function () { /* Bildschirm darf aus */ });
    }
  }

  function einrichten(app) {
    A = app;
    var S = A.S;
    S.mTempo = Math.round(S.mTempo);
    if (!(S.mTempo >= BPM_MIN && S.mTempo <= BPM_MAX)) S.mTempo = BPM_STANDARD;
    if (S.mTakt !== 'eigen' && !TAKTARTEN.some(function (t) { return t.id === S.mTakt; })) S.mTakt = TAKT_STANDARD;
    S.mZaehler = Math.round(S.mZaehler);
    if (!(S.mZaehler >= 1 && S.mZaehler <= ZAEHLER_MAX)) S.mZaehler = EIGEN_STANDARD.zaehler;
    if (NENNER.indexOf(S.mNenner) < 0) S.mNenner = EIGEN_STANDARD.nenner;
    S.mGruppen = String(S.mGruppen || '').slice(0, 40);
    if (TEILUNGEN.indexOf(S.mTeilung) < 0) S.mTeilung = 1;
    S.mBetonung = S.mBetonung !== false;
    el = {
      takt: $('mt-takt'), teilung: $('mt-teilung'), eigen: $('mt-eigen'), zaehler: $('mt-zaehler'), nenner: $('mt-nenner'),
      gruppen: $('mt-gruppen'), gruppenHinweis: $('mt-gruppen-hinweis'), taktName: $('mt-takt-name'), punkte: $('mt-punkte'),
      bpm: $('mt-bpm'), tempo: $('mt-tempo'), tippen: $('mt-tippen'), betonung: $('mt-betonung'), start: $('mt-start'), hinweis: $('mt-hinweis'),
    };
    el.takt.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b || b.dataset.takt === S.mTakt) return;
      S.mTakt = b.dataset.takt; neuerTakt();
    });
    el.teilung.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b || +b.dataset.teilung === S.mTeilung) return;
      S.mTeilung = +b.dataset.teilung; neuerTakt();
    });
    el.nenner.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b || +b.dataset.nenner === S.mNenner) return;
      S.mNenner = +b.dataset.nenner; neuerTakt();
    });
    $('mt-z-minus').onclick = function () { if (S.mZaehler > 1) { S.mZaehler--; neuerTakt(); } };
    $('mt-z-plus').onclick = function () { if (S.mZaehler < ZAEHLER_MAX) { S.mZaehler++; neuerTakt(); } };
    el.gruppen.addEventListener('input', function () {   // Betonung ändern, ohne den Takt neu zu beginnen
      S.mGruppen = this.value.slice(0, 40); A.speichern(); renderEigen(); renderTakt();
    });
    el.betonung.onclick = function () { S.mBetonung = !S.mBetonung; A.speichern(); render(); };
    el.tempo.oninput = function () { setzeTempo(+this.value); };
    $('mt-minus').onclick = function () { setzeTempo(S.mTempo - 1); };
    $('mt-plus').onclick = function () { setzeTempo(S.mTempo + 1); };
    // Tippen beim Herunterdrücken messen, das ist genauer als der Klick beim Loslassen
    el.tippen.addEventListener('pointerdown', tippe);
    el.tippen.addEventListener('click', function (e) { if (e.detail === 0) tippe(); });   // Tastatur
    el.start.onclick = function () { if (lauf.an) stopp(); else start(); };
    document.addEventListener('keydown', function (e) {
      if (S.ansicht !== 'metronom' || e.key !== ' ' || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target && e.target.closest && e.target.closest('input, select, textarea, button')) return;
      e.preventDefault();
      if (lauf.an) stopp(); else start();
    });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden && lauf.an) stopp('Angehalten, weil die App im Hintergrund war.');
    });
    window.addEventListener('pagehide', function () { if (lauf.an) stopp(); });
    render();
    hinweis('');
  }

  return {
    BPM_MIN: BPM_MIN, BPM_MAX: BPM_MAX, BPM_STANDARD: BPM_STANDARD, TAKTARTEN: TAKTARTEN, TAKT_STANDARD: TAKT_STANDARD,
    ZAEHLER_MAX: ZAEHLER_MAX, NENNER: NENNER, KLICKS: KLICKS,
    autoGruppen: autoGruppen, liesGruppen: liesGruppen, takt: takt, taktName: taktName, teilungNamen: teilungNamen,
    art: art, naechste: naechste, ueberspringen: ueberspringen, tapTempo: tapTempo, klickDaten: klickDaten,
    einrichten: einrichten, start: start, stopp: stopp, auffrischen: function () { if (el.start) render(); },
    laeuft: function () { return lauf.an; }, verpasst: function () { return lauf.verpasst; },
  };
})();
