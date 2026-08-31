# Changelog

All notable changes to this project are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [semantic versioning](https://semver.org/spec/v2.0.0.html).

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
