[English](README.md) · **Deutsch**

# Prompt Atelier Nano

Prompt Atelier als einzelne HTML-Datei. Ohne Server, ohne Datenbank, ohne
Installation.

Die vollständige Anwendung braucht Ruby und einen Webserver. Auf vielen
Arbeitsplatzrechnern ist beides nicht vorhanden, und einen lokalen Server zu
starten ist nicht erlaubt. Für diesen Fall ist Prompt Atelier Nano gebaut. Eine
Datei wird auf den Rechner kopiert und per Doppelklick geöffnet. Alles läuft im
Browser.

```
Prompt suchen  →  Felder ausfüllen  →  Vorschau prüfen  →  kopieren
```

Prompts lassen sich in beide Richtungen mit der vollständigen Anwendung
austauschen. Das Dateiformat ist dasselbe.

---

## Bildschirmfotos

| | |
|---|---|
| ![Create new Prompt](img/PromptStorageNano-NewPrompt.jpg) |  ![Edit the execution prompt](img/PromptStorageNano-ExecPrompt.jpg) |
| ![Keywords](img/PromptStorageNano-Keywords.jpg) | ![Prompt Export/Import](img/PromptStorageNano-Export.jpg) |
| ![Library](img/PromptStorageNano-Library.jpg) | |

---

## Funktionen

| Bereich | Beschreibung |
|---|---|
| Bibliothek | Volltextsuche über Titel, Beschreibung, Text und Tags. Schreibweisen werden aufgelöst, `Größe` wird auch mit `groesse` oder `grosse` gefunden |
| Variablen | Platzhalter in doppelten geschweiften Klammern werden zu Formularfeldern mit Vorbelegung, Pflichtangabe und Auswahlliste |
| Vorschau | Der fertige Text entsteht beim Tippen. Nano und die vollständige Anwendung liefern Zeichen für Zeichen dasselbe Ergebnis |
| Keywords | Wiederverwendbare Textbausteine vor oder hinter einem Prompt |
| Tags | Das einzige Ordnungsmittel. Es gibt keine Ordner und keine Workspaces |
| Änderungsverlauf | Papierkorb mit 30 Tagen Aufbewahrung und Rückgängig der letzten Änderung |
| Import und Export | JSON und Markdown, und JSON ist in beide Richtungen verlustfrei |
| Sicherung auf die Festplatte | Die Sammlung lässt sich bei jeder Änderung in eine selbst gewählte Datei schreiben |
| Oberflächensprachen | Deutsch, Englisch, Französisch, Italienisch, Spanisch |

Es gibt keine Anmeldung, kein Benutzerkonto und keine Verwaltung. Die Anwendung
stellt keinerlei Anfrage an das Netzwerk.

---

## Voraussetzungen

| Punkt | Anforderung |
|---|---|
| Browser | Ein aktueller Chromium, Edge, Firefox oder Safari. Siehe unten |
| Speicherplatz | Etwa 440 kB für die Datei |
| Sonstiges | Nichts. Kein Ruby, kein Node.js, keine Installation, keine Netzverbindung |

Die Anwendung ist für Sammlungen bis 500 Prompts ausgelegt.

Geprüft ist sie mit Chromium 151, Firefox 153, WebKit 605 und Microsoft Edge 151.
Ältere Ausgaben laufen voraussichtlich ebenfalls, sind aber nicht ausprobiert
worden. Deshalb wird hier keine Mindestversion genannt.

Was ein bestimmter Rechner tatsächlich zulässt, wird beim Start ermittelt und in
der Oberfläche angezeigt, denn eine Richtlinie kann den Browserspeicher
abschalten. Siehe [doc/installation.de.md](doc/installation.de.md), Kapitel 4.

---

## Erste Schritte

Laden Sie `prompt-atelier-nano-<Version>.zip` von der
[Releases-Seite](https://github.com/form1c/prompt-atelier-nano/releases) herunter,
oder nehmen Sie die HTML-Datei daraus und geben Sie diese allein weiter. Mehr
braucht die Anwendung aus dem Archiv nicht.

1. `prompt-atelier-nano.html` auf den Rechner kopieren, in einen Ordner, der
   mitgesichert wird.
2. Per Doppelklick öffnen.
3. Die eine Frage beim ersten Start beantworten. Sie fragt, ob mit 55
   Beispiel-Prompts oder mit einer leeren Sammlung begonnen werden soll.

> **Achtung:** Ihre Prompts liegen im Speicher Ihres Browsers, nicht in der
> HTML-Datei. Wer die Browserdaten löscht, löscht sie mit. Bitte Kapitel 1 der
> Anleitung lesen, bevor Sie zu arbeiten anfangen.

---

## Dokumentation

| Dokument | Leser |
|---|---|
| [doc/manual.de.md](doc/manual.de.md) | Wer die Anwendung benutzt |
| [doc/installation.de.md](doc/installation.de.md) | Wer sie weitergibt oder auf eine Freigabe legt |
| [doc/development.de.md](doc/development.de.md) | Wer am Quelltext arbeitet |

Jedes Dokument gibt es auch auf Englisch, ohne das Kürzel `.de`.

---

## Wie es gebaut ist

Die Anwendung ist eine Oberfläche in Vue 3. In der vollständigen Anwendung holt
sie ihre Daten über HTTP von einem Ruby-Server. Hier beantwortet sie dieselben
Aufrufe selbst, aus einer Sammlung im Browser. Von den 49 aus der vollständigen
Anwendung übernommenen Dateien werden 41 unverändert weiterbenutzt.

Beim Bauen entsteht eine einzige Datei. Skript, Gestaltung, Symbole,
Übersetzungen und Beispieldaten werden in die HTML hineingeschrieben, weil ein
Browser, der eine Datei aus einem Ordner öffnet, das Nachladen von
Nachbardateien verweigert. Eine
Sicherheitsrichtlinie ohne `unsafe-inline` bleibt eingehalten, indem jeder
eingebettete Block über seine Prüfsumme benannt wird.

Die Ablage wird beim Start durch Ausprobieren ermittelt, nicht durch Abfragen.
Bevorzugt wird IndexedDB, danach `localStorage`. Fällt beides aus, läuft die
Anwendung im Arbeitsspeicher und sagt das ohne Unterlass.

Einzelheiten in [doc/development.de.md](doc/development.de.md).

---

## Lizenz

MIT. Siehe [LICENSE](LICENSE.md).

Prompt Atelier Nano ist von Prompt Atelier abgeleitet und teilt einen großen Teil
von dessen Quelltext. Aus welcher Version es gebaut wurde, steht am Fuß der
Seitenleiste.
