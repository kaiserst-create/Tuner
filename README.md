# Tuner

Stimmgerät für Gitarre und Ukulele als Web-App. Es ist dasselbe Stimmgerät wie in der App „Songwriting & Chords“, hier als eigene App, die du auf iPhone und iPad installieren kannst.

## Was die App kann

- **Frei, Gitarre oder Ukulele:** Frei erkennt jeden Ton, auch die Stimme. Gitarre: Standard, Halbton tiefer, Drop D, DADGAD, Open G. Ukulele: Standard mit hohem G, tiefes G, D-Stimmung, Bariton (D G H E). Die App startet mit Frei und 440 Hz.
- **Zeiger:** zeigt ±50 Cent wie ein echtes Messgerät, grün ab 3 Cent Abweichung. Dazu Ton, gemessene Frequenz und Ziel.
- **Saiten:** Ein Tipp auf eine Saite spielt ihren Referenzton und hält sie fest, „Auto“ erkennt die Saite selbst. Bleibt eine Saite eine halbe Sekunde im grünen Bereich, bekommt sie einen Haken.
- **Kammerton:** zwischen 430 und 450 Hz einstellbar. Mit „Anhören“ spielt er als Dauerton wie eine Stimmgabel, bis du auf „Stopp“ tippst (höchstens eine Minute). Verstellst du ihn dabei, hörst du die Änderung sofort.
- **Mikrofon:** braucht https (zum Beispiel GitHub Pages) und deine Erlaubnis. Die App hört nur zu, solange sie offen ist, und nimmt nichts auf. Im Hintergrund gibt sie das Mikrofon sofort frei.
- **Hell und dunkel** zum Umschalten, folgt sonst der Systemeinstellung.
- **Offline:** Nach dem ersten Öffnen läuft alles ohne Internet.
- **Hinweis zum Installieren:** wie in der Songwriting-App. Auf iPhone, iPad und Android im Browser kommt kurz nach dem Start unten ein Hinweis mit den Schritten, passend zum Browser.

## Starten

Per Doppelklick auf `index.html` läuft die App direkt vom Mac. Das Mikrofon geht dann je nach Browser nicht, die Referenztöne und der Kammerton schon.

Mit Mikrofon über einen lokalen Server:

```bash
ruby -run -e httpd . -p 8766
```

Dann `http://localhost:8766` öffnen.

## Prüfen

```bash
osascript -l JavaScript skripte/pruefen.js
```

Das Skript erzeugt gezupfte Saiten in allen Stimmungen mit den Kammertönen 430, 440 und 450 Hz und prüft, ob die Erkennung sie auf 1 Cent genau trifft. Dazu jeden Halbton im freien Modus, die Referenztöne, Stille und Rauschen. Außerdem prüft es die Reihenfolge Frei, Gitarre, Ukulele, den Start auf Frei, ob jede Datei der Seite in der Offline-Liste steht, die Syntax der Skripte, ob jede gesuchte ID in `index.html` steht, Gedankenstriche in den Texten, die Größen der Icons und für 18 Geräte und Browser, ob der richtige Hinweis zum Installieren kommt. Es muss mit 0 Fehlern enden.

Die Tonerkennung sucht zwischen 50 und 1500 Hz. Das reicht vom tiefen D der Gitarre (73 Hz) bis E6 (1318 Hz). Darunter misst sie ungenau, darüber zeigt sie den Ton eine Oktave zu tief.

## Aufbau

```
index.html, style.css         Oberfläche
app.js                        Zustand, Hell/Dunkel, Hintergrund, Offline
stimmen.js                    Stimmgerät: Stimmungen, Tonerkennung, Seite
klang.js                      Klangausgabe für Referenztöne und Kammerton
installieren.js               Hinweis zum Installieren auf iPhone, iPad und Android
sw.js, manifest.webmanifest   Offline-Modus und Installation
icons/                        App-Icons
skripte/pruefen.js            Prüfung von Tonerkennung, Seite und Hinweis
```

## Auf iPhone und iPad installieren (über GitHub Pages)

Die App muss einmal im Internet liegen, damit Safari sie installieren kann. GitHub Pages ist dafür kostenlos, das Repository muss dafür öffentlich sein.

**Ohne Git (am einfachsten):**

1. Auf github.com ein neues Repository anlegen, zum Beispiel `tuner`, Sichtbarkeit **Public**.
2. Auf der leeren Repository-Seite „uploading an existing file“ wählen und diese Dateien hineinziehen: `index.html`, `style.css`, `app.js`, `stimmen.js`, `klang.js`, `installieren.js`, `sw.js`, `manifest.webmanifest` und den Ordner `icons`. Mit „Commit changes“ bestätigen.
3. Unter **Settings → Pages** bei „Source“ „Deploy from a branch“ wählen, Branch `main`, Ordner `/ (root)`, speichern.
4. Nach ein bis zwei Minuten läuft die App unter `https://DEIN-NAME.github.io/tuner/`.

**Mit Git:** den ganzen Ordner in ein Repository pushen und Pages wie oben auf `main` und `/ (root)` stellen. Die Skripte und diese Datei liegen dann mit im Netz, das stört nicht. Auf diesem Mac braucht Git vorher die Entwicklerwerkzeuge (`xcode-select --install`).

**Auf dem iPhone oder iPad:**

1. Die Adresse in **Safari** öffnen und kurz warten, bis unten „Offline verfügbar“ steht.
2. Auf das Teilen-Symbol tippen, dann **„Zum Home-Bildschirm“** und „Hinzufügen“.
3. Die App startet jetzt vom Home-Bildschirm im Vollbild und funktioniert auch im Flugmodus.
4. Beim ersten Tipp auf „Mikrofon starten“ fragt iOS nach der Erlaubnis.

**Auf Android:** Die Adresse in Chrome öffnen, dann **Installieren** im Hinweis antippen oder im Menü ⋮ **App installieren** wählen.

Wer die Seite auf iPhone, iPad oder Android im Browser öffnet, bekommt nach kurzer Zeit unten einen Hinweis mit genau diesen Schritten, passend zum Browser. In Chrome, Edge und Samsung Internet auf Android installiert ein Knopf die App direkt. Öffnet jemand den Link in Instagram, Facebook oder einer anderen App, sagt der Hinweis, dass die Seite erst in Safari oder Chrome geöffnet werden muss. Wer den Hinweis schließt, sieht ihn nicht mehr von selbst und findet ihn unten im Fuß unter „Tuner als App installieren“. In der installierten App und auf dem Computer erscheint er nicht.

Die Einstellungen (Instrument, Stimmung, Kammerton, Hell/Dunkel, geschlossener Hinweis) speichert jedes Gerät für sich.

Updates: Geänderte Dateien hochladen und in `sw.js` die `VERSION` erhöhen. Die installierte App holt sich die neue Fassung, sobald sie mit Internet geöffnet wird, und zeigt sie beim nächsten Start.
