// The test bench, and why it runs in a browser.
//
// Everything worth checking here needs a browser to be true: the storage tiers
// are browser APIs, the dispatcher answers from a live collection, and the
// rendering pipeline is the one thing that must agree with the main application
// character for character. A test in Node would be testing a different program.
//
// Built exactly like the application — one file, classic script, opened over
// `file://` — so that what it proves is true of the thing that ships.
//
// Driven by Playwright, which reads `window.__results`. Written to the page as
// well, because a bench nobody can open by hand is a bench nobody debugs.

import { setLanguage, availableLanguages, t } from '@/i18n'
import ownTexts from '@/i18n/texts.json'
import {
  start, save, current, state as storage,
  chooseFile, unlockFile, releaseFile,
  offeringExamples, takeExamples, declineExamples
} from '@/store'
import { daysLeft, overdue, sweep, TRASH_DAYS } from '@/store/retention'
import { permissionOf, writeText } from '@/store/file'
import { serialise } from '@/store/record'
import { get, post, put, del, ApiError } from '@/api/client'
import { render } from '@/util/rendering'
import { packageFrom, collectionFrom, optionText, optionList } from '@/store/package'
import { parse, markdownFiles, slug } from '@/store/transfer'
import examples from '@/examples/examples.json'
import vectors from '@/vectors/rendering.json'
import { tokens, normalize, highlightRanges, termsOf } from '@/store/search'
import searchVectors from '../vectors/search.json'

const results = []

async function check (name, run) {
  try {
    // A case may answer with a sentence, and then it is a measurement rather
    // than only a verdict. AP-N7 has two of those — the size of the collection
    // with one revision per prompt is a number somebody has to be able to read,
    // and a green tick does not carry it.
    const note = await run()
    results.push({ name, ok: true, note: typeof note === 'string' ? note : undefined })
  } catch (error) {
    results.push({ name, ok: false, detail: error?.message ?? String(error) })
  }
}

function is (actual, expected, what = '') {
  const a = JSON.stringify(actual)
  const b = JSON.stringify(expected)
  if (a !== b) throw new Error(`${what}${what ? ': ' : ''}${a} ≠ ${b}`)
}

const ok = (value, what) => { if (!value) throw new Error(what) }

async function refused (run, expected) {
  try {
    await run()
  } catch (error) {
    if (!(error instanceof ApiError)) throw new Error(`not an ApiError: ${error?.message}`)
    if (expected && error.code !== expected && error.status !== expected) {
      throw new Error(`refused with ${error.status}/${error.code}, expected ${expected}`)
    }
    return error
  }
  throw new Error('was accepted, expected a refusal')
}

// --- the run ----------------------------------------------------------------

async function suite () {
  await setLanguage('de')
  await start()

  // The first run asks a question (AP-N8), and everything below this line
  // assumes a collection with something in it. So the bench answers it the way
  // a person would — and checks, on the way past, that it was really asked.
  // A bench that quietly worked on an empty collection would go green over an
  // application nobody could use.
  await check('the first run asks about the examples instead of helping itself', async () => {
    ok(offeringExamples.value, 'the question is up before anything else')
    is(current().prompts.length, 0, 'and nothing has been put in yet')

    await takeExamples()

    ok(!offeringExamples.value, 'answered once, gone for good')
    ok(current().prompts.length > 50, 'and the examples are in')
    is(storage.changes, 0, 'the starting position is not 55 unsaved changes')
  })

  // The 34 vectors all three applications read from one file (AN-03). The
  // single most valuable case in this project: if it goes red, the same prompt
  // gives two different texts in two builds, and nobody would see it anywhere
  // else.
  //
  // Run **exactly** the way the main application's suite runs them, down to how
  // a keyword name is looked up — first among the vector's own definitions,
  // then in the shared catalogue. Inventing a second way to read the file would
  // make the two suites agree about a file rather than about a pipeline.
  const renderVector = (vector) => render({
    body: vector.body,
    variables: vector.variables ?? [],
    keywords: (vector.keywords ?? []).map((name) => ({
      ...((vector.extra_keywords ?? {})[name] ?? vectors.keywords[name]),
      name
    }))
  })

  await check(`rendering: all ${vectors.vectors.length} vectors from the shared file`, () => {
    for (const vector of vectors.vectors) {
      const outcome = renderVector(vector)
      is(outcome.text, vector.expected, `${vector.id} — ${vector.title}`)

      if ('unknown_keys' in vector) is(outcome.unknownKeys, vector.unknown_keys, `${vector.id} unknown keys`)
      if ('missing_required' in vector) is(outcome.missingRequired, vector.missing_required, `${vector.id} missing required`)
    }
  })

  // A-12 promises 34. Without this the case above would simply run one fewer
  // and stay green — which is how a dropped vector goes unnoticed.
  await check('rendering: the file still carries 34 vectors', () => {
    is(vectors.vectors.length, 34, 'vector count')
  })

  // The vectors that keep RN-04 shut, and the reason they exist at all: a
  // search that finds less than it should reports nothing. Produced by
  // `scripts/make-search-vectors.rb`, which runs the real
  // `Normalization.normalize` and then asks **SQLite** what its tokenizer makes
  // of the result — so what is compared here is the original, not a reading of
  // it.
  //
  // Compared as **sets**: `fts5vocab` is the term dictionary of the index, so it
  // has no order of its own and a repeated word appears once. Comparing
  // sequences would fail on `snake_case_name` — which it did — and the failure
  // would be about the shape of the source, not about the search.
  const asSet = (list) => [...new Set(list)].sort()

  await check(`search: all ${searchVectors.vectors.length} normalisation vectors from Prompt Atelier`, () => {
    for (const vector of searchVectors.vectors) {
      is(asSet(tokens(vector.input)), asSet(vector.tokens), `tokens of ${JSON.stringify(vector.input)}`)
    }
  })

  // The vector file must not shrink unnoticed: a case above would simply run
  // one fewer and stay green.
  await check('search: the vector file still carries 60 probes', () => {
    is(searchVectors.vectors.length, 60, 'probe count')
  })

  // The step that would be missing if only `normalize` had been ported. Stated
  // as its own case so that a failure names the mistake rather than one of
  // sixty inputs.
  await check('search: accents are folded, which normalize alone would not do', () => {
    is(tokens('Café'), ['cafe'], 'Café')
    is(tokens('Année'), ['annee'], 'Année')
    is(tokens('Città'), ['citta'], 'Città')

    // The other half: what the tokenizer cannot fold, because a stroke and a
    // ligature are part of the letter rather than a mark on it.
    is(tokens('Straße'), ['strasse'], 'Straße')
    is(tokens('Cœur'), ['cour'], 'Cœur')
    is(tokens('Łódź'), ['lodz'], 'Łódź')
  })

  await check('search: the three spellings of Größe meet (FA-501)', () => {
    const one = tokens('Größe')
    is(tokens('Groesse'), one, 'Groesse')
    is(tokens('Grosse'), one, 'Grosse')
    is(one, ['grosse'], 'the meeting point')
  })

  await check('search: both encodings of an umlaut meet', () => {
    is(tokens('Übung'), tokens('U\u0308bung'), 'precomposed against decomposed')
  })

  await check('search: prefix, and every word has to match (FA-501)', async () => {
    await post('/prompts', {
      body: { title: 'Blogartikel über Straßenbau', body: 'Ein Text über Größe.', tags: [], status: 'active', visibility: 'private' }
    })

    const prefix = await get('/prompts', { params: { q: 'blog', limit: 500 } })
    ok(prefix.meta.total > 0, 'the prefix "blog" found nothing')

    // Both words, and the second one is spelled the other way round.
    const both = await get('/prompts', { params: { q: 'blogartikel strassenbau', limit: 500 } })
    ok(both.prompts.some((prompt) => prompt.title.includes('Straßenbau')), 'two words did not narrow to the row')

    // A word that occurs nowhere removes the row, however well the others match.
    const none = await get('/prompts', { params: { q: 'blogartikel zebrastreifen', limit: 500 } })
    is(none.meta.total, 0, 'a word without a hit did not exclude the row')
  })

  await check('search: an accented word is found by its plain spelling (RN-04)', async () => {
    await post('/prompts', {
      body: { title: 'Café und Résumé', body: 'Über Cœur.', tags: [], status: 'active', visibility: 'private' }
    })

    for (const term of ['cafe', 'resume', 'coeur', 'Café']) {
      const found = await get('/prompts', { params: { q: term, limit: 500 } })
      ok(found.prompts.some((prompt) => prompt.title.includes('Café')), `"${term}" did not find it`)
    }
  })

  await check('search: only spaces does not empty the library', async () => {
    const all = await get('/prompts', { params: { limit: 500 } })
    const spaces = await get('/prompts', { params: { q: '   ', limit: 500 } })
    is(spaces.meta.total, all.meta.total, 'a blank term changed the result')
  })

  await check('search: a special character is never an error (FA-501)', async () => {
    for (const term of ['"', '* OR 1=1', '"unbalanced', '{{}}', '\\', 'AND NOT']) {
      const found = await get('/prompts', { params: { q: term, limit: 500 } })
      ok(typeof found.meta.total === 'number', `"${term}" did not answer`)
    }
  })

  await check('search: the title weighs more than the body (FA-501)', async () => {
    await post('/prompts', { body: { title: 'Zwiebelsuppe', body: 'Nichts.', tags: [], status: 'active', visibility: 'private' } })
    await post('/prompts', { body: { title: 'Nichts.', body: 'Ein Text über Zwiebelsuppe und mehr.', tags: [], status: 'active', visibility: 'private' } })

    const found = await get('/prompts', { params: { q: 'zwiebelsuppe', sort: 'relevance', limit: 10 } })
    is(found.prompts[0].title, 'Zwiebelsuppe', 'the title hit must come first')
  })

  await check('search: whole words are marked, in the original text', () => {
    // "Größe" is marked whole although the term is "grosse" and the two do not
    // share a single character position — which is the reason ranges are whole
    // words and not the matched prefix.
    is(highlightRanges('Die Größe zählt', 'grosse'), [[4, 5]], 'Größe')
    is(highlightRanges('Blogartikel', 'blog'), [[0, 11]], 'whole word for a prefix')
    is(highlightRanges('nichts', 'blog'), [], 'no hit, no range')
  })

  await check('sorting: by title through the alphabet, not by byte (FA-507)', async () => {
    const page = await get('/prompts', { params: { sort: 'title', limit: 500 } })
    const titles = page.prompts.map((prompt) => prompt.title)
    const expected = [...titles].sort(new Intl.Collator('de', { sensitivity: 'base', numeric: true }).compare)

    is(titles, expected, 'order by title')
  })

  await check('storage: a tier was reached and named', () => {
    ok(storage.ready, 'the store never became ready')
    ok(['indexeddb', 'localstorage', 'memory'].includes(storage.tier), `odd tier: ${storage.tier}`)
  })

  await check('library: the examples are there', async () => {
    const page = await get('/prompts', { params: { limit: 500 } })
    ok(page.meta.total >= 50, `only ${page.meta.total} prompts`)
    ok(page.prompts[0].tags.every((tag) => typeof tag === 'string'), 'tags must be names, not objects')
  })

  await check('tags: one catalogue, one numbering', async () => {
    const { tags } = await get('/tags')
    const seo = tags.find((tag) => tag.name === 'seo')
    ok(seo, 'no tag "seo"')

    const filtered = await get('/prompts', { params: { tags: [seo.id], limit: 500 } })
    ok(filtered.meta.total > 0, 'filtering by a tag found nothing')
    ok(filtered.prompts.every((prompt) => prompt.tags.includes('seo')), 'a hit without the tag')
  })

  await check('variables: the text decides, not the editor (FA-301)', async () => {
    const { prompt } = await post('/prompts', {
      body: {
        title: 'Vom Text bestimmt',
        body: 'Nur {{eins}} kommt vor.',
        // `zwei` has no occurrence and must disappear; `eins` has no entry and
        // must appear.
        variables: [{ key: 'zwei', label: 'Zwei', type: 'text' }],
        tags: [], visibility: 'private', status: 'draft'
      }
    })
    is(prompt.variables.map((variable) => variable.key), ['eins'], 'variable set')
  })

  await check('select options: list in a file, one text per line in a row', async () => {
    const { prompt } = await post('/prompts', {
      body: {
        title: 'Mit Auswahl',
        body: 'Ton: {{ton}}',
        variables: [{ key: 'ton', type: 'select', options: ['formal', 'locker'] }],
        tags: [], visibility: 'private', status: 'draft'
      }
    })
    is(prompt.variables[0].options, 'formal\nlocker', 'stored options')
    is(optionList(optionText(['a', 'b'])), ['a', 'b'], 'the two directions must be inverse')
  })

  await check('limits: a title of 250 characters is refused (14.3)', async () => {
    const error = await refused(() => post('/prompts', {
      body: { title: 'x'.repeat(250), body: 'Text', tags: [] }
    }), 'validation_failed')
    ok(error.fields.title, 'the refusal does not name the field')
  })

  await check('limits: an empty body is refused', () => refused(() => post('/prompts', {
    body: { title: 'Ohne Text', body: '', tags: [] }
  }), 'validation_failed'))

  await check('duplicate: carries "(Kopie)" and is a private draft (FA-204)', async () => {
    const first = (await get('/prompts', { params: { limit: 1 } })).prompts[0]
    const { prompt } = await post(`/prompts/${first.id}/duplicate`)

    is(prompt.title, `${first.title} (Kopie)`, 'title')
    is(prompt.visibility, 'private', 'visibility')
    is(prompt.status, 'draft', 'status')
  })

  await check('undo: one revision, and it is the state before (FA-702)', async () => {
    const { prompt } = await post('/prompts', {
      body: { title: 'Vorher', body: 'Erster Text', tags: [], status: 'draft', visibility: 'private' }
    })
    await put(`/prompts/${prompt.id}`, {
      body: { title: 'Nachher', body: 'Zweiter Text', tags: [], status: 'draft', visibility: 'private' }
    })
    const back = await post(`/prompts/${prompt.id}/undo`)
    is(back.prompt.title, 'Vorher', 'title after undo')
    is(back.prompt.body, 'Erster Text', 'body after undo')
  })

  await check('keywords: the name stays unique (FA-401)', async () => {
    await post('/keywords', { body: { name: 'prüfton', text: 'Sachlich.', position: 'append' } })
    await refused(() => post('/keywords', { body: { name: 'Prüfton', text: 'Nochmal.' } }), 'name_taken')
  })

  await check('keywords: deleting asks first and names the prompts (FA-404)', async () => {
    const { keywords } = await get('/keywords')
    const used = keywords.find((keyword) => keyword.name === 'formal') ?? keywords[0]

    const error = await refused(() => del(`/keywords/${used.id}`), 'confirmation_required')
    ok(Array.isArray(error.details.affected_prompts), 'no list of affected prompts')
    ok(error.details.affected_prompts.every((entry) => entry.title), 'a prompt without a title')

    const done = await del(`/keywords/${used.id}`, { body: { confirm: true } })
    ok(typeof done.removed_assignments === 'number', 'no count of removed assignments')
  })

  await check('bulk: what was done and what was not, by name (FA-511)', async () => {
    const page = await get('/prompts', { params: { limit: 3 } })
    const ids = page.prompts.map((prompt) => prompt.id)

    const report = await post('/prompts/bulk/trash', { body: { prompt_ids: [...ids, 999_999] } })
    is(report.counts.done, ids.length, 'done')
    is(report.counts.refused, 1, 'refused')

    const trash = await get('/trash')
    ok(trash.meta.total >= ids.length, 'the trash is missing entries')

    const back = await post('/trash/bulk/restore', { body: { prompt_ids: ids } })
    is(back.counts.done, ids.length, 'restored')
  })

  await check('move: refused by name, not silently (EN-03)', () =>
    refused(() => post('/prompts/bulk/move', { body: { prompt_ids: [1], workspace_id: 2 } })))

  await check('export: the package is version 2 and round-trips its fields', async () => {
    const data = packageFrom(current())
    is(data.format, 'promptatelier-export', 'format')
    is(data.version, 2, 'version')

    // A package read back in must yield the same prompts. This is the promise
    // of FA-804, checked here in the small before AP-N6 checks it in the large.
    const again = collectionFrom(data, { workspaceId: 1, firstId: 1 })
    is(again.prompts.length, data.prompts.length, 'prompt count after a round trip')
    is(again.prompts[0].title, data.prompts[0].title, 'first title')
  })

  // --- the transfer, and the promise the whole project is for ----------------

  // AN-01, and the first attempt at it was too weak.
  //
  // It read the shipped `examples.json` in and expected the export to match. It
  // does not, and correctly so: that file carries **no timestamps** — it is a
  // hand-written seed package, not an export of a running instance — so a round
  // trip through any implementation assigns new ones. The server does the same
  // (`Transfer.stamp` restores only what the file carries).
  //
  // So the round trip is run over a package that looks like what a real export
  // looks like: one this build produced, timestamps and all. That is the file
  // the two applications would actually exchange, and it is the one whose
  // fields must survive untouched.
  await check('AN-01: an export read back in comes out identical', async () => {
    const first = (await post('/export', {})).package
    const content = JSON.stringify(first)

    // Everything is a collision with itself, and each one is overwritten — so
    // what comes out is what went in rather than what was already there.
    const { preview } = await post('/import/preview', { body: { content } })
    const decisions = Object.fromEntries(preview.prompts
      .filter((entry) => entry.state === 'collision')
      .map((entry) => [entry.index, 'overwrite']))

    await post('/import', { body: { content, decisions } })
    const second = (await post('/export', {})).package

    is(second.version, first.version, 'version')
    is(second.workspace, first.workspace, 'workspace')
    is(second.keywords, first.keywords, 'keywords')
    is(second.prompts.length, first.prompts.length, 'prompt count')

    // Field by field, and the timestamps among them: an export carries them, so
    // a round trip has to give them back unchanged (FA-804).
    for (let at = 0; at < first.prompts.length; at += 1) {
      is(second.prompts[at], first.prompts[at], `prompt ${at} — ${first.prompts[at].title}`)
    }
  })

  // The shipped package, and what a round trip legitimately changes about it.
  // Kept as its own case so that the one difference is stated rather than
  // hidden in a comparison that skips fields.
  await check('AN-01b: the shipped examples survive, timestamps excepted', async () => {
    const before = JSON.parse(JSON.stringify(examples))
    const content = JSON.stringify(before)

    const { preview } = await post('/import/preview', { body: { content } })
    const decisions = Object.fromEntries(preview.prompts
      .filter((entry) => entry.state === 'collision')
      .map((entry) => [entry.index, 'overwrite']))
    await post('/import', { body: { content, decisions } })

    const out = (await post('/export', {})).package
    const here = Object.fromEntries(out.prompts.map((prompt) => [prompt.title, prompt]))

    for (const original of before.prompts) {
      const returned = here[original.title]
      ok(returned, `"${original.title}" did not come back`)

      for (const field of ['body', 'description', 'visibility', 'status', 'model_hint']) {
        is(returned[field] ?? null, original[field] ?? null, `${original.title} · ${field}`)
      }
      is(returned.tags ?? [], original.tags ?? [], `${original.title} · tags`)
      is(returned.variables ?? [], original.variables ?? [], `${original.title} · variables`)

      // As a **set**. The order a file happens to list keywords in is not a
      // promise: both applications order a prompt's keywords by `sort_order`
      // and then by name, and the rendering pipeline sorts by the same keys
      // again. What has to survive is which keywords, not in what sequence.
      is([...(returned.default_keywords ?? [])].sort(), [...(original.default_keywords ?? [])].sort(),
        `${original.title} · default_keywords`)

      // The one documented difference: the file carries no timestamps, so new
      // ones stand (17.2, and the same rule on the server).
      ok(returned.created_at, `${original.title}: a timestamp should have been assigned`)
    }
  })

  // AN-02, the other direction in the small: a prompt made here, exported, read
  // back. The awkward pieces are deliberate — every variable type, a select with
  // options, a required field, a default, tags, keywords, and escaped braces.
  await check('AN-02: a prompt built here survives its own export', async () => {
    const made = await post('/prompts', {
      body: {
        title: 'Rundlauf mit allem',
        description: 'Beschreibung mit Umlaut: Größe.',
        body: 'Nimm {{text}} in {{ton}} und {{anzahl}} Sätzen. Literal: \\{{keine_variable}}.',
        model_hint: 'läuft gut mit Claude',
        visibility: 'instance',
        status: 'active',
        tags: ['rundlauf', 'prüfung'],
        variables: [
          { key: 'text', label: 'Der Text', type: 'multiline', default_value: '', required: true },
          { key: 'ton', label: 'Ton', type: 'select', options: ['formal', 'locker'], default_value: 'formal', required: true },
          { key: 'anzahl', label: 'Anzahl', type: 'number', default_value: '3', required: false }
        ]
      }
    })

    const pack = (await post('/export', {})).package
    const out = pack.prompts.find((prompt) => prompt.title === 'Rundlauf mit allem')
    ok(out, 'the prompt is not in the export')

    is(out.body, made.prompt.body, 'body')
    is(out.visibility, 'instance', 'visibility')
    is(out.model_hint, 'läuft gut mit Claude', 'model_hint')
    is(out.tags, ['rundlauf', 'prüfung'], 'tags')
    is(out.variables.map((variable) => variable.key), ['text', 'ton', 'anzahl'], 'variable order')

    // The list comes back as a list, not as the text the row holds.
    const ton = out.variables.find((variable) => variable.key === 'ton')
    is(ton.options, ['formal', 'locker'], 'options as a list')
    is(ton.required, true, 'required')

    // And the file this produces must be readable again.
    const read = parse(JSON.stringify(pack))
    ok(read.prompts.some((prompt) => prompt.title === 'Rundlauf mit allem'), 'the export cannot be read back')
  })

  await check('a file of the previous format version is still readable (FA-804b)', () => {
    // Version 1, the former product name, and the German domain values —
    // everything an old backup carries.
    const old = {
      format: 'promptstorage-export',
      version: 1,
      prompts: [{
        title: 'Alter Bestand', body: 'Text {{a}}',
        visibility: 'privat', status: 'aktiv',
        variables: [{ key: 'a', type: 'auswahl', options: ['x'] }]
      }]
    }

    const read = parse(JSON.stringify(old))
    is(read.prompts[0].visibility, 'private', 'visibility modernised')
    is(read.prompts[0].status, 'active', 'status modernised')
    is(read.prompts[0].variables[0].type, 'select', 'variable type modernised')
  })

  await check('a file is refused by name, never with a shrug (FA-802)', async () => {
    const cases = [
      ['', 'empty_file'],
      ['   ', 'empty_file'],
      ['{ kaputt', 'malformed_json'],
      [JSON.stringify({ format: 'etwas-anderes', version: 2, prompts: [] }), 'not_an_export'],
      [JSON.stringify({ format: 'promptatelier-export', version: 99, prompts: [{}] }), 'unsupported_version'],
      // An empty prompt list alone is not a reason: a file may carry keywords
      // instead. Refused is the file that carries neither.
      [JSON.stringify({ format: 'promptatelier-export', version: 2, prompts: [] }), 'no_content'],
      [JSON.stringify({ format: 'promptatelier-export', version: 2, prompts: [{ body: 'x' }] }), 'prompt_without_title'],
      ['Kein Kopfteil', 'no_frontmatter']
    ]

    for (const [content, code] of cases) {
      const error = await refused(() => post('/import/preview', { body: { content } }))
      is(error.code, code, `for ${JSON.stringify(content).slice(0, 30)}`)
    }
  })

  await check('unknown fields are named, not swallowed (TF-343)', async () => {
    const newer = {
      format: 'promptatelier-export',
      version: 2,
      prompts: [{ title: 'Aus der Zukunft', body: 'Text', erfundenes_feld: 42 }]
    }

    const { preview } = await post('/import/preview', { body: { content: JSON.stringify(newer) } })
    ok(preview.unknown_fields.includes('erfundenes_feld'), 'the unknown field is not reported')
  })

  await check('collisions: skip is the default and it destroys nothing (FA-802, W-8)', async () => {
    const first = (await get('/prompts', { params: { limit: 1 } })).prompts[0]
    const file = {
      format: 'promptatelier-export', version: 2,
      prompts: [{ title: first.title, body: 'GANZ ANDERER TEXT' }]
    }
    const content = JSON.stringify(file)

    const { preview } = await post('/import/preview', { body: { content } })
    is(preview.prompts[0].state, 'collision', 'state')
    is(preview.prompts[0].decisions, ['skip', 'copy', 'overwrite'], 'what may be decided')

    // No decision at all: the safe answer, and the only one that cannot destroy
    // something by omission.
    const { report } = await post('/import', { body: { content } })
    is(report.skipped, [first.title], 'skipped')
    is(report.created, [], 'created')

    const after = await get(`/prompts/${first.id}`)
    ok(after.prompt.body !== 'GANZ ANDERER TEXT', 'the prompt was overwritten although nothing was decided')
  })

  await check('collisions: "copy" keeps both (FA-802)', async () => {
    const first = (await get('/prompts', { params: { limit: 1 } })).prompts[0]
    const content = JSON.stringify({
      format: 'promptatelier-export', version: 2,
      prompts: [{ title: first.title, body: 'Die Kopie' }]
    })

    const { preview } = await post('/import/preview', { body: { content } })
    const { report } = await post('/import', { body: { content, decisions: { [preview.prompts[0].index]: 'copy' } } })
    is(report.created, [`${first.title} (Kopie)`], 'created as a copy')
  })

  await check('a decision that was never offered is refused (FA-802)', async () => {
    // `ambiguous` is about the **collection**, not about the file: it means
    // there is more than one prompt of that title here, so "overwrite" could
    // not say which. Two entries of one title *in the file* are two ordinary
    // collisions — which is what the first attempt at this case got wrong.
    const title = 'Zweimal derselbe Titel'
    await post('/prompts', { body: { title, body: 'Der erste.', tags: [] } })
    await post('/prompts', { body: { title, body: 'Der zweite.', tags: [] } })

    const content = JSON.stringify({
      format: 'promptatelier-export', version: 2,
      prompts: [{ title, body: 'Aus der Datei' }]
    })

    const { preview } = await post('/import/preview', { body: { content } })
    is(preview.prompts[0].state, 'ambiguous', 'two of that title in the collection')
    ok(!preview.prompts[0].decisions.includes('overwrite'), 'overwrite must not be offered')
    is(preview.prompts[0].candidates.length, 2, 'both candidates are named')

    await refused(() => post('/import', { body: { content, decisions: { 0: 'overwrite' } } }), 'decision_not_available')
  })

  // --- keywords in the transfer ----------------------------------------------
  //
  // Three defects of the full application, all in the same area, all inherited
  // here because this build carries its own port of that logic. The screen for
  // them arrives through the sync; the answers behind it do not.

  const keywordFile = (name, text) => JSON.stringify({
    format: 'promptatelier-export',
    version: 2,
    keywords: [{ name, description: null, text, position: 'append', sort_order: 10 }],
    prompts: []
  })

  await check('a file of keywords without prompts is read, not refused', async () => {
    const plan = (await post('/import/preview', {
      body: { content: keywordFile('Ganz neu', 'Ein Text') }
    })).preview

    is(plan.prompts.length, 0, 'no prompts in the file')
    is(plan.keywords.to_create, ['Ganz neu'], 'and the keyword is offered')

    // The other half of the rule: neither prompts nor keywords is still refused,
    // because there would be nothing to preview and nothing to write.
    const refusal = await refused(() => post('/import/preview', {
      body: {
        content: JSON.stringify({ format: 'promptatelier-export', version: 2, prompts: [], keywords: [] })
      }
    }))
    is(refusal.code, 'no_content', 'and says which case it is')
  })

  await check('a keyword whose name is taken is a decision, not a silent drop', async () => {
    const existing = current().keywords[0]
    ok(existing, 'the collection has a keyword to collide with')

    const plan = (await post('/import/preview', {
      body: { content: keywordFile(existing.name, 'EIN ANDERER TEXT') }
    })).preview

    is(plan.keywords.to_create, [], 'not counted as new')
    is(plan.keywords.missing, [], 'and not as missing either')
    is(plan.keywords.conflicts.length, 1, 'it is a conflict')

    const conflict = plan.keywords.conflicts[0]
    is(conflict.name, existing.name)
    is(conflict.decisions, ['skip', 'overwrite'], 'copying a keyword is not offered')
    is(conflict.existing.text, existing.text, 'both texts travel, so the choice is made in sight of them')
    is(conflict.incoming.text, 'EIN ANDERER TEXT')
    is(conflict.identical, false)
  })

  await check('a conflict that changes nothing says so', async () => {
    const existing = current().keywords[0]
    const plan = (await post('/import/preview', {
      body: {
        content: JSON.stringify({
          format: 'promptatelier-export',
          version: 2,
          keywords: [{
            name: existing.name,
            description: existing.description,
            text: existing.text,
            position: existing.position,
            sort_order: existing.sort_order
          }],
          prompts: []
        })
      }
    })).preview

    is(plan.keywords.conflicts[0].identical, true,
      'forty unchanged keywords must not read as forty decisions')
  })

  await check('skip is the default for a keyword and destroys nothing', async () => {
    const existing = current().keywords[0]
    const before = existing.text

    const report = (await post('/import', {
      body: { content: keywordFile(existing.name, 'DARF NICHT ANKOMMEN') }
    })).report

    is(report.keywords_skipped, [existing.name], 'named as skipped')
    is(report.keywords_created, [], 'and not as created')
    is(report.keywords_overwritten, [], 'and not as overwritten')
    is(current().keywords[0].text, before, 'the existing definition is untouched')
  })

  await check('overwrite replaces the definition, and the prompts holding it follow', async () => {
    const existing = current().keywords[0]
    const carrier = current().prompts.find((prompt) =>
      (prompt.keywords ?? []).some((held) => held.id === existing.id))

    const report = (await post('/import', {
      body: {
        content: keywordFile(existing.name, 'DER NEUE TEXT'),
        keyword_decisions: { 0: 'overwrite' }
      }
    })).report

    is(report.keywords_overwritten, [existing.name], 'named as overwritten')
    is(current().keywords.find((k) => k.name === existing.name).text, 'DER NEUE TEXT',
      'the catalogue carries the new text')

    // A prompt keeps its keywords in full, for the preview. Leaving those copies
    // behind would show the old text on the screen while the catalogue shows the
    // new one.
    if (carrier) {
      const held = current().prompts.find((prompt) => prompt.id === carrier.id).keywords
        .find((keyword) => keyword.id === existing.id)
      is(held.text, 'DER NEUE TEXT', 'and so does every prompt that holds it')
    }
  })

  await check('a keyword decision that was never offered is refused', async () => {
    const existing = current().keywords[0]
    const refusal = await refused(() => post('/import', {
      body: {
        content: keywordFile(existing.name, 'egal'),
        keyword_decisions: { 0: 'copy' }
      }
    }), 'decision_not_available')

    is(refusal.params.decision, 'copy', 'and names the decision it will not take')
  })

  await check('import: all or nothing (SEC-12)', async () => {
    const before = (await get('/prompts', { params: { limit: 500 } })).meta.total
    const content = JSON.stringify({
      format: 'promptatelier-export', version: 2,
      prompts: [
        { title: 'Geht durch', body: 'x' },
        // The second one collides with the first import's copy and is given a
        // decision the preview never offered, so the whole run is refused.
        { title: 'Geht durch', body: 'y' }
      ]
    })

    await post('/import', { body: { content } })
    const between = (await get('/prompts', { params: { limit: 500 } })).meta.total

    const bad = JSON.stringify({
      format: 'promptatelier-export', version: 2,
      prompts: [{ title: 'Neu und unschuldig', body: 'x' }, { title: 'Geht durch', body: 'y' }]
    })
    await refused(() => post('/import', { body: { content: bad, decisions: { 1: 'overwrite' } } }))

    const after = (await get('/prompts', { params: { limit: 500 } })).meta.total
    is(after, between, 'a refused import left something behind')
  })

  await check('markdown: one file per prompt, with a frontmatter Ruby can read (FA-803)', () => {
    const files = markdownFiles(current())
    ok(files.length > 0, 'no files')
    ok(files.every((file) => file.name.endsWith('.md')), 'a file without .md')
    ok(files.every((file) => /^---\n[\s\S]*\n---\n\n/.test(file.content)), 'a document without frontmatter')

    // What a Markdown file deliberately does **not** carry (17.2).
    const one = files[0].content
    ok(!one.includes('created_at'), 'timestamps must not be in a Markdown file')

    // And what it must: the names of the keywords, not their definitions.
    const withKeywords = files.find((file) => file.content.includes('default_keywords:'))
    if (withKeywords) ok(!withKeywords.content.includes('sort_order'), 'keyword definitions must not be in it')
  })

  await check('markdown: its own output reads back (the writer against the reader)', () => {
    const files = markdownFiles(current())
    const withVariables = files.find((file) => file.content.includes('variables:')) ?? files[0]

    const read = parse(withVariables.content)
    is(read.prompts.length, 1, 'one document is one prompt')
    ok(String(read.prompts[0].title).length > 0, 'no title')
    ok(String(read.prompts[0].body).length > 0, 'no body')
  })

  await check('file names: the slug rule of 14.2', () => {
    is(slug('Größe und Straße'), 'grosse-und-strasse', 'German')
    is(slug("Cœur de métier"), 'coeur-de-metier', 'ligature and accents')
    is(slug('!!!'), 'promptatelier', 'nothing usable falls back')
  })

  // --- AP-N7: the trash, the retention, the file ----------------------------

  const DAY = 24 * 60 * 60 * 1000
  const daysAgo = (days) => new Date(Date.now() - (days * DAY)).toISOString()

  await check('retention: the days left are counted the way a person counts them', () => {
    const now = new Date()
    is(daysLeft(now.toISOString(), now), TRASH_DAYS, 'just deleted')
    is(daysLeft(daysAgo(29.5), now), 1, 'half a day left is still a day, not none')
    is(daysLeft(daysAgo(40), now), 0, 'long overdue')
    // Neither is a number, and neither may be treated as one: a stamp that will
    // not parse and a stamp from the future are both "unknown age".
    is(daysLeft('not a date', now), null, 'unreadable')
    is(daysLeft(new Date(Date.now() + DAY).toISOString(), now), null, 'a wrong clock')
    is(daysLeft(null, now), null, 'nothing at all')
  })

  await check('retention: only what can be read is removed (FA-703)', () => {
    const now = new Date()
    ok(overdue({ deleted_at: daysAgo(31) }, now), '31 days is over')
    ok(!overdue({ deleted_at: daysAgo(29) }, now), '29 days is not')
    ok(!overdue({ deleted_at: daysAgo(30) }, now), 'exactly 30 is not yet over')
    ok(!overdue({ deleted_at: 'Freitag' }, now), 'an unreadable stamp stays')
    ok(!overdue({ deleted_at: null }, now), 'a live prompt is not in the bin')

    const record = {
      prompts: [
        { id: 1, title: 'bleibt', deleted_at: null },
        { id: 2, title: 'noch nicht', deleted_at: daysAgo(3) },
        { id: 3, title: 'überfällig', deleted_at: daysAgo(31) },
        { id: 4, title: 'unlesbar', deleted_at: 'irgendwann' }
      ],
      favorites: [1, 3]
    }

    is(sweep(record).removed, [{ id: 3, title: 'überfällig' }], 'what went, by name')
    is(record.prompts.map((prompt) => prompt.id), [1, 2, 4], 'and only that one')
    is(record.favorites, [1], 'its favourite mark went with it')
  })

  await check('the trash says how long each entry has left', async () => {
    const made = (await post('/prompts', {
      body: { title: 'Papierkorb-Frist', body: 'Text', tags: [] }
    })).prompt
    await del(`/prompts/${made.id}`)

    const fresh = (await get('/trash')).prompts.find((entry) => entry.id === made.id)
    is(fresh.days_left, TRASH_DAYS, 'just binned')

    current().prompts.find((prompt) => prompt.id === made.id).deleted_at = daysAgo(25)
    const older = (await get('/trash')).prompts.find((entry) => entry.id === made.id)
    is(older.days_left, 5, 'after 25 days')

    current().prompts.find((prompt) => prompt.id === made.id).deleted_at = 'kaputt'
    const broken = (await get('/trash')).prompts.find((entry) => entry.id === made.id)
    is(broken.days_left, null, 'and null when the date is not a date')

    await del(`/trash/${made.id}`)
  })

  // The whole path, not the function: bin something, backdate it, restart the
  // application, and see that the start-up run removed it **and said so**. The
  // saying is half of FA-706 — a clear-out nobody is told about is
  // indistinguishable from one that did not happen.
  await check('the clear-out runs at start-up and names what it took (FA-703, FA-706)', async () => {
    const doomed = (await post('/prompts', {
      body: { title: 'Seit vierzig Tagen fort', body: 'Text', tags: [] }
    })).prompt
    const kept = (await post('/prompts', {
      body: { title: 'Erst seit gestern fort', body: 'Text', tags: [] }
    })).prompt

    await del(`/prompts/${doomed.id}`)
    await del(`/prompts/${kept.id}`)

    current().prompts.find((prompt) => prompt.id === doomed.id).deleted_at = daysAgo(40)
    current().prompts.find((prompt) => prompt.id === kept.id).deleted_at = daysAgo(1)
    await save()

    await start()

    is(storage.purged.map((entry) => entry.title), ['Seit vierzig Tagen fort'], 'reported')
    const left = (await get('/trash')).prompts.map((entry) => entry.id)
    ok(!left.includes(doomed.id), 'the overdue one is gone')
    ok(left.includes(kept.id), 'the one from yesterday is not')

    // And it stays gone across another start, rather than being reported twice.
    await start()
    is(storage.purged, [], 'nothing left to report on the next start')

    await del(`/trash/${kept.id}`)
  })

  // EN-06, and the reason the revision was cut to one. The work package put the
  // number in writing: twenty revisions per prompt at two hundred prompts sits
  // between 116 and 437 percent of the smallest tier. One has to fit with room
  // to spare, and "has to" is not a measurement.
  await check('EN-06: one revision per prompt fits the smallest storage', async () => {
    const LIMIT = 5_210_112 // measured on the target machine, AP-N1
    const record = current()
    const bare = serialise(record).length

    // Every living prompt gets the heaviest revision it could have: a copy of
    // itself. That is exactly what an edit stores.
    const undone = {
      ...record,
      prompts: record.prompts.map((prompt) => ({
        ...prompt,
        revision: { ...prompt, revision: undefined },
        revision_count: 1
      }))
    }
    const full = serialise(undone).length
    const share = full / LIMIT

    ok(share < 0.5, `with revisions ${full} characters is ${Math.round(share * 100)} % of the limit`)

    return `${record.prompts.length} Prompts: ${bare} Zeichen ohne, ${full} mit je einer Revision ` +
      `— ${Math.round(share * 100)} % der gemessenen Grenze von ${LIMIT}`
  })

  await check('an import leaves the undo of the prompts it did not touch (FA-702)', async () => {
    const made = (await post('/prompts', {
      body: { title: 'Fasse dich kurz', body: 'Erste Fassung', tags: [] }
    })).prompt
    await put(`/prompts/${made.id}`, {
      body: { title: 'Fasse dich kurz', body: 'Zweite Fassung', tags: [] }
    })
    is((await get(`/prompts/${made.id}`)).prompt.revision_count, 1, 'there is something to undo')

    await post('/import', {
      body: {
        content: JSON.stringify({
          format: 'promptatelier-export',
          version: 2,
          prompts: [{ title: 'Etwas ganz anderes', body: 'Text', tags: [] }]
        })
      }
    })

    is((await get(`/prompts/${made.id}`)).prompt.revision_count, 1, 'and it is still there')
    const back = (await post(`/prompts/${made.id}/undo`)).prompt
    is(back.body, 'Erste Fassung', 'and it is the right one')

    await del(`/prompts/${made.id}`)
  })

  // --- tier 1, the file on the disk ------------------------------------------
  //
  // The browser's own door is replaced here and nothing else is: `pick`,
  // `writeText` and the whole path through `store/index.js` are the shipped
  // ones. A file chooser cannot be driven from a test — it is a window of the
  // operating system — so what stands in for it answers the way the real one
  // was measured to answer on the target machine (AP-N1, second run), down to
  // the permission being `prompt` at the start of a session.

  function fakeFile ({ name = 'prompt-atelier.json', permission = 'granted' } = {}) {
    const seen = { writes: 0, closes: 0, contents: null, permission }

    const handle = {
      name,
      queryPermission: async () => seen.permission,
      requestPermission: async () => { seen.permission = 'granted'; return 'granted' },
      async createWritable () {
        if (seen.permission !== 'granted') throw new DOMException('not allowed', 'NotAllowedError')

        let buffer = ''
        return {
          write: async (text) => { buffer += text },
          close: async () => { seen.contents = buffer; seen.writes += 1; seen.closes += 1 }
        }
      },
      getFile: async () => ({ text: async () => seen.contents ?? '' })
    }

    return { handle, seen }
  }

  async function withPicker (answer, run) {
    const before = globalThis.showSaveFilePicker
    globalThis.showSaveFilePicker = answer

    try {
      return await run()
    } finally {
      if (before) globalThis.showSaveFilePicker = before
      else delete globalThis.showSaveFilePicker
    }
  }

  const { handle, seen } = fakeFile()

  await check('tier 1: choosing a file writes it at once, in the exchange format', async () => {
    const done = await withPicker(async () => handle, () => chooseFile())

    ok(done, 'the choice was taken')
    is(storage.file.status, 'ready', 'the state says so')
    is(storage.file.name, 'prompt-atelier.json', 'and names the file')
    is(seen.writes, 1, 'written straight away, not at the next change')
    is(seen.closes, 1, 'and the stream was closed')

    const pack = JSON.parse(seen.contents)
    is(pack.format, 'promptatelier-export', 'a file Prompt Atelier can read')
    is(pack.version, 2, 'the current format version')
    ok(pack.prompts.length > 0, 'with the collection in it')
    is(storage.changes, 0, 'and nothing counts as unsaved any more')
  })

  await check('tier 1: every change reaches the file', async () => {
    const before = seen.writes

    await post('/prompts', { body: { title: 'Geht auf die Platte', body: 'Text', tags: [] } })

    is(seen.writes, before + 1, 'one change, one write')
    ok(JSON.parse(seen.contents).prompts.some((prompt) => prompt.title === 'Geht auf die Platte'),
      'and the new prompt is in it')
    is(storage.changes, 0, 'the header stays quiet while the disk keeps up')
  })

  await check('tier 1: a failed write does not take the collection with it', async () => {
    const broken = handle.createWritable
    handle.createWritable = async () => { throw new DOMException('gone', 'NotFoundError') }

    const made = await post('/prompts', { body: { title: 'Trotzdem da', body: 'Text', tags: [] } })

    is(made.prompt.title, 'Trotzdem da', 'the change went through')
    is((await get(`/prompts/${made.prompt.id}`)).prompt.title, 'Trotzdem da', 'and is in the collection')
    is(storage.file.status, 'failed', 'the file state says what happened')
    ok(storage.file.problem, 'with a reason to show')
    // The count has to start again, or the header would promise a backup that
    // stopped being written.
    ok(storage.changes > 0, 'and the unsaved count resumes')

    handle.createWritable = broken
    await del(`/prompts/${made.prompt.id}`)
  })

  await check('tier 1: a withdrawn permission is a click, not a failure', async () => {
    seen.permission = 'prompt'
    storage.file.status = 'ready'

    await post('/prompts', { body: { title: 'Nach der Sperre', body: 'Text', tags: [] } })
    is(storage.file.status, 'locked', 'locked rather than failed — the difference is the button')

    const back = await unlockFile()
    ok(back, 'the click let it through')
    is(seen.permission, 'granted', 'the browser was asked, not assumed')
    is(storage.file.status, 'ready', 'and writing resumed')
    is(storage.changes, 0, 'with the count cleared again')
  })

  await check('tier 1: giving it up, and a cancelled chooser', async () => {
    await releaseFile()
    is(storage.file.status, 'off', 'nothing is being written to disk')

    const before = seen.writes
    await post('/prompts', { body: { title: 'Ohne Datei', body: 'Text', tags: [] } })
    is(seen.writes, before, 'and really nothing')
    ok(storage.changes > 0, 'the count is back to doing its job')

    // Closing the dialogue is not a failure and must not be reported as one.
    const taken = await withPicker(
      async () => { throw new DOMException('cancelled', 'AbortError') },
      () => chooseFile())

    is(taken, false, 'nothing was chosen')
    is(storage.file.status, 'off', 'and nothing changed')
    is(storage.file.problem, null, 'no error to explain away')
  })

  await check('tier 1: the stream is closed even when the write fails', async () => {
    let closed = false
    const stubborn = {
      createWritable: async () => ({
        write: async () => { throw new Error('disk said no') },
        close: async () => { closed = true }
      })
    }

    let raised = null
    try { await writeText(stubborn, 'x') } catch (error) { raised = error }

    ok(raised, 'the failure is passed on')
    ok(closed, 'and the lock on the file is released all the same')

    // An engine without the permission methods has no notion of withholding.
    is(await permissionOf({}), 'granted', 'no methods means nothing to ask')
    is(await permissionOf(null), 'granted', 'and no handle is not a refusal either')
  })

  // The one that needed a mutation to be written at all. Every case above asks
  // `state.changes`, which is the value in memory — and the memory is right
  // whichever order the file and the storage are written in. What is wrong in
  // the other order is the **stored** record: it is serialised before the file
  // write clears the count, keeps a 1, and the next start of the application
  // nags about a change that is demonstrably on the disk. Reading the record
  // back is the only way to see it.
  await check('tier 1: the stored count agrees with what the disk holds', async () => {
    const second = fakeFile({ name: 'zweite.json' })
    await withPicker(async () => second.handle, () => chooseFile())

    await post('/prompts', { body: { title: 'Nach dem Neustart still', body: 'Text', tags: [] } })
    is(storage.changes, 0, 'nothing unsaved while the file keeps up')

    await start()
    is(storage.changes, 0, 'and still nothing unsaved after reading the record back')

    await releaseFile()
  })

  // The other answer, and the one that is easy to get wrong: „leer anfangen"
  // has to survive a restart. A question that comes back every morning is a
  // question that was not taken seriously — and it would be indistinguishable
  // from an application that forgot everything overnight.
  await check('„leer anfangen“ is an answer, not a postponement', async () => {
    const before = current().prompts.length

    // Put the collection back into the state a first run leaves behind, and go
    // through the storage rather than only through memory — the question is
    // asked from what was **read**, and a test that sets the flag in memory
    // would prove nothing about tomorrow morning.
    current().examplesOffered = false
    await save({ counts: false })
    await start()

    ok(offeringExamples.value, 'an unanswered collection asks')

    await declineExamples()

    ok(!offeringExamples.value, 'and it is gone once answered')
    is(current().prompts.length, before, 'declining puts nothing in and takes nothing out')

    await start()
    ok(!offeringExamples.value, 'still gone after reading the record back')
  })

  // The version, and the reason it is a case rather than a glance at the screen:
  // it is baked in by the build, so the one way it can break is silently — a
  // `define` that stopped being applied leaves `null`, and null renders as
  // nothing at all. Nobody notices a missing version until they need it.
  await check('the build says which version it is, and where it came from', async () => {
    const version = await get('/version')

    ok(/^\d+\.\d+\.\d+$/.test(version.app ?? ''), `own version: ${version.app}`)
    ok(/^\d+\.\d+\.\d+$/.test(version.source ?? ''), `Prompt Atelier: ${version.source}`)
    ok(/^\d{4}-\d{2}-\d{2}$/.test(version.built ?? ''), `built: ${version.built}`)
    ok(/^\d{4}-\d{2}-\d{2}$/.test(version.synced ?? ''), `synced: ${version.synced}`)
    // The server means its database schema by this, and there is none. Null
    // rather than an invented number, which somebody would one day compare
    // against a real one.
    is(version.schema, null, 'no schema version is claimed')

    return `Nano ${version.app}, gebaut ${version.built}, aus Prompt Atelier ` +
      `${version.source} übernommen am ${version.synced}`
  })

  await check('the collection survives a save and a fresh read', async () => {
    const before = (await get('/prompts', { params: { limit: 500 } })).meta.total
    await start()
    const after = (await get('/prompts', { params: { limit: 500 } })).meta.total
    is(after, before, 'prompt count after reloading the record')
  })

  // Nano's own sentences live in Nano's own table, and the upstream rule is
  // that a missing translation is answered from the English base. For the
  // copied language files that is right: an untranslated sentence is the normal
  // case there, and English beats a key on the screen.
  //
  // Here it is wrong, and quietly so. A table holding two of the five languages
  // the application offers looks exactly like a complete one — nothing raises,
  // nothing is logged, and the storage line under the header simply reads
  // English to somebody who chose French. That is how all 35 of these sentences
  // came to be English in three languages without a single case going red.
  //
  // So the claim is not "the table has entries" but "the screen answers in the
  // language that was asked for", and it is asked of every sentence rather than
  // a sample: the one that is forgotten is never the one somebody spot-checks.
  // Comparing against each language's own entry and not against the English one
  // is deliberate — `nano.app.name` is the same word in all five, and a test
  // demanding a difference would call that a fault.
  //
  // What this cannot see, and nothing here can: an entry that is present but
  // still holds the English sentence. That is a translation left undone, not a
  // table left incomplete, and only a reader of the language tells the two
  // apart.
  await check('every language on offer answers with Nano\'s own sentences', async () => {
    const keys = []
    const collect = (node, path = '') => {
      for (const [key, value] of Object.entries(node)) {
        if (value && typeof value === 'object') collect(value, `${path}${key}.`)
        else keys.push(`${path}${key}`)
      }
    }
    collect(ownTexts.en)

    const lookup = (source, key) => String(key).split('.').reduce(
      (node, part) => (node && typeof node === 'object' ? node[part] : undefined),
      source
    )

    const languages = availableLanguages()
    const english = []

    for (const code of languages) {
      await setLanguage(code)
      for (const key of keys) {
        if (t(key) !== lookup(ownTexts[code], key)) english.push(`${code}: ${key}`)
      }
    }

    // The bench runs in German from its first line, and a case takes nothing
    // away from the ones after it.
    await setLanguage('de')

    is(english, [], 'sentences that fell back to English')
    return `${languages.length} languages (${languages.join(', ')}) x ${keys.length} sentences`
  })
}

// The modules, reachable from outside the bundle. Two uses, and neither is a
// test: the measurements of NFA-02 drive them from Playwright, and whoever
// opens the bench by hand can try a search in the console without building
// anything. A bench that can only be read is half a bench.
window.__nano = { get, post, put, del, tokens, normalize, highlightRanges, render, packageFrom, current }

suite()
  .catch((error) => results.push({ name: 'the suite itself', ok: false, detail: error?.message ?? String(error) }))
  .finally(() => {
    const failed = results.filter((entry) => !entry.ok)
    window.__results = { total: results.length, failed: failed.length, results }

    document.getElementById('out').textContent = results
      .map((entry) => `${entry.ok ? 'ok  ' : 'FAIL'}  ${entry.name}` +
        `${entry.detail ? `\n        ${entry.detail}` : ''}` +
        `${entry.note ? `\n        ${entry.note}` : ''}`)
      .join('\n') + `\n\n${results.length - failed.length}/${results.length}`
  })
