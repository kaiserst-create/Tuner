// Prüft den Tuner (Abschnitt 6 aus web_pruefen.js von „Songwriting & Chords“, dazu ein paar Kleinigkeiten):
//  1. Tonerkennung mit erzeugten Saitenklängen in allen Stimmungen und Kammertönen (höchstens 1 Cent daneben),
//     jeder Halbton im freien Modus, die Referenztöne selbst, Stille und Rauschen
//  2. Stimmungen: deutsche Tonnamen mit Oktave, Kammerton-Grenzen
//  3. Klangausgabe lädt ohne Seite
//  4. Seite: Reihenfolge Frei, Gitarre, Ukulele, Start auf Frei; jede Datei, die die Seite lädt, steht im Service Worker und existiert
//  5. Syntax von app.js und sw.js, jede gesuchte ID in index.html, keine Gedankenstriche in Texten, Icon-Größen
//  6. Hinweis zum Installieren: richtiges Gerät und richtiger Text (wie in web_pruefen.js der Songwriting-App)
//
// Aufruf: osascript -l JavaScript skripte/pruefen.js

ObjC.import('Foundation');

function lies(pfad) {
  const s = $.NSString.stringWithContentsOfFileEncodingError(pfad, $.NSUTF8StringEncoding, null);
  if (s.isNil()) throw new Error('Datei nicht gefunden: ' + pfad);
  return s.js;
}
function gibtEs(pfad) { return $.NSFileManager.defaultManager.fileExistsAtPath(pfad); }
function projektordner() {
  const args = ObjC.deepUnwrap($.NSProcessInfo.processInfo.arguments);
  const cwd = $.NSFileManager.defaultManager.currentDirectoryPath.js;
  let skript = args.find(a => /pruefen\.js$/.test(a)) || 'skripte/pruefen.js';
  if (!skript.startsWith('/')) skript = cwd + '/' + skript;
  return $(skript).stringByStandardizingPath.stringByDeletingLastPathComponent.stringByDeletingLastPathComponent.js;
}

function run() {
  const basis = projektordner();
  const out = [];
  let fehler = 0;
  const melde = t => { fehler++; if (fehler < 40) out.push('FEHLER ' + t); };

  // im globalen Bereich laden, wie <script> im Browser
  (0, eval)(lies(basis + '/klang.js') + '\n;globalThis.SC = SC;');
  (0, eval)(lies(basis + '/stimmen.js') + '\n;globalThis.SC_STIMMEN = SC_STIMMEN;');
  const T = globalThis.SC_STIMMEN, K = globalThis.SC.Klang;

  // ---------------------------------------------------------------- 1. Tonerkennung: jede Saite auf 1 Cent genau?
  let zufall = 4711;
  const rnd = () => (zufall = (zufall * 1103515245 + 12345) % 2147483648) / 2147483648;
  // gezupfte Saite aus Teiltönen mit zufälliger Phase, abklingend, mit leisem Rauschen
  function zupf(f, sr, len, teile, start) {
    const x = new Float32Array(len);
    teile.forEach((a, h) => {
      const fh = f * (h + 1);
      if (fh > sr * 0.45) return;
      const ph = rnd() * 2 * Math.PI, w = 2 * Math.PI * fh / sr, dk = (1.5 + h) / sr;
      for (let j = 0; j < len; j++) { const t = j + start; x[j] += a * Math.sin(w * t + ph) * Math.exp(-dk * t); }
    });
    for (let j = 0; j < len; j++) x[j] = x[j] * 0.15 + (rnd() - 0.5) * 0.004;
    return x;
  }
  const KLAENGE = [[1, 0.6, 0.4, 0.25, 0.15, 0.1], [0.25, 1, 0.6, 0.4, 0.2]];   // normal und mit schwachem Grundton wie am Handymikrofon
  let erkannt = 0, groesste = 0;
  const pruefeTon = (was, r, sollF, sollZiel, kt, midis, sollSaite) => {
    erkannt++;
    if (!r) { melde('Stimmgerät ' + was + ': nichts erkannt'); return; }
    const w = T.auswerten(r.f, kt, midis, -1), abw = Math.abs(1200 * Math.log(r.f / sollF) / Math.LN2);
    groesste = Math.max(groesste, abw);
    if (abw > 1) melde('Stimmgerät ' + was + ': ' + abw.toFixed(2) + ' Cent daneben');
    if (w.ziel !== sollZiel || (sollSaite !== undefined && w.saite !== sollSaite)) melde('Stimmgerät ' + was + ': falscher Ton ' + w.ziel + ' statt ' + sollZiel);
  };
  for (const inst of ['gitarre', 'ukulele']) {
    for (const st of T.STIMMUNGEN[inst]) {
      const s = st.toene.map(T.saite), midis = s.map(x => x.midi);
      for (const [kt, sr] of [[430, 44100], [440, 48000], [450, 48000]]) {
        const b = T.bereich(midis, kt);
        for (const cent of [-40, -12, 0, 25]) {
          s.forEach((x, i) => {
            for (const teile of KLAENGE) {
              const f = T.frequenz(x.midi, kt) * Math.pow(2, cent / 1200);
              const r = T.erkenne(zupf(f, sr, 4096, teile, Math.floor(sr * 0.15)), sr, b[0], b[1]);
              pruefeTon(inst + ' ' + st.name + ' ' + x.name + x.okt + ' ' + kt + ' Hz ' + cent + ' Cent', r, f, x.midi, kt, midis, i);
            }
          });
        }
      }
    }
  }
  // frei: jeder Halbton vom tiefen D bis C6
  for (let m = 38; m <= 84; m++) {
    for (const cent of [0, 20, -35]) {
      const f = T.frequenz(m, 440) * Math.pow(2, cent / 1200), b = T.bereich(null, 440);
      pruefeTon('frei ' + T.tonName(m).name + T.tonName(m).okt + ' ' + cent + ' Cent', T.erkenne(zupf(f, 48000, 4096, KLAENGE[0], 7200), 48000, b[0], b[1]), f, m, 440, null);
    }
  }
  // Referenztöne müssen selbst genau stimmen
  for (const inst of ['gitarre', 'ukulele']) {
    for (const st of T.STIMMUNGEN[inst]) {
      for (const x of st.toene.map(T.saite)) {
        const f = T.frequenz(x.midi, 440), d = T.zupfDaten(f, 48000, 0.4);
        pruefeTon('Referenzton ' + x.name + x.okt, T.erkenne(d.subarray(4800, 4800 + 4096), 48000, 40, 1500), f, x.midi, 440, null);
      }
    }
  }
  // Stille und Rauschen dürfen keinen Ton liefern
  const rauschen = a => { const x = new Float32Array(4096); for (let j = 0; j < x.length; j++) x[j] = (rnd() - 0.5) * a; return x; };
  if (T.erkenne(rauschen(0.004), 48000)) melde('Stimmgerät: Stille als Ton erkannt');
  if (T.erkenne(rauschen(0.3), 48000)) melde('Stimmgerät: Rauschen als Ton erkannt');
  out.push(erkannt + ' Töne im Stimmgerät erkannt, größte Abweichung ' + groesste.toFixed(2).replace('.', ',') + ' Cent');

  // ---------------------------------------------------------------- 2. Stimmungen und Kammerton
  const DEUTSCH = /^(C|C#|D♭|D|D#|E♭|E|F|F#|G♭|G|G#|A♭|A|B♭|H)[0-9]$/;
  let stimmungen = 0;
  for (const inst of ['gitarre', 'ukulele']) {
    const ids = {};
    for (const st of T.STIMMUNGEN[inst]) {
      stimmungen++;
      if (ids[st.id]) melde('Stimmung ' + inst + ' ' + st.id + ' doppelt');
      ids[st.id] = true;
      if (st.toene.length !== (inst === 'gitarre' ? 6 : 4)) melde('Stimmung ' + st.name + ': falsche Saitenzahl');
      for (const t of st.toene) if (!DEUTSCH.test(t)) melde('Stimmung ' + st.name + ': Tonname „' + t + '“ nicht deutsch');
    }
    if (T.stimmung(inst, 'gibt-es-nicht') !== T.STIMMUNGEN[inst][0]) melde('Stimmung ' + inst + ': unbekannte Stimmung fällt nicht auf Standard zurück');
  }
  if (T.KT_MIN !== 430 || T.KT_MAX !== 450 || T.KT_STANDARD !== 440) melde('Kammerton-Grenzen geändert');
  if (Math.abs(T.frequenz(69, 450) - 450) > 1e-9 || Math.abs(T.frequenz(57) - 220) > 1e-9) melde('Frequenz falsch berechnet');
  const ton = T.tonName(T.saite('B♭3').midi);
  if (ton.name !== 'B♭' || ton.okt !== 3 || T.tonName(59).name !== 'H') melde('Tonnamen nicht deutsch');
  out.push(stimmungen + ' Stimmungen geprüft');

  // ---------------------------------------------------------------- 3. Klangausgabe ohne Seite
  if (K.init() !== false || K.kontext() !== null || K.zustand() !== 'aus') melde('Klang: ohne Seite sollte nichts starten');
  K.kammerton(432);
  if (K.kammertonJetzt() !== 432) melde('Klang: Kammerton nicht übernommen');
  K.stopp();
  for (const f of ['init', 'sitzung', 'stopp', 'spiele', 'dauerton', 'kontext', 'kammerton', 'ruhe', 'zustand']) {
    if (typeof K[f] !== 'function') melde('Klang: ' + f + ' fehlt');
  }

  // ---------------------------------------------------------------- 4. Seite und Offline-Liste
  const html = lies(basis + '/index.html');
  const inst = /<div[^>]*id="sg-inst"[^>]*>([\s\S]*?)<\/div>/.exec(html);
  const reihe = inst ? [...inst[1].matchAll(/data-wert="([^"]+)"/g)].map(m => m[1]).join(' ') : '';
  if (reihe !== 'frei gitarre ukulele') melde('Umschalter: Reihenfolge „' + reihe + '“ statt „frei gitarre ukulele“');
  // Start auf Frei, auch wenn der gespeicherte Wert unbrauchbar ist
  if (!/var S = \{\s*stInst: 'frei',/.test(lies(basis + '/app.js'))) melde('Start: app.js beginnt nicht mit Frei');
  for (const kaputt of [undefined, 'bass', 7]) {
    const S = { stInst: kaputt, stGit: 'x', stUke: 'y', kammerton: 999 };
    try { T.einrichten({ S: S, speichern: () => {} }); } catch (e) { /* ohne Seite bricht es nach der Prüfung ab */ }
    if (S.stInst !== 'frei' || S.stGit !== 'standard' || S.stUke !== 'standard' || S.kammerton !== 440) melde('Start: unbrauchbarer Zustand ' + JSON.stringify(kaputt) + ' fällt nicht auf Frei, Standard, 440 Hz zurück');
  }
  const sw = lies(basis + '/sw.js');
  const liste = /var DATEIEN = \[([\s\S]*?)\];/.exec(sw);
  const dateien = liste ? [...liste[1].matchAll(/'([^']+)'/g)].map(m => m[1]) : [];
  if (!/var VERSION = 'tuner-[0-9-]+';/.test(sw)) melde('Service Worker: VERSION fehlt');
  for (const d of dateien) if (d !== './' && !gibtEs(basis + '/' + d)) melde('Service Worker: ' + d + ' gibt es nicht');
  const geladen = [...html.matchAll(/(?:src|href)="([^"#:]+)"/g)].map(m => m[1]);
  const manifest = JSON.parse(lies(basis + '/manifest.webmanifest'));
  manifest.icons.forEach(i => geladen.push(i.src));
  for (const d of geladen) if (dateien.indexOf(d) < 0) melde('Service Worker: ' + d + ' fehlt in DATEIEN');
  if (manifest.name !== 'Tuner' || manifest.lang !== 'de' || manifest.display !== 'standalone' || manifest.start_url !== './') melde('Manifest: Name, Sprache, Anzeige oder Start falsch');
  out.push(dateien.length + ' Dateien für offline geprüft');

  // ---------------------------------------------------------------- 5. Syntax, IDs, Texte, Icons
  for (const d of ['app.js', 'sw.js']) {
    try { new Function(lies(basis + '/' + d)); } catch (e) { melde(d + ': Syntaxfehler ' + e.message); }
  }
  // jede ID, die die Skripte suchen, gibt es in index.html genau einmal
  const ids = {};
  [...html.matchAll(/\sid="([^"]+)"/g)].forEach(m => { ids[m[1]] = (ids[m[1]] || 0) + 1; });
  Object.keys(ids).forEach(id => { if (ids[id] > 1) melde('index.html: ID ' + id + ' doppelt'); });
  const stimmenJs = lies(basis + '/stimmen.js'), appJs = lies(basis + '/app.js'), installJs = lies(basis + '/installieren.js');
  const gesucht = [...stimmenJs.matchAll(/\$\('([a-z-]+)'\)/g)].map(m => m[1])
    .concat([...appJs.matchAll(/\$\('#([a-z-]+)'\)/g)].map(m => m[1]))
    .concat([...installJs.matchAll(/getElementById\('([a-z-]+)'\)/g)].map(m => m[1]));
  for (const id of gesucht) if (!ids[id] && id !== 'sg-nadel') melde('index.html: ID ' + id + ' fehlt');
  // keine Gedankenstriche in sichtbaren Texten (einzelnes „–“ als Platzhalter ist erlaubt)
  const texte = html.replace(/<!--[\s\S]*?-->/g, '').replace(/<script[\s\S]*?<\/script>/g, '').split(/<[^>]+>/)
    .concat([...(stimmenJs + appJs + installJs).matchAll(/'((?:[^'\\\n]|\\.)*)'/g)].map(m => m[1]));
  texte.filter(t => /\S\s+[–—]\s+\S/.test(t)).forEach(t => melde('Gedankenstrich im Text: ' + t.trim().slice(0, 60)));
  // Icons haben die Größe, die das Manifest verspricht
  ObjC.import('AppKit');
  const groesse = p => { const r = $.NSBitmapImageRep.imageRepWithData($.NSData.dataWithContentsOfFile(p)); return r.isNil() ? '?' : r.pixelsWide + 'x' + r.pixelsHigh; };
  manifest.icons.filter(i => /\.png$/.test(i.src)).forEach(i => { const g = groesse(basis + '/' + i.src); if (g !== i.sizes) melde('Icon ' + i.src + ': ' + g + ' statt ' + i.sizes); });
  if (groesse(basis + '/icons/apple-touch-icon.png') !== '180x180') melde('Icon apple-touch-icon.png nicht 180x180');
  out.push(gesucht.length + ' IDs, Texte und Icons geprüft');

  // ---------------------------------------------------------------- 6. Hinweis zum Installieren: richtiges Gerät erkannt?
  (0, eval)(installJs + '\n;globalThis.SC_INSTALL = SC_INSTALL;');
  const INST = globalThis.SC_INSTALL;
  const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko)';
  const ANDROID = 'Mozilla/5.0 (Linux; Android 14; K) AppleWebKit/537.36 (KHTML, like Gecko)';
  const geraete = [
    ['iPhone Safari', IPHONE + ' Version/18.5 Mobile/15E148 Safari/604.1', 5, 'ios'],
    ['iPad Safari (meldet sich als Mac)', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15', 5, 'ios'],
    ['altes iPad Safari', 'Mozilla/5.0 (iPad; CPU OS 12_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.1 Mobile/15E148 Safari/604.1', 5, 'ios'],
    ['iPhone Chrome', IPHONE + ' CriOS/131.0.6778.73 Mobile/15E148 Safari/604.1', 5, 'ios-anders'],
    ['iPhone Firefox', IPHONE + ' FxiOS/133.0 Mobile/15E148 Safari/605.1.15', 5, 'ios-anders'],
    ['iPhone Edge', IPHONE + ' Version/18.0 EdgiOS/131.0.2903.68 Mobile/15E148 Safari/605.1.15', 5, 'ios-anders'],
    ['iPhone Instagram', IPHONE + ' Mobile/15E148 Instagram 357.0.0.25.101 (iPhone14,5; iOS 18_5; de_DE; de; scale=3.00; 1170x2532)', 5, 'ios-app'],
    ['iPhone Facebook', IPHONE + ' Mobile/15E148 [FBAN/FBIOS;FBAV/490.0.0.38.107;FBBV/123;FBDV/iPhone14,5;FBMD/iPhone;FBSN/iOS]', 5, 'ios-app'],
    ['iPhone eingebettete Ansicht', IPHONE + ' Mobile/15E148', 5, 'ios-app'],
    ['Android Chrome', ANDROID + ' Chrome/131.0.0.0 Mobile Safari/537.36', 5, 'android'],
    ['Android Samsung Internet', 'Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/27.0 Chrome/125.0.0.0 Mobile Safari/537.36', 5, 'android'],
    ['Android Firefox', 'Mozilla/5.0 (Android 14; Mobile; rv:133.0) Gecko/133.0 Firefox/133.0', 5, 'android'],
    ['Android-Tablet Chrome', 'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36', 5, 'android'],
    ['Android eingebettete Ansicht', 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP2A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/131.0.6778.81 Mobile Safari/537.36', 5, 'android-app'],
    ['Android Instagram', 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP2A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/131.0.6778.81 Mobile Safari/537.36 Instagram 357.0.0.13.112 Android', 5, 'android-app'],
    ['Mac Safari', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15', 0, ''],
    ['Windows Chrome', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36', 0, ''],
    ['Linux Firefox', 'Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0', 0, ''],
  ];
  for (const [name, ua, touch, soll] of geraete) {
    const ist = INST.art({ ua: ua, touch: touch, installiert: false, protokoll: 'https:' });
    if (ist !== soll) melde('Installieren: ' + name + ' erkannt als „' + ist + '“ statt „' + soll + '“');
    if (soll) {
      if (INST.art({ ua: ua, touch: touch, installiert: true, protokoll: 'https:' })) melde('Installieren: ' + name + ' schon installiert, trotzdem Hinweis');
      if (INST.art({ ua: ua, touch: touch, installiert: false, protokoll: 'file:' })) melde('Installieren: ' + name + ' als Datei geöffnet, trotzdem Hinweis');
    }
  }
  // jeder Hinweis hat Text und nennt Tuner, Android mit Installationsfenster bekommt den Knopf, Texte ohne Gedankenstriche
  for (const a of ['ios', 'ios-anders', 'ios-app', 'android', 'android-app']) {
    for (const knopf of [false, true]) {
      const x = INST.inhalt(a, knopf);
      if (!x || !x.nutzen || (!x.schritte.length && !x.knopf)) { melde('Installieren: Hinweis für ' + a + ' leer'); continue; }
      if (!!x.knopf !== (a === 'android' && knopf)) melde('Installieren: Knopf bei ' + a + ' falsch');
      const text = [x.nutzen, x.notiz || ''].concat(x.schritte).join(' ').replace(/<[^>]+>/g, '');
      if (/ [–—] /.test(text)) melde('Installieren: Gedankenstrich im Hinweis für ' + a);
      if (a.indexOf('ios') === 0 ? /Startbildschirm/.test(text) : /Home-Bildschirm/.test(text)) melde('Installieren: falscher Name des Bildschirms bei ' + a);
      if (!/Tuner/.test(x.nutzen) || /Chords/.test(text)) melde('Installieren: falscher App-Name im Hinweis für ' + a);
    }
  }
  if (INST.inhalt('', false)) melde('Installieren: Hinweis ohne Gerät');
  out.push(geraete.length + ' Geräte für den Hinweis zum Installieren geprüft');

  out.push(fehler + ' Fehler');
  return out.join('\n');
}
