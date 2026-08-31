**English** · [Deutsch](development.de.md)

# Prompt Atelier Nano: Developer Manual

| | |
|---|---|
| Version | 1.0 |
| Date | 2026-08-15 |
| Reader | Anyone working on the source |
| Scope | Layout, development environment, design decisions and the reasoning behind them. Handing the application out is in `installation.md`, daily use in `manual.md` |

---

## Contents

1. Outline
2. Setting up the development environment
3. Directory layout
4. The relationship to Prompt Atelier
5. The seam
6. Storage
7. Search and normalisation
8. The build
9. Tests
10. Scripts
11. Translations
12. Releasing
13. Where Nano departs from the full application

---

## 1. Outline

Prompt Atelier Nano is the interface of Prompt Atelier without its backend. Of
the 49 files taken from it, 41 are used unchanged. In place of the Ruby server,
the interface answers the same calls itself, from a collection held in the
browser.

Three things are new, and everything else is copied:

| New | Replaces |
|---|---|
| A storage layer in the browser | SQLite |
| A search in JavaScript | SQLite FTS5 |
| A build producing one HTML file | The asset pipeline and the web server |

The build target is a file opened from a folder, so the address begins with
`file://`. That restriction shapes most of the decisions below.

---

## 2. Setting up the development environment

Node 20 or newer is required.

> **Note:** a checkout of [Prompt Atelier](https://github.com/form1c/prompt-atelier)
> must lie beside this repository. Without it the build stops with exit code 1 and
> produces no file, because 49 of the source files are copied from there and are
> not kept in this repository. See chapter 4.

**After cloning, the path to that checkout has to be set once.** It lives in
`sync.manifest.json` under `source` and is resolved against the root of this
repository:

```json
"source": "../../PromptStorage/project"
```

That value is the one used in the working tree the project is developed in,
where both repositories sit one level below a shared folder. **Two clones placed
side by side do not have that extra level**, so the path has to be shortened by
one step and given the name the clone actually has:

```json
"source": "../prompt-atelier/project"
```

`source` is the one field in that file meant to be edited. `sha256`, `syncedAt`
and `sourceVersion` are written by the sync and must be left alone.

```bash
cd project
npm install
npm run check
```

`npm run check` runs everything: sync, import audit, node tests, the browser
bench in three engines, the acceptance run and the screen reader. It is the one
command that answers whether the working tree is sound.

```bash
npm run dev      # development server, for convenience only
npm run build    # dist/index.html, the real artefact
npm run release  # release/, what is handed over
```

> **Note:** the development server is not the shipped build. Everything that
> matters about this project is a property of the single file opened over
> `file://`. Verify with `npm run build` and open the result by double click.

Playwright is borrowed from the Prompt Atelier checkout beside this one. Where it
is missing, the browser runs skip themselves with a message instead of failing.

---

## 3. Directory layout

This is what a clone contains. The repository is the `project/` directory of the
working folder, so everything below is at the root of the clone.

```
├── README.md               entry point, English
├── README.de.md            entry point, German
├── LICENSE.md
├── .gitignore
├── doc/                    the three manuals, English and German
├── src/                    Nano's own source, shadows vendor/
│   ├── api/client.js       the seam
│   ├── store/              storage, record, search, transfer, retention
│   ├── state/session.js
│   ├── components/
│   └── views/
├── tests/
│   ├── sync.test.js        the tests run under Node
│   ├── browser/            the browser bench
│   └── vectors/            search vectors, generated from Ruby
├── img/                    the icon of the browser tab, and the screenshots
├── probe/                  the workstation test file
├── scripts/                eight scripts, one of them Ruby
├── sync.manifest.json      copy list and checksums
├── index.html
├── package.json
├── vite.config.js
└── vite.tests.config.js
```

One directory is missing from that list because it is not in the repository:

```
└── vendor/                 copied from Prompt Atelier, read only, not versioned
```

`vendor/` is derived and is in `.gitignore`. What is versioned is
`sync.manifest.json`, whose checksums record exactly which state was taken.

---

## 4. The relationship to Prompt Atelier

Nano lives in its own repository so that work on it cannot reach the main
application. The sync only ever reads from `PromptStorage` and never writes to
it.

```bash
npm run sync          # copy the shared files into vendor/
npm run sync:check    # report only, write nothing
```

The copy list holds 49 files. The sync aborts when a copied file was changed
locally, when a listed file is missing, or when a copy target would leave
`vendor/`.

### 4.1 Shadow files

Not every copied file can stay unchanged. The Vite alias `@` resolves `src/`
before `vendor/`, so a file that Nano needs differently is placed in `src/` under
the same path and **shadows** its counterpart.

One addition is indispensable:

> **Note:** the sync aborts when the origin of a shadowed file has changed
> upstream, and names the file. That is the moment to decide whether the change
> has to be carried over. Acknowledge with `npm run sync -- --accept-shadows`.

Eight files are shadowed, and the number is the metric of this project. Above
about ten, the seam described in chapter 5 is in the wrong place.

| File | Why |
|---|---|
| `api/client.js` | Dispatches locally instead of over `fetch`. Replaced entirely |
| `main.js` | No session handling, and the storage self check happens here |
| `App.vue` | No overlay for an expired session, and the first run question |
| `router/index.js` | Hash paths, fewer routes, no authentication guards |
| `i18n/index.js` | Wraps the lookup so Nano's own sentences have somewhere to live |
| `components/AppShell.vue` | Header without workspace switcher and sign-out |
| `views/TrashView.vue` | No account to name as the deleter, and it states the remaining retention |
| `views/PromptTransferView.vue` | No workspace to choose, so only the confirmation is left |

Six further screens need no shadow. They all import `@/state/session`, and that
file is not on the copy list, so Nano's own version of it is not a shadow but a
module without a counterpart.

### 4.2 Nano's own text table

The copied language files must not be edited. Nano's own sentences therefore live
in `src/i18n/texts.json` under two prefixes, `storage.` and `nano.`, and upstream
uses neither.

The prefixes are the whole rule. A sentence for the trash would read naturally as
`trash.expiry`, next to thirty upstream `trash.*` keys, and on the day upstream
adds a key of that name this table would swallow it without a word.

---

## 5. The seam

`src/api/client.js` is the seam of the whole project. It keeps the signature of
the original, so the screens above it are unchanged, and turns each call
into an operation on the stored collection.

Two properties must be preserved or the screens break in ways that look like
their own fault:

1. Every failure is an `ApiError`. The screens test with `instanceof` and rethrow
   anything else.
2. The message is written here from a code, not sent by a server. That was
   already true upstream, and it is why the whole translation layer works
   unchanged.

The endpoint contract that this layer reproduces is specified in the requirements
document of Prompt Atelier, which is not part of this repository. That contract
is the reason the cut costs nothing to describe: it was already written down and
already tested before Nano existed.

Routes that exist in the contract but have no handler answer with 501 and name
the gap. A route that quietly returned nothing would be indistinguishable from a
faulty answer.

---

## 6. Storage

`src/store/storage.js` tries three tiers in order and uses the one that answers.

| Tier | Store | Limit |
|---|---|---|
| 2 | IndexedDB | Hundreds of megabytes |
| 3 | `localStorage` | About 5.2 million characters |
| 4 | Memory | The session |

> **Note:** everything here is decided by trying, never by asking.
> `'localStorage' in window` is true on a machine where every access throws, and
> a managed workstation is exactly where that happens. Each adapter writes a
> mark, reads it back, removes it, and only then claims to work.

The plain existence check was itself the throwing access once. With both tiers
disabled the start died there, and the application came up with no tier and no
warning at all, which is the worst of the possible states.

Tier 4 is a working state, not a fault. The application is complete in it and
simply cannot remember, and the header says so without pause.

### 6.1 Tier 1, the file on disk

Tier 1 is not in the list above and does not belong in it. The stored access to a
chosen file survives a restart, but its permission does not. `queryPermission`
answers `prompt` at the beginning of a session, so the file cannot be read before
somebody has clicked.

A store that cannot be read until somebody clicks cannot be the store the
application starts from. Tier 1 is therefore built as a **continuous backup
beside** the storage: on every change the collection is written into a file of
the person's choosing, in the exchange format of chapter 17.1.

Three things follow, and all three are gains. The file is one Prompt Atelier can
read. Reading it back is the import that already exists, with its preview and its
all or nothing. And the count of unsaved changes disappears, because it is
continuously untrue.

### 6.2 Record versions

The stored record carries a version. Three cases on load, and the third is the
one people forget:

| Case | Behaviour |
|---|---|
| Same version | Load it |
| Older version | Export first, without asking, then migrate, then load |
| Newer version | Refuse. An older build reading a newer record would drop the fields it does not know, and dropping them silently would be an unannounced loss of data |

---

## 7. Search and normalisation

`src/store/search.js` reproduces what the server gets from SQLite. The
normalisation happens in **two** steps, and the second is the one that is easy to
miss:

1. The letter and digraph tables of `normalization.rb`.
2. Decomposition to NFD and removal of the combining marks.

Ruby leaves accents alone because the FTS5 tokenizer with
`unicode61 remove_diacritics 2` removes them afterwards. Porting only the first
step loses every word with an accent, silently.

The proof is `tests/vectors/search.json`, generated by
`scripts/make-search-vectors.rb`. That script is the only Ruby in this
repository. It calls the real `Normalization.normalize` and then asks SQLite
itself, through an `fts5vocab` table, what its tokenizer makes of the result. The
second step is interrogated rather than described, because a description would be
a third implementation.

> **Note:** `fts5vocab` is a dictionary. It has no order and no repetition. The
> vectors say which tokens exist, never in which sequence.

Sorting uses `Intl.Collator`. SQLite compares bytes, so the main application
carries a folded sort column and 161 hand written replacements. The browser
provides alphabetical collation, so both are unnecessary here.

---

## 8. The build

Four decisions, each of which the application would otherwise fail on:

1. **A classic script, not a module.** Chromium and Firefox refuse a
   `<script type="module">` under `file://` as a cross origin request, so the
   bundle is an IIFE.
2. **One file.** Anything loaded separately would be fetched, and a fetch of a
   neighbouring file is blocked as well.
3. **No dynamic imports left over.** `inlineDynamicImports` folds them in.
4. **`@/x` resolves `src/` before `vendor/`.** Vite's alias maps one prefix to
   exactly one directory, so this lives in a plugin.

The content security policy is a `<meta>` element naming each embedded block by
its SHA-256 hash. That is how a single file, which is nothing but inline, keeps a
policy without `unsafe-inline`. `connect-src 'none'` turns the promise of no
network requests into something the browser enforces.

> **Note:** `String.replace` interprets `$&` in the replacement text. The Vue
> bundle contains `$&`, so a plain string replacement once put a literal
> `</body>` in the middle of the JavaScript. It built without complaint and died
> in every browser. Use a replacement function.

`buildInfo()` bakes the version, the Prompt Atelier version it was built from and
both dates into the bundle, because there is no process to answer `GET /version`.

The icon of the browser tab is injected the same way, from `img/favicon.png`, as
a data URI. It is one 32 pixel frame of the icon the main application serves as a
file. That icon carries nine sizes as uncompressed bitmaps and is larger than
this whole application, so embedding it whole would break the size promise. One
frame as an optimised PNG costs 2.4 kB compressed.

---

## 9. Tests

Three levels, and each exists because the level above it cannot see what it
covers.

```bash
npm test              # node tests: sync, copy list, shadow bookkeeping
npm run test:browser  # the bench, add -- --all for three engines
npm run accept        # the promises, measured on the shipped file
npm run screens       # reads the text of the shipped screens, judges nothing
```

**The browser bench** is built exactly like the application, one file, classic
script, opened over `file://`. A bench running under different rules would prove
things about a build nobody ships. The interface is an unsuitable instrument for
proving an endpoint layer, because a failure can then lie in a selector as
readily as in the layer under test.

**The acceptance run** measures on the delivered file. It found a defect the 58
bench cases could not see, because the bench never opens a screen: the library
had already asked for its prompts when the examples were put in behind its back.

**The screen reader** reads text and never clicks. It is not a test and must not
become one.

Two user tests are named in the project documents and cannot be automated. The
file chooser is a window of the operating system.

---

## 10. Scripts

| Script | Purpose |
|---|---|
| `sync.mjs` | The one way sync. Reads `PromptStorage`, writes only `vendor/` |
| `audit.mjs` | Walks the import graph from the entry point and holds it against the copy list |
| `accept.mjs` | The acceptance run |
| `screens.mjs` | Prints what the shipped screens say |
| `release.mjs` | Builds, runs everything, and only then writes `release/` |
| `package.mjs` | Makes the archive that is handed over |
| `run-browser-tests.mjs` | Drives the bench in real engines |
| `make-search-vectors.rb` | The only Ruby. Run by hand when the normalisation changes |

> **Note:** the sync re-asserts the read only mode on every run, including for
> files it did not write. Setting it only on write meant a copy whose permissions
> had been changed elsewhere stayed writable for ever, and the guarantee rule 1
> rests on stopped holding without a word.

---

## 11. Translations

Five languages are copied from Prompt Atelier and are bundled eagerly. Under
`file://` a dynamic import would be a second file, and a second file would be
fetched, and a fetch is blocked.

Nano's own sentences live in `src/i18n/texts.json` under `storage.` and `nano.`.
See chapter 4.2.

A new sentence belongs in all five languages. Where a language has no entry of
its own, the lookup answers in English. That is right for the copied language
files and goes unnoticed here: a table holding two of five languages looks like
a complete one in the application. The test bench therefore holds every language
to every sentence.

---

## 12. Releasing

```bash
npm run release
```

Builds, runs the node tests, the bench in three engines and the acceptance run,
and writes `release/` only afterwards. If a run fails it aborts and writes
nothing. A release whose measurements failed is not a release, and a folder that
contains one anyway is a folder somebody will send on.

```bash
npm run package
```

Adds the archive `prompt-atelier-nano-<version>.zip`, containing the application,
both readmes, the six manuals, the licence and a `VERSION` file.

The version comes from `package.json`. Raise it there and nowhere else.

The `VERSION` file names the version, the build date, and two commits: `commit`
is this repository, `source_commit` is the state of Prompt Atelier the copied
files came from. Both are asked for inside the repository they describe. Where
there is none, or no commit yet, the field reads `unknown` and the build says so
in its output. **Commit before building an archive that is to be published**,
otherwise it carries `unknown` truthfully and uselessly.

---

## 13. Where Nano departs from the full application

Prompt Atelier is specified in a requirements document that is not part of this
repository. The differences that a developer needs to know about are therefore
stated here in full rather than by reference.

| Subject | In Nano |
|---|---|
| Revisions | One per prompt instead of a configurable number. Twenty per prompt at two hundred prompts would occupy between 116 and 437 percent of the storage limit. One revision is what the undo of the last change requires |
| The clear-out of the trash | Runs at every start instead of once a day, and reports on screen instead of to a log. No process runs while nobody is there |
| Setting up an instance | Absent. The first start asks one question, about the examples |
| Content security policy | Kept by naming each embedded block by its hash instead of by moving code into separate files. A single file is nothing but inline |
| Backup before a migration | An export file, handed over without asking, because there is no database file to copy |

Accounts, roles, workspaces, sessions, email and administration have no subject
here at all.
