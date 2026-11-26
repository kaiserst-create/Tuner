// Tuner: Zustand, Thema, Umschalten zwischen Stimmgerät und Metronom, Hintergrund und Offline.
// Das Stimmgerät steckt in stimmen.js, das Metronom in metronom.js.
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };

  // ------------------------------------------------------------------ Zustand (bleibt im Browser gespeichert)
  var SCHLUESSEL = 'tuner-zustand';
  var S = {
    stInst: 'frei', stGit: 'standard', stUke: 'standard', kammerton: 440,
    ansicht: 'stimmen',   // stimmen oder metronom
    mTempo: 80, mTakt: '4/4', mZaehler: 7, mNenner: 8, mGruppen: '', mTeilung: 1, mBetonung: true,
    installZu: false,     // Hinweis zum Installieren geschlossen
  };
  try {
    var gespeichert = JSON.parse(localStorage.getItem(SCHLUESSEL) || '{}') || {};
    Object.keys(S).forEach(function (k) {
      var v = gespeichert[k];
      if (v === null || v === undefined || typeof v !== typeof S[k] || Array.isArray(v) || (typeof v === 'number' && !isFinite(v))) return;
      S[k] = v;
    });
  } catch (e) { /* ohne Speicher geht es auch */ }
  // Instrument, Stimmungen und Kammerton prüft stimmen.js beim Einrichten, die Werte des Metronoms metronom.js
  if (S.ansicht !== 'metronom') S.ansicht = 'stimmen';
  function speichern() { try { localStorage.setItem(SCHLUESSEL, JSON.stringify(S)); } catch (e) { /* egal */ } }

  // ------------------------------------------------------------------ Thema
  function istDunkel() {
    var t = document.documentElement.dataset.theme;
    if (t) return t === 'dark';
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  function themaFarbe() {
    if (!document.documentElement.dataset.theme) return;
    var farbe = istDunkel() ? '#14161b' : '#f5f3ee';
    document.querySelectorAll('meta[name="theme-color"]').forEach(function (m) { m.setAttribute('content', farbe); });
  }
  $('#thema').onclick = function () {
    var dunkel = !istDunkel();
    document.documentElement.dataset.theme = dunkel ? 'dark' : 'light';
    try { localStorage.setItem('tuner-thema', dunkel ? 'dunkel' : 'hell'); } catch (e) { /* egal */ }
    themaFarbe();
  };
  themaFarbe();

  // ------------------------------------------------------------------ Start
  SC_STIMMEN.einrichten({ S: S, speichern: speichern });
  SC_METRONOM.einrichten({ S: S, speichern: speichern });
  SC_INSTALL.einrichten({ S: S, speichern: speichern });

  // ------------------------------------------------------------------ Stimmgerät oder Metronom
  // Der Knopf „Metronom“ sitzt im Umschalter neben Ukulele. Ein Tipp auf Frei, Gitarre oder Ukulele
  // führt zurück zum Stimmgerät. Beides läuft nie gleichzeitig: Das Mikrofon würde die Klicks hören.
  var metronomKnopf = $('#sg-inst [data-ansicht="metronom"]');
  function zeigeAnsicht() {
    var m = S.ansicht === 'metronom';
    $('#stimmen-teil').hidden = m;
    $('#metronom').hidden = !m;
    metronomKnopf.setAttribute('aria-checked', String(m));
    SC_STIMMEN.auffrischen();
    if (m) SC_METRONOM.auffrischen();
  }
  $('#sg-inst').addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    var w = b.dataset.ansicht === 'metronom' ? 'metronom' : 'stimmen';
    if (w === S.ansicht) return;
    if (w === 'metronom') SC_STIMMEN.anhalten(); else SC_METRONOM.stopp();
    S.ansicht = w;
    speichern();
    zeigeAnsicht();
  });
  zeigeAnsicht();

  // ------------------------------------------------------------------ Hintergrund: nichts läuft weiter
  // Geht die App in den Hintergrund oder wird sie geschlossen, schläft die Klangausgabe.
  // Stimmgerät und Metronom schalten Mikrofon, Kammerton und Klicks selbst ab.
  function ruhe() { SC.Klang.ruhe(); }
  document.addEventListener('visibilitychange', function () { if (document.hidden) ruhe(); });
  window.addEventListener('pagehide', ruhe);

  // ------------------------------------------------------------------ Offline (Service Worker)
  var status = $('#offline-status');
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    navigator.serviceWorker.register('sw.js').then(function () {
      return navigator.serviceWorker.ready;
    }).then(function () {
      status.textContent = 'Offline verfügbar';
    }).catch(function () {
      status.textContent = '';
    });
  } else {
    status.textContent = 'Lokal geöffnet, läuft ohne Internet';
  }
})();
