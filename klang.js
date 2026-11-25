// Tuner: Klangausgabe (Modul „Klang“ aus musik.js von „Songwriting & Chords“, ohne die Griffe)
// Spielt die Referenztöne und den Kammerton des Stimmgeräts. Läuft auch ohne Seite
// (skripte/pruefen.js lädt sie in osascript), daher ohne DOM-Zugriff beim Laden.
var SC = { Klang: (function () {
  'use strict';
  var ctx = null, master = null, aktiv = [], kt = 440, sitzungTyp = 'playback', ruheTimer = null;
  var RUHE_NACH = 20000; // so lange nach dem letzten Ton schaltet sich die Klangausgabe ab
  // iPhone/iPad: 'playback' spielt auch bei eingeschaltetem Stummschalter (Safari 17+),
  // das Stimmgerät schaltet für das Mikrofon auf 'play-and-record'
  function sitzung(typ) {
    sitzungTyp = typ;
    try { if (typeof navigator !== 'undefined' && navigator.audioSession) navigator.audioSession.type = typ; } catch (e) { /* ältere Geräte */ }
  }
  function init() {
    if (typeof window === 'undefined') return false;
    sitzung(sitzungTyp);
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.55;
      var comp = ctx.createDynamicsCompressor();
      master.connect(comp);
      comp.connect(ctx.destination);
    }
    if (ctx.state !== 'running' && ctx.state !== 'closed' && ctx.resume) ctx.resume();
    wachBleiben();
    return true;
  }
  // Die Klangausgabe läuft nur, solange etwas erklingt. Danach schläft sie, damit die App
  // nichts rechnet und das iPhone sie im Hintergrund wirklich anhält.
  function wachBleiben() {
    clearTimeout(ruheTimer);
    ruheTimer = setTimeout(function () { if (aktiv.length) wachBleiben(); else schlafen(); }, RUHE_NACH);
  }
  function schlafen() {
    clearTimeout(ruheTimer);
    if (ctx && ctx.state === 'running' && ctx.suspend) {
      var p = ctx.suspend();
      if (p && p.catch) p.catch(function () { /* egal */ });
    }
  }
  // sofort Ruhe: alle Töne aus, Klangausgabe schlafen legen (App geht in den Hintergrund)
  function ruhe() { stopp(); schlafen(); }
  function zustand() { return ctx ? ctx.state : 'aus'; }
  function stopp() {
    aktiv.slice().forEach(function (s) { try { s.stop(); } catch (e) { /* schon beendet */ } });
    aktiv = [];
  }
  // fertigen Puffer abspielen (Referenzton des Stimmgeräts), gibt die Quelle zurück
  function spiele(buf, laut) {
    if (!init()) return null;
    var src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = buf; g.gain.value = laut || 0.5;
    src.connect(g); g.connect(master);
    src.start(ctx.currentTime + 0.02);
    aktiv.push(src);
    src.onended = function () { var x = aktiv.indexOf(src); if (x >= 0) aktiv.splice(x, 1); };
    return src;
  }
  // Dauerton wie eine Stimmgabel (Kammerton im Stimmgerät): fast reiner Sinus, etwas Oberton,
  // damit er auch aus kleinen Lautsprechern klingt. Läuft, bis stopp() kommt; stopp() und ruhe()
  // der Klangausgabe beenden ihn ebenfalls, dann meldet er sich über fertig().
  function dauerton(hz, laut, fertig) {
    if (!init()) return null;
    var t = ctx.currentTime, osc = ctx.createOscillator(), g = ctx.createGain(), aus = false;
    osc.setPeriodicWave(ctx.createPeriodicWave(new Float32Array([0, 0, 0, 0]), new Float32Array([0, 1, 0.12, 0.03])));
    osc.frequency.value = hz;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(laut || 0.3, t + 0.05);   // weich einsetzen, ohne Knacken
    osc.connect(g); g.connect(master);
    osc.start(t);
    aktiv.push(osc);
    osc.onended = function () {
      aus = true;
      var x = aktiv.indexOf(osc); if (x >= 0) aktiv.splice(x, 1);
      osc.disconnect(); g.disconnect();
      if (fertig) fertig();
    };
    return {
      frequenz: function (f) { if (!aus) osc.frequency.setTargetAtTime(f, ctx.currentTime, 0.015); },
      jetzt: function () { return osc.frequency.value; },
      stopp: function () {
        if (aus) return;
        aus = true;
        var n = ctx.currentTime;
        g.gain.cancelScheduledValues(n);
        g.gain.setValueAtTime(g.gain.value, n);
        g.gain.linearRampToValueAtTime(0, n + 0.12);   // weich ausklingen
        try { osc.stop(n + 0.13); } catch (e) { /* schon beendet */ }
      },
    };
  }
  function kontext() { return init() ? ctx : null; }
  // Kammerton A4 in Hz. Das Stimmgerät rechnet seine Töne selbst damit aus, hier wird er nur gemerkt.
  function kammerton(hz) { kt = hz; }
  function kammertonJetzt() { return kt; }
  return {
    init: init, stopp: stopp, spiele: spiele, dauerton: dauerton, kontext: kontext, kammerton: kammerton, kammertonJetzt: kammertonJetzt,
    sitzung: sitzung, ruhe: ruhe, zustand: zustand,
  };
})() };
