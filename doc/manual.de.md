[English](manual.md) · **Deutsch**

# Prompt Atelier Nano: Anleitung

| | |
|---|---|
| Fassung | 1.0 |
| Stand | 2026-08-15 |
| Zielgruppe | Wer die Anwendung benutzt |
| Abgrenzung | Die tägliche Arbeit, von der Haltbarkeit der Daten bis zum Austausch von Prompts. Die Weitergabe an weitere Rechner steht in `installation.de.md` |

Eine Datei, ein Doppelklick, keine Installation. Kein Ruby, kein Server, keine
Netzverbindung.

Die Oberfläche folgt der Sprache Ihres Browsers. Die in dieser Anleitung
genannten Beschriftungen sind die deutschen.

---

## Inhalt

1. Wo Ihre Prompts liegen
2. Der erste Start
3. Aufbau eines Prompts
4. Einen Prompt benutzen
5. Ordnung halten
6. Änderungen zurücknehmen
7. Prompts austauschen
8. Zwei Einschränkungen
9. Wenn Sie einen Fehler melden
10. Tastatur
11. Was diese Version nicht kann

---

## 1. Wo Ihre Prompts liegen

Bitte dieses Kapitel vor der ersten Benutzung lesen. Die übrigen Kapitel lassen
sich bei Bedarf nachschlagen.

Ihre Prompts liegen im Speicher Ihres Browsers, nicht in der HTML-Datei. Die
Datei enthält das Programm, die Sammlung liegt getrennt davon. Daraus folgen
zwei Aussagen.

Die Sammlung übersteht das Schließen des Browsers und einen Neustart des
Rechners.

Sie übersteht das Löschen der Browserdaten nicht. Dasselbe gilt für eine
Richtlinie Ihrer IT-Abteilung, die beim Abmelden aufräumt, und für ein neues
Benutzerprofil. Kein Programm kann das verhindern, auch dieses nicht.

> **Achtung:** Der Browserspeicher ist Ihr Arbeitsplatz. Er ist nicht Ihr Archiv.

### 1.1 Zwei Wege zur Sicherung

Es gibt zwei Wege. Der erste ist der bessere. Er kostet einen Klick zu Beginn und
danach einen je Sitzung.

**Eine Datei wählen.** Unter der Kopfzeile steht eine Zeile, die mit `Ablage:`
beginnt. Daneben steht das Angebot **Zusätzlich in eine Datei auf der Festplatte
sichern**. Klicken Sie darauf und wählen Sie einen Ort, den Sie wiederfinden, am
besten einen, der mitgesichert wird. Von da an schreibt die Anwendung bei jeder
Änderung Ihre ganze Sammlung dorthin, ohne dass Sie etwas tun müssen.

Ihr Browser fragt einmal je Sitzung nach einer Bestätigung. Er erteilt die
Erlaubnis zum Schreiben einer Datei absichtlich nur befristet, damit sie nicht
unbemerkt fortbesteht. Die Anfrage erscheint als Leiste mit einer Schaltfläche.
Nach einem Klick wird weitergeschrieben.

Falls Ihr Browser diese Möglichkeit nicht bietet, erscheint das Angebot gar nicht
erst. Dann bleibt der zweite Weg.

**Von Hand exportieren.** Oben rechts steht eine Zahl wie `12 ungesichert`. Sie
zählt, was seit der letzten Sicherung geschehen ist. Klicken Sie darauf, dann auf
**Exportieren**, und legen Sie die Datei an einen Ort, an dem sie nicht verloren
geht. Danach steht die Zahl wieder auf null.

Haben Sie eine Datei gewählt, entfällt diese Zahl. Es besteht dann fortlaufend
eine aktuelle Sicherung, sodass die Zahl keine Aussage mehr träfe.

### 1.2 Wiederherstellen

Öffnen Sie die HTML-Datei, gehen Sie auf **Import/Export** und lesen Sie Ihre
Sicherungsdatei ein. Sie ist eine gewöhnliche Exportdatei.

---

## 2. Der erste Start

Beim allerersten Öffnen werden Sie einmal gefragt, ob Sie mit 55 Beispielen
anfangen möchten oder mit einer leeren Sammlung. Beides lässt sich später ändern. Beispiele können Sie
löschen, eigene Prompts jederzeit anlegen. Die Frage kommt nur dieses eine Mal.

Falls Sie unsicher sind, wählen Sie die Beispiele. Sie zeigen den Aufbau eines
Prompts mit Platzhaltern an fertigen Fällen. Nicht benötigte Beispiele lassen
sich markieren und gemeinsam löschen.

---

## 3. Aufbau eines Prompts

Ein Prompt ist ein Text, den Sie immer wieder benutzen, mit Platzhaltern, die Sie
beim Benutzen ausfüllen.

```text
Schreibe eine {{textart}} über {{thema}} für {{zielgruppe}}.
Der Ton soll {{ton}} sein.
```

Die doppelten geschweiften Klammern kennzeichnen die Platzhalter. Der Text bestimmt,
welche Platzhalter es gibt. Sie legen sie nicht getrennt an. Schreiben Sie
`{{thema}}` in den Text, ist der Platzhalter da. Nehmen Sie ihn heraus, ist er
weg.

Je Platzhalter können Sie festlegen:

| Angabe | Wirkung |
|---|---|
| Beschriftung | Was im Formular danebensteht, wenn der Name zu knapp ist |
| Art | Einzeilig, mehrzeilig oder Auswahl aus einer Liste |
| Vorbelegung | Was schon eingetragen ist, wenn Sie nichts ändern |
| Pflicht | Ohne diese Angabe wird nicht kopiert |

Wird eine geschweifte Klammer als Zeichen und nicht als Platzhalter gebraucht,
schreiben Sie `\{{`. Die Klammer erscheint dann unverändert im Text.

---

## 4. Einen Prompt benutzen

1. **Suchen.** Das Feld steht oben. Wortanfänge genügen, und Umlaute sind egal.
   `grosse`, `große` und `Größe` finden dasselbe.
2. **Öffnen.** Das Formular für die Platzhalter steht rechts.
3. **Ausfüllen.** Die Vorschau darunter ändert sich beim Tippen mit. Was dort
   steht, ist Zeichen für Zeichen das, was Sie bekommen.
4. **Kopieren.** Eine Schaltfläche übernimmt den fertigen Text in die
   Zwischenablage. Von dort fügen Sie ihn in das Werkzeug ein, mit dem Sie
   arbeiten.

Die folgenden Kapitel beschreiben, wie sich eine wachsende Sammlung ordnen und
austauschen lässt.

---

## 5. Ordnung halten

**Tags** sind die einzige Möglichkeit, Ordnung zu halten. Es gibt keine Ordner. Ein Prompt kann
mehrere Tags tragen, und in der Bibliothek können Sie danach filtern. Zwei Tags
gleichzeitig wirken als **und**, nicht als oder. Die Liste zeigt dann nur
Prompts, die beide Tags tragen.

**Keywords** sind Textbausteine, die Sie einmal schreiben und an vielen Prompts
hinterlegen. Ein Keyword hängt seinen Text vor oder hinter den Prompt. Ändern Sie
das Keyword, ändern sich alle Prompts mit, die es benutzen. Das eignet sich für
Vorgaben wie **Antworte auf Deutsch** oder für ein festes Ausgabeformat.

Den **Stern** setzen Sie an einem Prompt. In der Bibliothek blenden Sie mit
**Nur Favoriten** alles andere aus.

Über **Sortierung** ordnen Sie die Liste nach Relevanz, nach **Zuletzt
geändert** oder nach **Titel A–Z**.

**Entwurf**, **Aktiv** und **Archiviert** sind die möglichen Zustände eines
Prompts. Archivierte erscheinen in der Bibliothek erst, wenn Sie **Nur
archivierte** wählen. Der Zustand nimmt einen Prompt aus der laufenden Ansicht,
ohne ihn zu löschen.

---

## 6. Änderungen zurücknehmen

**Änderung rückgängig.** Der Befehl steht im Menü eines Prompts. Er führt genau
einen Schritt zurück, auf den Stand vor der letzten Änderung. Einen längeren
Verlauf gibt es nicht.

**Papierkorb.** Gelöschte Prompts liegen dort 30 Tage und lassen sich mit einem
Klick zurückholen. Jede Zeile nennt die verbleibende Frist, etwa `noch 12 Tage`.
Danach werden sie beim nächsten Start der Anwendung endgültig entfernt, und die
Anwendung sagt Ihnen, was sie entfernt hat.

> **Achtung: Endgültig löschen** im Papierkorb ist die einzige Handlung in dieser
> Anwendung, die sich nicht rückgängig machen lässt. Sie fragt deshalb immer
> zurück.

---

## 7. Prompts austauschen

Der Austausch läuft über **Import/Export** in der linken Spalte. Er ist in beide
Richtungen mit der vollständigen Version von Prompt Atelier möglich.

**Herausgeben.** **Exportieren** gibt Ihnen eine JSON-Datei, wahlweise die ganze
Sammlung oder nur eine Auswahl. Diese Datei ist verlustfrei. Alles, was Sie
sehen, steht darin.

Daneben steht **Markdown** zur Verfügung, eine Datei je Prompt. Dieses Format
eignet sich zum Lesen und zum Ablegen in einem Wiki. Markdown ist nicht verlustfrei, denn Zeitstempel und
Keyword-Definitionen fehlen darin. Zum Sichern nehmen Sie JSON.

**Einlesen.** Wählen Sie eine Datei. Vor jedem Import erscheint eine Vorschau.
Sie nennt, wie viele Prompts neu sind, wo Namensgleichheit besteht und welche
Keywords angelegt würden. Erst danach wird geschrieben.

Bei Namensgleichheit entscheiden Sie je Prompt:

| Entscheidung | Wirkung |
|---|---|
| Überspringen | Ihrer bleibt, wie er ist. Das ist die Voreinstellung |
| Als Kopie | Beide bleiben, der neue heißt **… (Kopie)** |
| Überschreiben | Ihrer wird ersetzt |

Ein Import wird ganz oder gar nicht ausgeführt. Erweist sich die Datei in der
Mitte als unbrauchbar, bleibt Ihre Sammlung unverändert.

---

## 8. Zwei Einschränkungen

**Öffnen Sie die Datei nicht zweimal gleichzeitig.** Zwei Fenster auf derselben
Sammlung würden einander überschreiben. Die Anwendung erkennt diesen Fall und
stellt das zweite Fenster auf Nur-Lesen. Eine Leiste weist darauf hin. Schließen
Sie das zweite Fenster.

> **Achtung:** Ihre Prompts sind nicht verschlüsselt. Wer Zugriff auf Ihr
> Browserprofil oder auf Ihre Sicherungsdatei hat, kann sie lesen. Für
> Zugangsdaten oder Geheimnisse ist diese Anwendung nicht gedacht.

---

## 9. Wenn Sie einen Fehler melden

Zwei Angaben helfen mehr als jede Beschreibung.

**Die Version.** Sie steht ganz unten in der linken Spalte, unter den
Menüpunkten, und lautet etwa `Version 1.0.0`. Fahren Sie mit der Maus darüber,
dann erscheint zusätzlich, wann sie gebaut wurde und auf welchem Stand von Prompt
Atelier sie beruht.

**Die Ablage.** Die Zeile unter der Kopfzeile, die mit `Ablage:` beginnt. Sie
sagt, wo Ihre Prompts tatsächlich liegen.

---

## 10. Tastatur

| Taste | Wirkung |
|---|---|
| `n` | Neuer Prompt, von überall in der Anwendung |
| `Esc` | Schließt einen Dialog |

Die Taste `n` wirkt nicht, solange der Schreibcursor in einem Eingabefeld steht.

---

## 11. Was diese Version nicht kann

Die folgenden Punkte sind keine Fehler. Sie folgen daraus, dass kein Server
beteiligt ist.

- Keine Anmeldung, keine Benutzer, kein Teilen. Es sind Ihre Prompts auf Ihrem
  Rechner.
- Keine zweite Sammlung. Tags sind die Ordnung.
- Kein Versionsverlauf mit Vergleich. Ein Schritt zurück, mehr nicht.
- Kein Zugriff von einem zweiten Gerät. Dafür ist die Exportdatei da.
- Keine selbsttätige Sicherung in eine Cloud.

Wird eine dieser Möglichkeiten gebraucht, ist die vollständige Version von
Prompt Atelier die geeignete. Der Bestand lässt sich über eine Exportdatei
dorthin übernehmen.
