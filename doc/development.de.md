[English](development.md) · **Deutsch**

# Prompt Atelier Nano: Entwicklerhandbuch

| | |
|---|---|
| Fassung | 1.0 |
| Stand | 2026-08-15 |
| Zielgruppe | Wer am Quelltext arbeitet |
| Abgrenzung | Aufbau, Entwicklungsumgebung, Entwurfsentscheidungen und ihre Begründung. Die Weitergabe steht in `installation.de.md`, die tägliche Benutzung in `manual.de.md` |

---

## Inhalt

1. Überblick
2. Entwicklungsumgebung einrichten
3. Verzeichnisaufbau
4. Das Verhältnis zu Prompt Atelier
5. Die Naht
6. Ablage
7. Suche und Normalisierung
8. Der Bauvorgang
9. Tests
10. Skripte
11. Übersetzungen
12. Ausliefern
13. Worin Nano von der vollständigen Anwendung abweicht

---

## 1. Überblick

Prompt Atelier Nano ist die Oberfläche von Prompt Atelier ohne deren Backend. Von den 49
übernommenen Dateien werden 41 unverändert benutzt. An der Stelle des Ruby-Servers
beantwortet die Oberfläche dieselben Aufrufe selbst, aus einer Sammlung im
Browser.

Drei Dinge sind neu, alles Übrige ist kopiert:

| Neu | Ersetzt |
|---|---|
| Eine Speicherschicht im Browser | SQLite |
| Eine Suche in JavaScript | SQLite FTS5 |
| Ein Bauvorgang, der eine HTML-Datei erzeugt | Die Bauwerkzeuge und den Webserver |

Das Ergebnis ist eine Datei, die aus einem Ordner geöffnet wird. Die Adresse
beginnt also mit `file://`, und diese Einschränkung prägt die meisten der
folgenden Entscheidungen.

---

## 2. Entwicklungsumgebung einrichten

Node 20 oder neuer wird vorausgesetzt.

> **Hinweis:** Eine Arbeitskopie von [Prompt Atelier](https://github.com/form1c/prompt-atelier)
> muss neben diesem Repository liegen. Ohne sie bricht der Bau mit Rückgabewert 1 ab und erzeugt keine Datei,
> denn 49 der Quelldateien werden von dort kopiert und liegen nicht in diesem
> Repository. Siehe Kapitel 4.

**Nach dem Klonen ist der Pfad zu dieser Arbeitskopie einmal einzustellen.** Er
steht in `sync.manifest.json` unter `source` und wird gegen die Wurzel dieses
Repositorys aufgelöst:

```json
"source": "../../PromptStorage/project"
```

Dieser Wert gilt für den Arbeitsordner, in dem das Vorhaben entwickelt wird, wo
beide Repositorys eine Ebene unterhalb eines gemeinsamen Ordners liegen. **Zwei
nebeneinander abgelegte Klone haben diese Zwischenebene nicht**, der Pfad ist
also um einen Schritt zu kürzen und auf den Namen zu setzen, den der Klon
tatsächlich trägt:

```json
"source": "../prompt-atelier/project"
```

`source` ist das einzige Feld dieser Datei, das von Hand geändert werden soll.
`sha256`, `syncedAt` und `sourceVersion` schreibt der Abgleich, sie bleiben
unangetastet.

```bash
cd project
npm install
npm run check
```

`npm run check` führt alles aus: Abgleich, Prüfung der Kopierliste, die Tests
unter Node, den Prüfstand in drei Engines, die Abnahme und `screens.mjs`. Es ist
der eine Befehl, der beantwortet, ob der Arbeitsstand in Ordnung ist.

```bash
npm run dev      # Entwicklungsserver, nur der Bequemlichkeit halber
npm run build    # dist/index.html, das eigentliche Ergebnis
npm run release  # release/, das, was weitergegeben wird
```

> **Hinweis:** Der Entwicklungsserver ist nicht der ausgelieferte Bau. Alles, was
> an diesem Vorhaben zählt, ist eine Eigenschaft der einzelnen Datei über
> `file://`. Zur Prüfung `npm run build` benutzen und das Ergebnis per Doppelklick
> öffnen.

Playwright wird aus der Nachbarinstallation von Prompt Atelier geliehen. Fehlt
sie, überspringen sich die Browserläufe mit einer Meldung, statt zu scheitern.

---

## 3. Verzeichnisaufbau

So sieht ein Klon aus. Das Repository ist das Verzeichnis `project/` des
Arbeitsordners, alles Folgende liegt also in der Wurzel des Klons.

```
├── README.md               Einstieg, englisch
├── README.de.md            Einstieg, deutsch
├── LICENSE.md
├── .gitignore
├── doc/                    die drei Handbücher, englisch und deutsch
├── src/                    Nano-eigener Quelltext, beschattet vendor/
│   ├── api/client.js       die Naht
│   ├── store/              Ablage, Sammlung, Suche, Austausch, Aufbewahrung
│   ├── state/session.js
│   ├── components/
│   └── views/
├── tests/
│   ├── sync.test.js        die Tests unter Node
│   ├── browser/            der Prüfstand
│   └── vectors/            Suchvektoren, aus Ruby erzeugt
├── img/                    das Symbol des Browserreiters und die Bildschirmfotos
├── probe/                  die Prüfdatei für den Arbeitsplatz
├── scripts/                acht Skripte, davon eines in Ruby
├── sync.manifest.json      Kopierliste und Prüfsummen
├── index.html
├── package.json
├── vite.config.js
└── vite.tests.config.js
```

Ein Verzeichnis fehlt in dieser Liste, weil es nicht im Repository liegt:

```
└── vendor/                 aus Prompt Atelier kopiert, schreibgeschützt, nicht versioniert
```

`vendor/` ist abgeleitet und steht in `.gitignore`. Versioniert wird
`sync.manifest.json`, dessen Prüfsummen genau festhalten, welcher Stand
übernommen wurde.

---

## 4. Das Verhältnis zu Prompt Atelier

Nano liegt in einem eigenen Repository, damit Arbeit daran die Hauptanwendung
nicht erreichen kann. Der Abgleich liest ausschließlich aus `PromptStorage` und
schreibt nie dorthin.

```bash
npm run sync          # die gemeinsam benutzten Dateien nach vendor/ holen
npm run sync:check    # nur berichten, nichts schreiben
```

Die Kopierliste umfasst 49 Dateien. Der Abgleich bricht ab, wenn eine kopierte
Datei örtlich verändert wurde, wenn eine gelistete Datei fehlt oder wenn ein
Kopierziel `vendor/` verlassen würde.

### 4.1 Schattendateien

Nicht jede kopierte Datei kann unverändert bleiben. Der Vite-Alias `@` löst
`src/` vor `vendor/` auf, eine Datei, die Nano anders braucht, wird also unter
demselben Pfad in `src/` angelegt und **beschattet** ihr Gegenstück.

Dazu gehört zwingend:

> **Hinweis:** Der Abgleich bricht ab, wenn sich das Original einer Schattendatei
> oben geändert hat, und nennt die Datei. Das ist der Zeitpunkt, an dem zu
> entscheiden ist, ob die Änderung nachzuziehen ist. Bestätigt wird mit
> `npm run sync -- --accept-shadows`.

Acht Dateien sind beschattet, und diese Zahl ist die Kennzahl des Vorhabens.
Oberhalb von etwa zehn liegt die Naht aus Kapitel 5 an der falschen Stelle.

| Datei | Warum |
|---|---|
| `api/client.js` | Verteilt örtlich statt über `fetch`. Vollständig ersetzt |
| `main.js` | Keine Sitzungsbehandlung, und hier steht die Selbstprüfung der Ablage |
| `App.vue` | Keine Einblendung für abgelaufene Sitzungen, dafür die Frage beim ersten Start |
| `router/index.js` | Rautenpfade, weniger Routen, keine Anmeldewachen |
| `i18n/index.js` | Umhüllt die Textsuche, damit Nano-eigene Sätze einen Ort haben |
| `components/AppShell.vue` | Kopfzeile ohne Workspace-Umschalter und Abmelden |
| `views/TrashView.vue` | Kein Konto, das als Löschender zu nennen wäre, dafür die verbleibende Frist |
| `views/PromptTransferView.vue` | Kein Workspace zur Auswahl, übrig bleibt die Bestätigung |

Sechs weitere Ansichten brauchen keinen Schatten. Sie binden alle
`@/state/session` ein, und diese Datei steht nicht auf der Kopierliste. Nanos
eigene Ausführung davon ist deshalb kein Schatten, sondern ein Modul ohne
Gegenstück.

### 4.2 Nano-eigene Textbausteine

Die kopierten Sprachdateien dürfen nicht bearbeitet werden. Nano-eigene Sätze
liegen deshalb in `src/i18n/texts.json` unter zwei Präfixen, `storage.` und
`nano.`, und die Hauptanwendung benutzt keines von beiden.

Die Präfixe sind die ganze Regel. Ein Satz für den Papierkorb läse sich als
`trash.expiry` natürlich, neben dreißig `trash.*`-Schlüsseln der Hauptanwendung,
und an dem Tag, an dem dort ein Schlüssel dieses Namens entsteht, verschluckte
diese Tabelle ihn wortlos.

---

## 5. Die Naht

`src/api/client.js` ist die Naht des ganzen Vorhabens. Sie behält die Signatur
des Originals, sodass die Ansichten darüber unverändert bleiben, und
macht aus jedem Aufruf einen Vorgang auf der abgelegten Sammlung.

Zwei Eigenschaften müssen erhalten bleiben, sonst brechen die Ansichten auf
eine Weise, die nach ihrem eigenen Fehler aussieht:

1. Jeder Fehlschlag ist ein `ApiError`. Die Ansichten prüfen mit `instanceof`
   und werfen alles andere weiter.
2. Der Satz wird hier aus einem Code geschrieben, nicht vom Server geliefert. Das
   galt schon oben, und deshalb funktioniert die ganze Übersetzungsschicht
   unverändert.

Der Endpunktvertrag, den diese Schicht nachbildet, steht im Anforderungsdokument
von Prompt Atelier, das nicht Teil dieses Repositorys ist. Er ist der Grund,
warum dieser Schnitt nichts kostet: Er war bereits aufgeschrieben und bereits
geprüft, bevor es Nano gab.

Routen, die im Vertrag stehen und keinen Bearbeiter haben, antworten mit 501 und
nennen die Lücke. Eine Route, die stillschweigend nichts zurückgibt, wäre von
einer fehlerhaften Antwort nicht zu unterscheiden.

---

## 6. Ablage

`src/store/storage.js` probiert drei Stufen der Reihe nach und benutzt die, die
antwortet.

| Stufe | Ablage | Grenze |
|---|---|---|
| 2 | IndexedDB | Hunderte Megabyte |
| 3 | `localStorage` | Etwa 5,2 Millionen Zeichen |
| 4 | Arbeitsspeicher | Die Sitzung |

> **Hinweis:** Alles hier wird durch Ausprobieren entschieden, nie durch
> Abfragen. `'localStorage' in window` ist auch auf einem Rechner wahr, auf dem
> jeder Zugriff eine Ausnahme wirft, und ein verwalteter Arbeitsplatz ist genau
> der Ort, an dem das geschieht. Jeder Adapter schreibt eine Marke, liest sie
> zurück, entfernt sie und behauptet erst dann, zu funktionieren.

Die schlichte Existenzprüfung war einmal selbst der werfende Zugriff. Mit beiden
abgeschalteten Stufen starb der Start an dieser Stelle, und die Anwendung kam
ohne Stufe und ohne jede Warnung hoch, was der schlechteste aller Zustände ist.

Stufe 4 ist ein Betriebszustand, kein Fehler. Die Anwendung ist darin vollständig
und kann nur nichts behalten, und die Kopfzeile sagt das ohne Unterlass.

### 6.1 Stufe 1, die Datei auf der Festplatte

Stufe 1 steht nicht in der Liste oben und gehört nicht hinein. Der gespeicherte
Zugriff auf eine gewählte Datei übersteht einen Neustart, seine Erlaubnis nicht.
`queryPermission` antwortet zu Sitzungsbeginn mit `prompt`, die Datei ist also
vor einem Klick nicht lesbar.

Eine Ablage, die vor einem Klick nicht lesbar ist, kann nicht die Ablage sein,
aus der die Anwendung startet. Stufe 1 ist deshalb als **fortlaufende Sicherung
neben** der Ablage gebaut: Bei jeder Änderung wird die Sammlung in eine selbst
gewählte Datei geschrieben, im Austauschformat aus Kapitel 17.1.

Daraus folgen drei Dinge, und alle drei sind ein Gewinn. Die Datei ist eine, die
Prompt Atelier lesen kann. Das Zurücklesen ist der vorhandene Import mit Vorschau
und Alles-oder-nichts. Und die Zahl der ungesicherten Änderungen verschwindet,
weil sie fortlaufend unwahr ist.

### 6.2 Versionen der Sammlung

Die abgelegte Sammlung trägt eine Versionsnummer. Drei Fälle beim Laden, und der
dritte ist der, den man vergisst:

| Fall | Verhalten |
|---|---|
| Gleiche Version | Laden |
| Ältere Version | Erst ungefragt exportieren, dann migrieren, dann laden |
| Neuere Version | Ablehnen. Eine ältere Ausgabe der Anwendung, die eine neuere Sammlung liest, ließe die ihr unbekannten Felder weg, und sie stillschweigend wegzulassen wäre ein unangekündigter Datenverlust |

---

## 7. Suche und Normalisierung

`src/store/search.js` bildet nach, was der Server von SQLite bekommt. Die
Normalisierung geschieht in **zwei** Schritten, und der zweite wird leicht
übersehen:

1. Die Buchstaben- und Digraphentabellen aus `normalization.rb`.
2. Zerlegung nach NFD und Entfernen der Kombinationszeichen.

Ruby lässt Akzente stehen, weil der FTS5-Tokenizer mit
`unicode61 remove_diacritics 2` sie danach entfernt. Wer nur den ersten Schritt
überträgt, verliert still jedes Wort mit Akzent.

Der Nachweis ist `tests/vectors/search.json`, erzeugt von
`scripts/make-search-vectors.rb`. Dieses Skript ist das einzige Ruby im
Repository. Es ruft das echte `Normalization.normalize` auf und fragt dann SQLite
selbst über eine `fts5vocab`-Tabelle, was sein Tokenizer daraus macht. Der zweite
Schritt wird befragt statt beschrieben, denn eine Beschreibung wäre eine dritte
Umsetzung.

> **Hinweis:** `fts5vocab` ist ein Wörterbuch. Es hat keine Reihenfolge und keine
> Wiederholung. Die Vektoren sagen, welche Tokens es gibt, nie in welcher Folge.

Sortiert wird über `Intl.Collator`. SQLite vergleicht Bytes, die Hauptanwendung
führt deshalb eine gefaltete Sortierspalte und 161 von Hand geschriebene
Ersetzungen mit. Der Browser bringt eine Sortierung nach Alphabet mit, sodass
beides hier entfällt.

---

## 8. Der Bauvorgang

Vier Entscheidungen, an jeder einzelnen würde die Anwendung sonst scheitern:

1. **Ein klassisches Skript, kein Modul.** Chromium und Firefox lehnen ein
   `<script type="module">` unter `file://` als herkunftsübergreifende Anfrage
   ab, das Bündel ist also ein IIFE.
2. **Eine Datei.** Alles getrennt Geladene würde nachgefordert, und auch eine
   Anfrage an eine Nachbardatei ist blockiert.
3. **Keine verzögerten Importe übrig.** `inlineDynamicImports` faltet sie ein.
4. **`@/x` löst `src/` vor `vendor/` auf.** Vites Alias bildet ein Präfix auf
   genau ein Verzeichnis ab, das steht deshalb in einem Plugin.

Die Sicherheitsrichtlinie ist ein `<meta>`-Element, das jeden eingebetteten Block
über seine SHA-256-Prüfsumme benennt. So hält eine einzelne Datei, die aus nichts
als Inline-Inhalt besteht, eine Richtlinie ohne `unsafe-inline` ein.
`connect-src 'none'` macht aus der Zusage, keine Anfragen an das Netzwerk zu
stellen, etwas, das der Browser erzwingt.

> **Hinweis:** `String.replace` deutet `$&` im Ersatztext. Das Vue-Bündel enthält
> `$&`, eine Ersetzung mit einer Zeichenkette setzte deshalb einmal ein
> wörtliches `</body>` mitten in das JavaScript. Der Bauvorgang lief ohne Klage
> durch, und die Anwendung starb in jedem Browser. Eine Ersetzungsfunktion benutzen.

`buildInfo()` backt die Version, die Version von Prompt Atelier, aus der gebaut
wurde, und beide Daten in das Bündel, weil es keinen Prozess gibt, der
`GET /version` beantworten könnte.

Das Symbol des Browserreiters wird auf demselben Weg eingesetzt, aus
`img/favicon.png`, als Data-URI. Es ist ein Rahmen von 32 Pixeln aus dem
Symbol, das die Hauptanwendung als Datei ausliefert. Jenes trägt neun Größen
als unkomprimierte Bitmaps und ist größer als diese ganze Anwendung, vollständig
eingebettet risse es also die Größenzusage. Ein Rahmen als optimiertes PNG
kostet verdichtet 2,4 kB.

---

## 9. Tests

Drei Ebenen, und jede besteht, weil die darüberliegende nicht sehen kann, was sie
abdeckt.

```bash
npm test              # unter Node: Abgleich, Kopierliste, Schattenbuchführung
npm run test:browser  # der Prüfstand, mit -- --all in drei Engines
npm run accept        # die Zusagen, an der ausgelieferten Datei gemessen
npm run screens       # liest die Texte der ausgelieferten Ansichten, urteilt nicht
```

**Der Prüfstand** ist gebaut wie die Anwendung, eine Datei, klassisches Skript,
über `file://` geöffnet. Ein Prüfstand unter anderen Regeln würde etwas über
einen Bau beweisen, den niemand ausliefert. Für den Nachweis einer
Endpunktschicht ist die Bedienoberfläche das ungeeignete Werkzeug, weil ein
Fehlschlag dann ebenso an einem Selektor liegen kann wie an der geprüften
Schicht.

**Die Abnahme** misst an der ausgelieferten Datei. Sie fand einen Fehler, den die
58 Fälle des Prüfstands nicht sehen konnten, weil der Prüfstand keine Ansichten
aufruft: Die Bibliothek hatte ihre Prompts bereits angefordert, als die Beispiele
hinter ihrem Rücken eingefügt wurden.

**`screens.mjs`** liest Texte und klickt nie. Es ist kein Test und darf keiner
werden.

Zwei Nutzertests sind in den Projektdokumenten benannt und lassen sich nicht
automatisieren. Der Dateiwähler ist ein Fenster des Betriebssystems.

---

## 10. Skripte

| Skript | Zweck |
|---|---|
| `sync.mjs` | Der einseitige Abgleich. Liest `PromptStorage`, schreibt nur `vendor/` |
| `audit.mjs` | Verfolgt den Importbaum vom Einstiegspunkt und hält ihn gegen die Kopierliste |
| `accept.mjs` | Die Abnahme |
| `screens.mjs` | Gibt aus, was die ausgelieferten Ansichten sagen |
| `release.mjs` | Baut, lässt alles laufen und schreibt erst danach `release/` |
| `package.mjs` | Erzeugt das Archiv, das weitergegeben wird |
| `run-browser-tests.mjs` | Treibt den Prüfstand in echten Engines |
| `make-search-vectors.rb` | Das einzige Ruby. Läuft von Hand, wenn sich die Normalisierung ändert |

> **Hinweis:** Der Abgleich setzt den Schreibschutz bei jedem Lauf neu, auch für
> Dateien, die er nicht geschrieben hat. Ihn nur beim Schreiben zu setzen hieß,
> dass eine Kopie mit anderswo geänderten Rechten für immer schreibbar blieb und
> die Zusicherung, auf der Regel 1 ruht, wortlos aufhörte zu gelten.

---

## 11. Übersetzungen

Fünf Sprachen werden aus Prompt Atelier kopiert und fest eingebunden. Unter
`file://` wäre ein verzögerter Import eine zweite Datei, eine zweite Datei würde
nachgefordert, und eine Anfrage ist blockiert.

Nano-eigene Sätze liegen in `src/i18n/texts.json` unter `storage.` und `nano.`,
siehe Kapitel 4.2.

Ein neuer Satz gehört in alle fünf Sprachen. Fehlt einer Sprache der eigene
Eintrag, antwortet die Textsuche auf Englisch. Bei den kopierten Sprachdateien
ist das richtig, hier bleibt es unbemerkt: Eine Tabelle mit zwei von fünf
Sprachen sieht in der Anwendung wie eine vollständige aus. Der Prüfstand hält
deshalb jede Sprache an jedem Satz fest.

---

## 12. Ausliefern

```bash
npm run release
```

Baut, führt die Tests unter Node, den Prüfstand in drei Engines und die Abnahme aus
und schreibt erst danach `release/`. Reißt ein Lauf, bricht es ab und
schreibt nichts. Eine Auslieferung, deren Messungen nicht gehalten haben, ist
keine, und ein Ordner, der sie trotzdem enthält, ist ein Ordner, aus dem jemand
sie weitergibt.

```bash
npm run package
```

Ergänzt das Archiv `prompt-atelier-nano-<Version>.zip` mit der Anwendung, beiden
Readmes, den sechs Handbüchern, der Lizenz und einer `VERSION`-Datei.

Die Versionsnummer kommt aus `package.json`. Sie wird dort erhöht und nirgends
sonst.

Die `VERSION`-Datei nennt Version, Baudatum und zwei Commits: `commit` ist
dieses Repository, `source_commit` der Stand von Prompt Atelier, aus dem die
kopierten Dateien stammen. Beide werden in dem Repository erfragt, das sie
beschreiben. Fehlt eines oder gibt es noch keinen Commit, steht dort `unknown`,
und der Bau sagt es in seiner Ausgabe. **Vor dem Bau eines Archivs, das
veröffentlicht werden soll, erst festschreiben**, sonst trägt es `unknown`,
wahrheitsgemäß und ohne Nutzen.

---

## 13. Worin Nano von der vollständigen Anwendung abweicht

Prompt Atelier ist in einem Anforderungsdokument festgelegt, das nicht Teil
dieses Repositorys ist. Die Unterschiede, die ein Entwickler kennen muss, stehen
deshalb hier vollständig und nicht als Verweis.

| Gegenstand | In Nano |
|---|---|
| Revisionen | Eine je Prompt statt einer einstellbaren Anzahl. Zwanzig je Prompt belegten bei zweihundert Prompts zwischen 116 und 437 Prozent der Speichergrenze. Eine Revision ist das, was das Rückgängigmachen der letzten Änderung braucht |
| Der Aufräumlauf des Papierkorbs | Läuft bei jedem Start statt einmal täglich und meldet in der Anwendung statt in einem Protokoll. Es läuft kein Prozess, während niemand da ist |
| Einrichtung einer Instanz | Entfällt. Der erste Start stellt eine Frage, die nach den Beispielen |
| Sicherheitsrichtlinie | Eingehalten, indem jeder eingebettete Block über seine Prüfsumme benannt wird, statt Quelltext in eigene Dateien auszulagern. Eine einzelne Datei besteht aus nichts als Inline-Inhalt |
| Sicherung vor einer Migration | Eine Exportdatei, ungefragt herausgegeben, weil es keine Datenbankdatei zum Kopieren gibt |

Konten, Rollen, Workspaces, Sitzungen, E-Mail und Verwaltung haben hier
überhaupt keinen Gegenstand.
