[English](installation.md) · **Deutsch**

# Prompt Atelier Nano: Weitergabe und Betrieb

| | |
|---|---|
| Fassung | 1.0 |
| Stand | 2026-08-15 |
| Zielgruppe | Wer die Anwendung weitergibt oder auf eine Freigabe legt |
| Abgrenzung | Wie die Datei auf einen Rechner kommt, die zwei Betriebsformen, und was ein verwalteter Arbeitsplatz wegnehmen kann. Die tägliche Benutzung steht in `manual.de.md`, der Quelltext in `development.de.md` |

---

## Inhalt

1. Vorbereitung
2. Weitergabe
3. Betriebsformen
4. Was der Browser entscheidet
5. Einen Zielrechner prüfen
6. Sicherung und Wiederherstellung
7. Aktualisieren
8. Störungen
9. Sicherheitseigenschaften
10. Grenzen

---

## 1. Vorbereitung

Es gibt nichts zu installieren. Vor der Weitergabe sind drei Punkte zu prüfen.

| Prüfung | Anforderung |
|---|---|
| Browser | Ein aktueller Chromium, Edge, Firefox oder Safari. Geprüft mit Chromium 151, Firefox 153, WebKit 605 und Microsoft Edge 151. Eine Mindestversion wird nicht genannt, weil keine gemessen wurde |
| Lokale Dateien öffnen | Die Person muss eine HTML-Datei aus einem Ordner öffnen können. Manche verwalteten Rechner verbieten das |
| Ein Ordner, der gesichert wird | Die Anwendung kann eine Sicherungsdatei schreiben, und die ist nur etwas wert, wenn der Ordner in eine Datensicherung einbezogen ist |

Administratorrechte sind nicht nötig. Geschrieben wird ausschließlich in das
Browserprofil und in den Ordner, den die Person selbst wählt.

---

## 2. Weitergabe

1. `prompt-atelier-nano.html` auf den Zielrechner kopieren.
2. Die Person bitten, sie per Doppelklick zu öffnen.
3. Die Person bitten, vor dem Arbeiten Kapitel 1 von `manual.de.md` zu lesen.

Schritt 3 ist wesentlich. Die Sammlung liegt im Speicher des Browsers. Wer das
nicht weiß, riskiert einen Datenverlust.

Weiterzugeben ist allein die HTML-Datei. Alles Nötige steckt darin.

---

## 3. Betriebsformen

Zwei Formen sind möglich, und die zweite trägt eine Gefahr, die leicht übersehen
wird.

### 3.1 Örtliche Datei

Die vorgesehene Form. Die Datei liegt auf dem Rechner und wird aus ihrem Ordner
geöffnet. Jeder Rechner hat seine eigene Sammlung.

Die Adresse lautet dann `file:///C:/Users/.../prompt-atelier-nano.html`.

### 3.2 Datei auf einer Netzfreigabe

Dieselbe Datei kann auf eine Freigabe gelegt und von dort geöffnet werden. Das
ist bequem für die Verteilung von Aktualisierungen und hat eine Folge, die man
vor der Entscheidung kennen muss.

> **Achtung:** Browser trennen abgelegte Daten nach Ursprung, nicht nach Datei.
> Unter Chromium teilen sich alle aus dem Dateisystem geöffneten Dateien einen
> Ablagebereich. Zwei Personen, die dieselbe Datei von derselben Freigabe auf
> demselben Rechner und unter demselben Benutzerprofil öffnen, arbeiten deshalb
> an derselben Sammlung. Zwei Personen an zwei Rechnern nicht, denn das
> Browserprofil gehört zum Rechner.
>
> Gemessen mit Chromium 151: Eine Kopie in einem Ordner und eine in einem anderen
> teilen sich unter einem Profil die Sammlung. Die zweite Kopie öffnete mit den
> 55 Prompts der ersten und fragte nicht erneut nach den Beispielen.

Die Regel für die Praxis:

| Lage | Ergebnis |
|---|---|
| Eine Freigabe, mehrere Rechner, je eine Person | Jede Person hat ihre eigene Sammlung. Unbedenklich |
| Eine Freigabe, ein Rechner, mehrere Benutzerprofile | Jedes Profil hat seine eigene Sammlung. Unbedenklich |
| Eine Freigabe, ein Rechner, ein Profil, mehrere Personen | Eine gemeinsame Sammlung. Wer zuletzt schreibt, gewinnt |

Die Anwendung erkennt ein zweites offenes Fenster und stellt das neuere auf
Nur-Lesen, damit sich zwei Fenster nicht überschreiben. Zwei Personen, die sich
an demselben Profil abwechseln, kann sie nicht erkennen.

Dient die Freigabe nur der Verteilung, und kopiert jede Person die Datei vor der
Benutzung auf ihren eigenen Rechner, entfällt diese Einschränkung.

---

## 4. Was der Browser entscheidet

Die Anwendung fragt den Browser nicht, was er kann. Sie probiert es aus und
berichtet das Ergebnis in der Ablagezeile unter der Kopfzeile. Drei Ausgänge.

| Zeile lautet | Bedeutung |
|---|---|
| `Ablage: Browserspeicher` | Normalfall. Die Sammlung übersteht das Schließen des Browsers und einen Neustart des Rechners |
| `Ablage: Browserspeicher, begrenzt` | Die größere Ablage wurde verweigert. Die Sammlung übersteht trotzdem, und die Grenze liegt bei etwa 500 Prompts |
| `Ablage: Es wird nichts gespeichert` | Die Ablage ist auf diesem Rechner abgeschaltet. Die Anwendung arbeitet vollständig und vergisst alles beim Schließen des Fensters |

Der dritte Fall ist ein Betriebszustand und kein Fehler. Er tritt ein, wenn eine
Richtlinie den Browserspeicher abschaltet. Die Kopfzeile weist durchgehend darauf
hin. Vor dem Schließen des Fensters ist ein Export erforderlich.

Eine vierte Möglichkeit wird angeboten statt ermittelt. Wo der Browser es
zulässt, trägt die Ablagezeile das Angebot, die Sammlung zusätzlich bei jeder
Änderung in eine Datei auf der Festplatte zu schreiben. Das ist der beste
verfügbare Schutz und kostet eine Bestätigung je Sitzung. Siehe Kapitel 6.

---

## 5. Einen Zielrechner prüfen

Wo ein Rechner verwaltet wird und seine Richtlinien unbekannt sind, lassen sich
die Annahmen oben messen statt glauben. Das Repository enthält dafür eine
Prüfdatei unter `probe/workstation-check.html`.

1. Die Datei auf den Zielrechner kopieren und per Doppelklick öffnen.
2. Die vier Schaltflächen unten betätigen.
3. Den Bericht zurücksenden. Er steht am Ende der Seite und lässt sich kopieren.

Der Bericht nennt, welche Ablage zur Verfügung steht, wie groß sie ist, ob eine
echte Datei beschrieben werden kann und ob ein Eintrag einen Neustart übersteht.
Ein zweiter Lauf nach einem Neustart beantwortet die wichtigste Frage, nämlich ob
Daten über Nacht erhalten bleiben.

---

## 6. Sicherung und Wiederherstellung

Die Sammlung liegt im Speicher des Browsers. Diese Ablage kann von der Person, von
einem Aufräumwerkzeug oder von einer Richtlinie beim Abmelden geleert werden.
Keine Programmierschnittstelle kann das verhindern. Es gibt zwei Schutzmaßnahmen,
und die erste ist die bessere.

### 6.1 Eine Datei auf der Festplatte, selbsttätig geschrieben

In der Ablagezeile **Zusätzlich in eine Datei auf der Festplatte sichern**
wählen. Einen Ordner nehmen, der gesichert wird. Von da an wird die ganze Sammlung
bei jeder Änderung in diese Datei geschrieben, im Austauschformat.

Der Browser fragt einmal je Sitzung nach einer Bestätigung. Das ist Absicht des
Browsers und kein Fehler der Anwendung. Es erscheint eine Leiste mit einer
Schaltfläche, ein Klick setzt das Schreiben fort.

Wo der Browser das nicht unterstützt, erscheint das Angebot nicht. Gemessen:
vorhanden in Chromium 151, nicht vorhanden in Firefox 153 und WebKit 605.

### 6.2 Export von Hand

Oben rechts zählt die Kopfzeile die Änderungen seit der letzten Sicherung. Ein
Klick darauf führt zur Austauschseite, wo **Exportieren** eine JSON-Datei
erzeugt.

Markdown wird ebenfalls angeboten. Es ist zum Lesen und zum Ablegen in einem Wiki
gedacht und ist nicht verlustfrei. Zeitstempel und Keyword-Definitionen fehlen
darin. Zum Sichern also JSON.

### 6.3 Wiederherstellen

Die Anwendung öffnen, auf **Import/Export** gehen und die Sicherungsdatei
einlesen.
Sie ist eine gewöhnliche Exportdatei. Der Import zeigt zuerst eine Vorschau und
arbeitet nach dem Grundsatz alles oder nichts, sodass eine unbrauchbare Datei die
Sammlung unberührt lässt.

---

## 7. Aktualisieren

Die HTML-Datei durch die neuere ersetzen. Die Sammlung bleibt unberührt, denn sie
liegt im Browser und nicht in der Datei.

Eine neuere Datei kann die Sammlung in einer neueren Form ablegen. Eine ältere
Datei rührt sie dann nicht an und sagt das, statt die ihr unbekannten Felder
wegzulassen. Ändert sich die Form, erzeugt die neuere Datei vorher einmal
ungefragt eine Sicherungsdatei.

Welche Version läuft, steht am Fuß der Seitenleiste.

---

## 8. Störungen

| Erscheinung | Ursache und Abhilfe |
|---|---|
| Die Seite bleibt leer | Die Datei wurde auf dem Weg beschädigt. Erneut kopieren. Ein Versand per E-Mail kann Zeilenenden verändern, daher eine Freigabe oder ein Archiv benutzen |
| Die Bibliothek ist leer, obwohl Prompts angelegt wurden | Die Ablagezeile ansehen. Steht dort `Es wird nichts gespeichert`, ist der Browserspeicher auf diesem Rechner abgeschaltet und nichts wurde behalten |
| Eine Leiste meldet, die Datei sei bereits in einem anderen Fenster offen | Das zweite Fenster schließen. Die Anwendung schreibt aus zwei Fenstern nicht, damit sie sich nicht überschreiben |
| Eine Leiste bittet bei jedem Start um Bestätigung | Normal. Der Browser entzieht die Erlaubnis für die Sicherungsdatei am Ende einer Sitzung. Ein Klick stellt sie wieder her |
| Eine Leiste meldet, der Speicher sei voll | Sofort exportieren. Die letzte Änderung liegt nur im Arbeitsspeicher. Danach den Papierkorb leeren und entfernen, was nicht mehr gebraucht wird |
| Die Version am Fuß der Seitenleiste ist nicht sichtbar | Nach unten rollen. Die Tagliste kann sie unter den sichtbaren Bereich schieben |

Für eine Meldung beantworten zwei Angaben die meisten Fragen. Die Version am Fuß
der Seitenleiste und die Ablagezeile unter der Kopfzeile.

---

## 9. Sicherheitseigenschaften

| Eigenschaft | Zustand |
|---|---|
| Anfragen an das Netzwerk | Keine. Die Sicherheitsrichtlinie der Datei verbietet sie. Das erzwingt der Browser, es ist also keine Zusage der Anwendung, auf die man sich verlassen müsste |
| Fremde Bestandteile | Keine. Symbole, Schriften, Übersetzungen und Beispieldaten stecken in der Datei |
| Verschlüsselung | Keine. Wer Zugriff auf das Browserprofil oder auf die Sicherungsdatei hat, kann die Prompts lesen |
| Anmeldung | Keine. Die Anwendung ist kein Ort für Zugangsdaten oder Geheimnisse |
| Dargestellte Inhalte | Prompt-Text wird als Text eingesetzt, nie als Auszeichnung |

Die fehlende Verschlüsselung ist eine bewusste Festlegung. Ein Kennwort müsste
in der Datei abgelegt oder aus ihr abgeleitet werden. Da die Datei für jeden
lesbar ist, wäre der Schlüssel damit ebenso zugänglich wie die Daten. Die
Abwesenheit einer Verschlüsselung wird deshalb benannt, statt sie vorzutäuschen.

---

## 10. Grenzen

| Grenze | Wert |
|---|---|
| Prompts | 500 üblicher Länge, bei je einer Revision |
| Ablage im Browser | Etwa 5,2 Millionen Zeichen, auf vier Browser-Engines gleich gemessen |
| Verlauf | Ein Schritt zurück je Prompt. Es gibt keinen längeren Versionsverlauf |
| Papierkorb | 30 Tage, danach Entfernung beim nächsten Start |
| Sammlungen | Eine. Es gibt keine Workspaces, und Tags sind das Ordnungsmittel |
| Teilen | Nicht vorgesehen. Prompts werden als Dateien getauscht |

Die Sammlung ist von einem zweiten Gerät aus nicht erreichbar. Die Exportdatei ist
der Weg, sie zu bewegen.
