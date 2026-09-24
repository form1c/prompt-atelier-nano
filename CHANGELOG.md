# Changelog

All notable changes to this project are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [semantic versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-09-24

A choice for every new entry of an import, copying keywords from the list, and example prompts in English. Built from Prompt Atelier 1.1.0.

### Added

- **Choose what an import brings in.** Every prompt and keyword of a file that is not in the collection yet can be created or skipped, and one choice sets all new entries at once. Creating is the default, so a file taken as it is arrives as before. A backup of a whole collection no longer has to be taken whole when only part of it is wanted. When a skipped keyword is named by a prompt that is created, the preview says so, because that prompt arrives without it.
- **Copy the text of a keyword from the list.** Every keyword in the list has a copy button. Until now the text was reachable only through the edit form. If the browser refuses the clipboard, the text is offered for selecting by hand, as on the prompt screen.
- **Example prompts in English.** The first start offers the examples in the language of the interface: German for a German interface, English for every other. Both packages hold 55 prompts and 10 keywords.

### Changed

- **The title of a copy ends in the word for copy in the language of the interface**, for example `(copy)` or `(copie)`. Before, it was always the German `(Kopie)`. This applies to duplicating a prompt and to importing an entry as a copy, and the note on the duplicate screen names the word that will be used.
- **The copy buttons stay in sight beside a long preview.** The bar with both copy buttons stays at the bottom of the window on every screen width while the preview is visible.
- **Notices appear at the top right, below the header.** At the bottom they covered the copy button that had just been pressed.

### Fixed

- **German messages are written with umlauts.** Among them the refusals of an import file that cannot be read.
- **The German refusal of a newer export file named only format version 1.** It names versions 1 and 2, as the other languages did.

### Measured for this release

In Chromium, Firefox and WebKit, against the delivered file: 144.7 kB compressed of a 300 kB limit, first render 69 to 138 ms, search 3.0 to 4.2 ms at 500 prompts, preview 0.1 ms and below, zero network requests, zero references to external files.

## [1.0.0] - 2026-08-31

First public release. Built from Prompt Atelier 1.0.0.

### Included

- **One HTML file**, opened by double click. No server, no database, no installation, and not one network request. The content security policy of the file forbids network connections, so the browser enforces it.
- **Library** with full-text search across title, description, body and tags. Spelling variants are resolved, so `Größe` is found by typing `groesse` or `grosse`. Filtering by tag, restriction to favourites, sorting by relevance, date of change or title.
- **Variables**: placeholders in double curly braces become form fields with a label, a default value, a required flag and a kind, among them single line, multiline and selection list.
- **Live preview** during input, character for character identical to what Prompt Atelier produces from the same prompt. Verified against 34 shared test vectors.
- **Keywords**: reusable blocks of text placed before or after a prompt.
- **Tags** as the only means of order. There are no folders and no workspaces.
- **Change history**: trash with 30 days of retention, and undo of the last change. The clear-out runs at start-up and names what it removed.
- **Import and export** as JSON and Markdown, with a preview before anything is written, and all or nothing on import. JSON is lossless and is read by Prompt Atelier as well. The exchange is verified against the full application in both directions.

  Keywords travel with the prompts. A file may carry keywords and no prompts, and is read. Where a keyword name is already taken, the preview puts the existing and the incoming definition side by side, and the decision is to skip, which is the default, or to overwrite. Copying is deliberately not offered for a keyword: its name is unique in the collection and is what an imported prompt resolves its keywords through, so a copy under a different name would be a definition no imported prompt refers to. An overwritten definition reaches the copies held by the prompts that use it. The report afterwards names prompts and keywords, counts an overwrite as written, and says plainly when everything was skipped.
- **Backup to disk**: where the browser allows it, the collection is written into a file of the user's choosing on every change, in the exchange format.
- **Five interface languages**: German, English, French, Italian, Spanish. This covers the sentences copied from Prompt Atelier and the sentences this build adds of its own.

### Measured for this release

In Chromium, Firefox and WebKit, against the delivered file: 136.8 kB compressed of a 300 kB limit, first render 67 to 123 ms, search 3.0 to 4.0 ms at 500 prompts, preview 0.1 ms and below, zero network requests, zero references to external files.

### Not included

No sign-in, no users and no sharing. No second collection. No version history with comparison. No access from a second device, and no automatic backup to a cloud. Where one of these is needed, Prompt Atelier is the suitable application.
