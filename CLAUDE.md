# Projekt: Tuner

Stimmgerät für Gitarre und Ukulele als Web-App ohne Build-Schritt (reines HTML, CSS, JavaScript). Es ist das Stimmgerät aus der App „Songwriting & Chords“ (`../Akkordfolgen-fuer-Songwriter/web/stimmen.js`), hier als ganze Seite. Wer dort am Stimmgerät etwas verbessert, prüft, ob es hierher gehört, und umgekehrt.

## Schreibweise und Text

- Oberfläche und Texte auf Deutsch. Tonnamen deutsch: H statt B, das deutsche B als B♭. Vorzeichen als ♭ und #. Mit Oktave: `H3`, `B♭3`.
- Stimmungen von der tiefsten Saite aus notieren, bei der Ukulele G C E A.
- Lockerer Ton mit Du, kurze Sätze, keine Floskeln. Im Fließtext keine Gedankenstriche, nur Punkt, Komma und Doppelpunkt.

## Dateien

- `stimmen.js`: oben Stimmungen und Tonerkennung (YIN mit FFT) ohne Zugriff auf die Seite, damit `skripte/pruefen.js` sie testen kann. Unten die Seite: Zeiger als kritisch gedämpfte Feder (`FEDER = 7`, so gewollt), grün ab 3 Cent, orange erst ab 4 Cent, Saiten mit Referenzton und Haken, Mikrofon ohne Echo-, Rausch- und Pegelkorrektur, Wake Lock, Kammerton 430 bis 450 Hz.
- `klang.js`: Klangausgabe (`SC.Klang`), aus `musik.js` der Songwriting-App ohne die Griffe. `navigator.audioSession` steht auf `playback`, mit Mikrofon auf `play-and-record`.
- `app.js`: Zustand, Hell/Dunkel, Hintergrund-Regel, Service Worker.
- `installieren.js`: Hinweis zum Installieren, gleich wie in der Songwriting-App, nur mit „Tuner“ statt „Chords“. Oben `art()` erkennt Gerät und Browser aus dem User-Agent (testbar), unten der Hinweis am unteren Rand. Er kommt nur auf iPhone, iPad (meldet sich als Mac mit Touch) und Android im Browser, nie in der installierten App, auf dem Computer oder bei `file://`. Geschlossen wird er als `installZu` gemerkt, danach öffnet ihn nur der Link im Fuß. Auf iPhone und iPad heißt es Home-Bildschirm, auf Android Startbildschirm. Neue Browser oder In-App-Browser in `art()` und in den Testgeräten von `skripte/pruefen.js` ergänzen.
- Einstellungen liegen nur im Browser: `localStorage` `tuner-zustand` (`stInst` frei, gitarre oder ukulele, `stGit`, `stUke`, `kammerton`, `installZu`) und `tuner-thema` (`hell` oder `dunkel`). Unbekannte Werte fallen auf Frei, Standard und 440 Hz zurück.
- Der Umschalter oben hat die Reihenfolge Frei, Gitarre, Ukulele. Grundeinstellung Frei.

## Regeln

- Nach jeder Änderung muss `osascript -l JavaScript skripte/pruefen.js` mit 0 Fehlern durchlaufen. Es prüft die Tonerkennung mit erzeugten Saitenklängen in allen Stimmungen und Kammertönen (höchstens 1 Cent daneben), die Referenztöne, Stille, Rauschen, die Reihenfolge des Umschalters, den Start auf Frei, die Offline-Liste, die Syntax von `app.js` und `sw.js`, jede gesuchte ID in `index.html`, Gedankenstriche in sichtbaren Texten, die Icon-Größen und die Geräteerkennung für den Hinweis zum Installieren.
- Im Hintergrund läuft nichts: Bei `visibilitychange` und `pagehide` gibt das Stimmgerät das Mikrofon frei, stoppt den Kammerton und vergisst die Referenztöne, `app.js` legt die Klangausgabe schlafen (`SC.Klang.ruhe`). Nach 20 Sekunden ohne Ton schläft sie von selbst. Neue Timer, Schleifen oder Audio-Quellen müssen dort mit aufhören. Keinen Push, Hintergrund-Sync oder `setInterval` ohne Ende einbauen.
- Solange der Kammerton oder ein Referenzton spielt, hört die Tonerkennung nicht zu.
- Nach Änderungen an Dateien der App die `VERSION` in `sw.js` erhöhen, sonst sehen installierte Apps die neue Fassung nicht. Neue Dateien auch in `DATEIEN` dort aufnehmen.
- Lokal testen: `ruby -run -e httpd . -p 8766` (Port 8765 gehört der Songwriting-App). Startet die Vorschau den Server über `.claude/launch.json` („tuner“), sperrt macOS ihm den Ordner „Dokumente“ (Fehler 500). Dann den Server aus dem Terminal starten und die Vorschau mit „tuner-laufend“ anhängen. Service Worker gehen in der Vorschau nur auf Port 8766.
- Die Vorschau blockiert das Mikrofon. Zum Testen `navigator.mediaDevices.getUserMedia` per JavaScript durch einen Oszillator ersetzen (`createMediaStreamDestination`, Teiltöne über `createPeriodicWave`). Das Pane verdeckt die Seite manchmal kurz, dann gibt die App das Mikrofon richtigerweise frei. Längere Testschleifen sollten es neu starten.
- Nichts auf GitHub hochladen und kein Repository anlegen, ohne dass der Nutzer es ausdrücklich bestätigt.
