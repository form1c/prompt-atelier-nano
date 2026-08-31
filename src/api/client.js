// Shadows vendor/api/client.js — see documentation/Quelltextabgleich.md,
// section 3. **This is the seam of the whole project.**
//
// The original turns a call into an HTTP request. This one turns the same call
// into an operation on the stored collection, and everything above it — twelve
// screens, two state modules, every error message — stays exactly as it is. The
// reason for keeping the shape of a request layer at all, when both sides live
// in the same memory, is Architekturentwurf.md, section 1: the endpoint
// contract of chapter 15 is already written down and already tested, which
// makes it the one place where a cut costs nothing to describe.
//
// **State of this file: AP-N6.** Every endpoint the screens reach is answered:
// the library, the prompt, the editor, the keywords, the trash, and both
// directions of the transfer.
//
// Two properties the original has that this one must keep, or the screens above
// break in ways that look like their own fault:
//
//   * every failure is an `ApiError` — the screens test with `instanceof` and
//     rethrow anything else
//   * the message is written **here** from a code, not sent by a server. That
//     was already true upstream (AP-19) and is why the whole i18n layer works
//     unchanged.

import { t } from '@/i18n'
import { COLLECTION_ID } from '@/state/session'
import { current, save, handOverBackup, markExported, state as storage } from '@/store'
import { promptFrom, tagsFrom, packageFrom } from '@/store/package'
import {
  parse, preview, decisionFor, keywordDecisionFor, markdownFiles, exportPackage,
  exportFilename, Refused
} from '@/store/transfer'
import { daysLeft } from '@/store/retention'
import { variableKeys } from '@/util/rendering'
import { find, indexOf, highlightRanges, termsOf } from '@/store/search'
import {
  Invalid, checkPrompt, checkVariableCount, checkKeyword, MAX_KEYWORDS
} from '@/store/validation'

export const API_PREFIX = '/api/v1'

// Replaced by the build (`buildInfo()` in vite.config.js). The fallback is for
// anything that imports this module without going through Vite — it says so
// rather than pretending to be a version, because „unbekannt" in a bug report is
// information and „0.0.0" is a wrong answer.
const BUILD = typeof __NANO_BUILD__ === 'undefined'
  ? { app: null, source: null, built: null, synced: null }
  : __NANO_BUILD__

// Same shape as upstream, deliberately down to the field names. A screen that
// reads `error.fields.title` must not have to care which build it is in.
export class ApiError extends Error {
  constructor ({ status = 0, code = 'unexpected', params = {}, message, fields = {}, details = {} } = {}) {
    super(message ?? sentenceFor(code, params))
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.params = params
    this.fields = fields
    this.details = details
  }

  fieldMessage (name) {
    const problem = this.fields?.[name]
    if (problem === undefined || problem === null) return undefined

    return typeof problem === 'string'
      ? sentenceFor(problem, {}, 'field')
      : sentenceFor(problem.code, problem.params ?? {}, 'field')
  }

  // Nothing can be unauthorised: there is no authorisation. Kept because the
  // screens ask, and a missing getter reads as `undefined`, which is falsy by
  // accident rather than by decision.
  get unauthorized () {
    return false
  }
}

function sentenceFor (code, params = {}, namespace = 'server') {
  for (const key of [`${namespace}.${code}`, `error.${code}`]) {
    try {
      return t(key, params)
    } catch { /* try the next place */ }
  }
  return t('error.unexpected')
}

// --- reading the collection -------------------------------------------------

const alive = () => current().prompts.filter((prompt) => !prompt.deleted_at)
const binned = () => current().prompts.filter((prompt) => prompt.deleted_at)

const withFavourite = (prompt) => ({
  ...prompt,
  favorite: current().favorites.includes(prompt.id),
  permissions: { update: true, delete: true, duplicate: true, move: false, visibility: true }
})

// Search and filter (FA-501, FA-504, FA-506, FA-507).
//
// The text part lives in `store/search.js`, which is where the normalisation is
// and where it is held against the vectors. What is here is everything the
// query says besides the words: tags, status, favourites, order.
//
// **The filters run before the text**, and cheaply first. A row that a tag
// filter throws out never needs its index built.
function filtered (rows, params = {}) {
  const wanted = [].concat(params['tags[]'] ?? params.tags ?? []).map(Number).filter(Boolean)
  const status = params.status ?? null
  const favourites = params.favorites === true || params.favorites === 'true'

  return rows.filter((prompt) => {
    // All of them, not any of them (FA-504): a second tag narrows the result.
    if (wanted.length > 0 && !wanted.every((id) => prompt.tag_ids.includes(id))) return false
    if (status && prompt.status !== status) return false
    // 11.3: archived prompts appear only when they are asked for.
    if (!status && prompt.status === 'archived') return false
    if (favourites && !current().favorites.includes(prompt.id)) return false

    return true
  })
}

// The index of a prompt, built once and kept until the prompt changes.
//
// Not in the stored record: it would double the size of everything for
// something that is derived in a millisecond, and a stale index in storage is a
// search that is wrong in a way nobody can see. Kept in memory, keyed by the
// prompt and its `updated_at`, so that an edit invalidates its own entry.
const indexes = new WeakMap()

function indexFor (prompt) {
  const held = indexes.get(prompt)
  if (held && held.stamp === prompt.updated_at) return held.index

  const index = indexOf(prompt)
  indexes.set(prompt, { stamp: prompt.updated_at, index })
  return index
}

// FA-507. Relevance only means something with a term; asking for it without one
// falls back to the default rather than failing, because the interface keeps
// the sort setting while the term is being cleared.
//
// By title through `Intl.Collator`, which is where this build is **better** than
// the original: SQLite compares bytes, so the main application carries a folded
// sort column and 161 hand-written replacements to make an alphabet out of
// them. The browser has an alphabet.
const collator = new Intl.Collator('de', { sensitivity: 'base', numeric: true })

function ordered (found, how, hasTerm) {
  if (how === 'title') return [...found].sort((one, other) => collator.compare(one.row.title, other.row.title))
  if (how === 'relevance' && hasTerm) return found
  if (!how && hasTerm) return found

  return [...found].sort((one, other) =>
    String(other.row.updated_at ?? '').localeCompare(String(one.row.updated_at ?? '')))
}

function searched (rows, params = {}) {
  const term = params.q ?? ''
  const found = find(filtered(rows, params), term, indexFor)

  return ordered(found, params.sort, termsOf(term) !== null).map((entry) => entry.row)
}

// The positions a term matches, in the **original** text. The server sends
// positions rather than marked-up text, and so does this: a title containing
// `<script>` must stay text (SEC-10).
function highlightsFor (prompt, params) {
  if (termsOf(params.q ?? '') === null) return {}

  return {
    title: highlightRanges(prompt.title, params.q),
    description: highlightRanges(prompt.description, params.q)
  }
}

// --- writing ----------------------------------------------------------------

// A refusal that reads like the server's. `readOnly` is not a permission but a
// state: a second window, or a record this build cannot understand.
function refuseIfLocked () {
  if (!storage.readOnly) return

  throw new ApiError({
    status: 409,
    code: 'unexpected',
    message: storage.problem === 'second_window'
      ? '[nano] Ein zweites Fenster ist bereits offen. Dieses hier ändert nichts, damit die beiden sich nicht überschreiben.'
      : '[nano] Die gespeicherte Sammlung ist mit dieser Version nicht lesbar. Es wird nichts geändert.'
  })
}

// The tag catalogue is derived from the prompts rather than kept beside them.
// One list, one numbering — the AP-N2 bug was two numberings that never met.
function recatalogue (record) {
  record.tags = tagsFrom(record.prompts.filter((prompt) => !prompt.deleted_at))

  for (const prompt of record.prompts) {
    prompt.tag_ids = (prompt.tags ?? [])
      .map((name) => record.tags.find((tag) => tag.name === name)?.id)
      .filter(Boolean)
  }
}

async function commit (record) {
  recatalogue(record)
  const written = await save()

  // A write that did not land must not be carried on from quietly. The
  // collection is still right in memory, and the screen has to be told — this
  // is the moment an export is worth more than anything else on it.
  if (!written && storage.problem === 'full') {
    throw new ApiError({
      status: 507,
      code: 'unexpected',
      message: '[nano] Der Browserspeicher ist voll. Bitte jetzt exportieren. Die Änderung liegt bis dahin nur im Arbeitsspeicher.'
    })
  }
}

// A refusal from the rules, in the shape of 15.2. `validation_failed` is a 422
// with fields; everything else is a 422 with a code the interface has a
// sentence for.
function asApiError (problem) {
  if (!(problem instanceof Invalid)) return problem

  return new ApiError({
    status: problem.code === 'name_taken' ? 409 : 422,
    code: problem.code,
    params: problem.code === 'validation_failed' ? {} : problem.fields,
    fields: problem.code === 'validation_failed' ? problem.fields : {}
  })
}

const checked = (run) => {
  try {
    return run()
  } catch (problem) {
    throw asApiError(problem)
  }
}

// A refusal from the transfer, in the shape the screen expects. The status
// codes follow `app.rb`: a file that cannot be used is 422, a decision that was
// never offered is 409.
function asTransferError (problem) {
  if (!(problem instanceof Refused)) return problem

  return new ApiError({
    status: problem.code === 'decision_not_available' ? 409 : 422,
    code: problem.code,
    params: problem.detail
  })
}

const reading = (run) => {
  try {
    return run()
  } catch (problem) {
    throw asTransferError(problem)
  }
}

// The editor sends what a file carries (names, option lists), so the same
// conversion runs here as on import — see store/package.js.
//
// **The set of variables follows from the text and from nothing else** (FA-301).
// The editor sends metadata for them — label, type, default — but not their
// existence: an entry whose key no longer occurs in the body disappears, and an
// occurrence without an entry is created. Taking the editor's list at face
// value would let a variable outlive the `{{…}}` that made it.
function buildPrompt (body, id) {
  const record = current()
  const catalogue = tagsFrom([...record.prompts.filter((prompt) => !prompt.deleted_at), body])

  const keys = variableKeys(body.body ?? '')
  checkVariableCount(keys)

  const provided = new Map((body.variables ?? []).map((variable) => [String(variable.key).toLowerCase(), variable]))
  const variables = keys.map((key, position) => ({
    ...(provided.get(key) ?? { key, label: '', type: 'text', default_value: '', options: [], required: false }),
    key,
    position
  }))

  return promptFrom({ ...body, variables }, {
    id,
    workspaceId: COLLECTION_ID,
    tags: catalogue,
    keywords: record.keywords.filter((keyword) => (body.keyword_ids ?? []).includes(keyword.id))
  })
}

// A prompt of a package, as it goes into the collection. The timestamps come
// **from the file** and not from the clock: the promise of FA-804 is that a
// prompt comes back as it was. A Markdown file carries none, and then the new
// ones stand — which is exactly what 17.2 announces.
function intoCollection (draft, source) {
  const catalogue = tagsFrom([...draft.prompts.filter((prompt) => !prompt.deleted_at), source])
  const now = new Date().toISOString()

  const built = promptFrom(source, {
    id: draft.nextId,
    workspaceId: COLLECTION_ID,
    tags: catalogue,
    keywords: draft.keywords.filter((keyword) => (source.default_keywords ?? []).includes(keyword.name))
  })

  draft.nextId += 1
  built.created_at = source.created_at ?? now
  built.updated_at = source.updated_at ?? now

  return built
}

// FA-511 and FA-703a: what was done, and what was not, by name.
//
// „Teilweiser Erfolg ist der Normalfall": on the server a bulk action meets
// prompts the reader may not touch. Here nothing can be forbidden, so the only
// refusals left are the honest ones — an identifier that is not there. The
// report keeps its shape all the same, because the screens read it and because
// a shape that exists only in the good case is a shape nobody tests.
function bulk (ids, act) {
  const done = []
  const refused = []

  for (const id of ids ?? []) {
    const prompt = current().prompts.find((entry) => entry.id === Number(id))
    if (!prompt) { refused.push({ id: Number(id), title: null, reason: 'not_found' }); continue }

    act(prompt)
    done.push({ id: prompt.id, title: prompt.title })
  }

  return { counts: { done: done.length, refused: refused.length }, done, refused }
}

// --- the handlers -----------------------------------------------------------
//
// Written as `METHOD path` against the routes of chapter 15. A path with an
// identifier is matched by pattern, so that the table reads like the endpoint
// list it stands for rather than like a chain of conditions.
//
// Every handler takes the same two arguments — the groups captured from the
// path, then the call itself — whether it uses them or not. Two of them were
// written the other way round in AP-N2, read the match array as the options,
// and asked an array for `.offset`. The uniform signature is what makes that
// impossible rather than merely unlikely.

const HANDLERS = [
  ['GET', /^\/prompts$/, (_match, { params }) => {
    const found = searched(alive(), params)
    const from = Number(params.offset ?? 0)
    const size = Number(params.limit ?? 50)

    return {
      prompts: found.slice(from, from + size)
        .map((prompt) => ({ ...withFavourite(prompt), highlights: highlightsFor(prompt, params) })),
      meta: { total: found.length }
    }
  }],

  ['GET', /^\/prompts\/ids$/, (_match, { params }) => ({
    ids: searched(alive(), params).map((prompt) => prompt.id),
    limit: 500
  })],

  ['GET', /^\/prompts\/(\d+)$/, ([id]) => {
    const prompt = alive().find((entry) => entry.id === Number(id))
    if (!prompt) throw new ApiError({ status: 404, code: 'not_found' })

    return { prompt: withFavourite(prompt) }
  }],

  ['POST', /^\/prompts$/, async (_match, { body }) => {
    refuseIfLocked()
    const record = current()
    const prompt = checked(() => { checkPrompt(body); return buildPrompt(body, record.nextId) })

    prompt.created_at = new Date().toISOString()
    prompt.updated_at = prompt.created_at

    record.prompts.push(prompt)
    record.nextId += 1
    await commit(record)

    return { prompt: withFavourite(prompt) }
  }],

  ['PUT', /^\/prompts\/(\d+)$/, async ([id], { body }) => {
    refuseIfLocked()
    const record = current()
    const at = record.prompts.findIndex((entry) => entry.id === Number(id))
    if (at < 0) throw new ApiError({ status: 404, code: 'not_found' })

    const previous = record.prompts[at]
    const next = checked(() => { checkPrompt(body); return buildPrompt(body, previous.id) })
    next.created_at = previous.created_at
    next.updated_at = new Date().toISOString()

    // FA-701 cut to one revision: exactly the state before the last change,
    // which is all FA-702 needs and all EN-06 allows. The revision of the
    // revision is dropped, or each save would carry the whole history along.
    next.revision = { ...previous, revision: undefined }
    next.revision_count = 1

    record.prompts[at] = next
    await commit(record)

    return { prompt: withFavourite(next) }
  }],

  ['POST', /^\/prompts\/(\d+)\/undo$/, async ([id]) => {
    refuseIfLocked()
    const record = current()
    const at = record.prompts.findIndex((entry) => entry.id === Number(id))
    if (at < 0 || !record.prompts[at].revision) {
      throw new ApiError({ status: 404, code: 'not_found' })
    }

    record.prompts[at] = { ...record.prompts[at].revision, revision_count: 0 }
    await commit(record)

    return { prompt: withFavourite(record.prompts[at]) }
  }],

  ['DELETE', /^\/prompts\/(\d+)$/, async ([id]) => {
    refuseIfLocked()
    const record = current()
    const prompt = record.prompts.find((entry) => entry.id === Number(id))
    if (!prompt) throw new ApiError({ status: 404, code: 'not_found' })

    prompt.deleted_at = new Date().toISOString()
    await commit(record)

    return {}
  }],

  ['POST', /^\/prompts\/(\d+)\/favorite$/, async ([id]) => {
    refuseIfLocked()
    const record = current()
    if (!record.favorites.includes(Number(id))) record.favorites.push(Number(id))
    await commit(record)

    return {}
  }],

  ['DELETE', /^\/prompts\/(\d+)\/favorite$/, async ([id]) => {
    refuseIfLocked()
    const record = current()
    record.favorites = record.favorites.filter((entry) => entry !== Number(id))
    await commit(record)

    return {}
  }],

  // 15.3. Answered rather than left as a gap, and answered in the **shape the
  // server uses** — `app` is the field the shell reads, and a shell that had to
  // know which build it was talking to would be a shadow deeper than it is.
  //
  // `schema` says `null` on purpose: the server means its database schema
  // version by it, and there is no database. A number invented to fill the field
  // would be a number somebody eventually compares against a real one.
  //
  // The two extra fields are Nano's own and are the reason this endpoint is
  // worth having here at all — see `buildInfo()` in vite.config.js. Forty-one of
  // these files are copies, so „which version" has two honest answers.
  ['GET', /^\/version$/, () => ({
    app: BUILD.app,
    schema: null,
    source: BUILD.source,
    built: BUILD.built,
    synced: BUILD.synced
  })],

  ['GET', /^\/tags$/, () => ({ tags: current().tags })],
  ['GET', /^\/keywords$/, () => ({ keywords: current().keywords })],

  // FA-703. `days_left` is this build's own field, and it is here rather than
  // in the screen so that the number somebody reads and the sweep that acts on
  // it cannot come from two different opinions about the date (AP-N7). It is
  // null when the stamp will not parse — the sweep leaves those alone and the
  // screen has a sentence for it.
  ['GET', /^\/trash$/, () => {
    const now = new Date()

    return {
      prompts: binned().map((prompt) => ({
        ...withFavourite(prompt),
        days_left: daysLeft(prompt.deleted_at, now),
        permissions: { restore: true, purge: true }
      })),
      meta: { total: binned().length }
    }
  }],

  ['POST', /^\/trash\/(\d+)\/restore$/, async ([id]) => {
    refuseIfLocked()
    const record = current()
    const prompt = record.prompts.find((entry) => entry.id === Number(id))
    if (!prompt) throw new ApiError({ status: 404, code: 'not_found' })

    prompt.deleted_at = null
    await commit(record)

    return {}
  }],

  ['DELETE', /^\/trash\/(\d+)$/, async ([id]) => {
    refuseIfLocked()
    const record = current()
    record.prompts = record.prompts.filter((entry) => entry.id !== Number(id))
    record.favorites = record.favorites.filter((entry) => entry !== Number(id))
    await commit(record)

    return {}
  }],

  // FA-204. The copy carries "(Kopie)" and starts as a draft that only its
  // owner sees: a duplicate is a working copy, and a working copy that was
  // instantly as public as its original would publish something nobody has
  // looked at yet.
  ['POST', /^\/prompts\/(\d+)\/duplicate$/, async ([id]) => {
    refuseIfLocked()
    const record = current()
    const source = alive().find((entry) => entry.id === Number(id))
    if (!source) throw new ApiError({ status: 404, code: 'not_found' })

    const copy = {
      ...structuredClone({ ...source, revision: undefined }),
      id: record.nextId,
      title: `${source.title} (Kopie)`,
      visibility: 'private',
      status: 'draft',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      revision: undefined,
      revision_count: 0
    }

    record.prompts.push(copy)
    record.nextId += 1
    await commit(record)

    return { prompt: withFavourite(copy) }
  }],

  // EN-03: there is one collection, so there is nowhere to move to. Refused by
  // name rather than quietly doing nothing — a screen that reports success for
  // an action that did not happen is worse than one that says it cannot.
  ['POST', /^\/prompts\/(\d+)\/move$/, () => {
    throw new ApiError({
      status: 409,
      code: 'unexpected',
      message: '[nano] Diese Version führt genau eine Sammlung. Es gibt nichts, wohin verschoben werden könnte.'
    })
  }],

  ['POST', /^\/prompts\/bulk\/move$/, () => {
    throw new ApiError({
      status: 409,
      code: 'unexpected',
      message: '[nano] Diese Version führt genau eine Sammlung. Es gibt nichts, wohin verschoben werden könnte.'
    })
  }],

  ['POST', /^\/prompts\/bulk\/trash$/, async (_match, { body }) => {
    refuseIfLocked()
    const now = new Date().toISOString()
    const report = bulk(body?.prompt_ids, (prompt) => { prompt.deleted_at = now })
    await commit(current())

    return report
  }],

  ['POST', /^\/trash\/bulk\/restore$/, async (_match, { body }) => {
    refuseIfLocked()
    const report = bulk(body?.prompt_ids, (prompt) => { prompt.deleted_at = null })
    await commit(current())

    return report
  }],

  ['POST', /^\/trash\/bulk\/purge$/, async (_match, { body }) => {
    refuseIfLocked()
    const record = current()
    const report = bulk(body?.prompt_ids, () => {})
    const doomed = new Set(report.done.map((entry) => entry.id))

    record.prompts = record.prompts.filter((prompt) => !doomed.has(prompt.id))
    record.favorites = record.favorites.filter((id) => !doomed.has(id))
    await commit(record)

    return report
  }],

  // --- keywords (FA-401, FA-404) ---------------------------------------------

  ['POST', /^\/keywords$/, async (_match, { body }) => {
    refuseIfLocked()
    const record = current()
    const clean = checked(() => checkKeyword(body, { existing: record.keywords }))

    const keyword = {
      id: (record.nextKeywordId ??= record.keywords.length + 1),
      name: clean.name,
      description: clean.description ?? null,
      text: clean.text,
      position: clean.position ?? 'append',
      sort_order: Number(clean.sort_order) || 100
    }

    record.nextKeywordId += 1
    record.keywords.push(keyword)
    await commit(record)

    return { keyword }
  }],

  ['PUT', /^\/keywords\/(\d+)$/, async ([id], { body }) => {
    refuseIfLocked()
    const record = current()
    const at = record.keywords.findIndex((keyword) => keyword.id === Number(id))
    if (at < 0) throw new ApiError({ status: 404, code: 'not_found' })

    const clean = checked(() => checkKeyword(body, { existing: record.keywords, id: Number(id) }))
    const keyword = {
      ...record.keywords[at],
      name: clean.name,
      description: clean.description ?? null,
      text: clean.text,
      position: clean.position ?? record.keywords[at].position,
      sort_order: Number(clean.sort_order) || 0
    }

    record.keywords[at] = keyword
    // A prompt holds its keywords in full, for the preview (NFA-14). Changing
    // one has to reach those copies, or the text on the screen would be the old
    // one while the catalogue shows the new.
    for (const prompt of record.prompts) {
      prompt.keywords = (prompt.keywords ?? []).map((held) => held.id === keyword.id ? keyword : held)
    }
    await commit(record)

    return { keyword }
  }],

  // FA-404 in two steps, and the refusal is the point. The first call carries
  // no confirmation and is **meant** to be refused: the answer names the
  // prompts the keyword sits on, because "3 Prompts betroffen" is a number and
  // three titles are an answer.
  //
  // The refusal comes for every keyword, including one no prompt uses — the
  // screen has two wordings ready and picks by the length of the list.
  ['DELETE', /^\/keywords\/(\d+)$/, async ([id], { body }) => {
    refuseIfLocked()
    const record = current()
    const keyword = record.keywords.find((entry) => entry.id === Number(id))
    if (!keyword) throw new ApiError({ status: 404, code: 'not_found' })

    const affected = record.prompts
      .filter((prompt) => !prompt.deleted_at && (prompt.keywords ?? []).some((held) => held.id === keyword.id))
      .map((prompt) => ({ id: prompt.id, title: prompt.title }))

    if (body?.confirm !== true) {
      throw new ApiError({
        status: 409,
        code: 'confirmation_required',
        details: { affected_prompts: affected }
      })
    }

    record.keywords = record.keywords.filter((entry) => entry.id !== keyword.id)
    for (const prompt of record.prompts) {
      prompt.keywords = (prompt.keywords ?? []).filter((held) => held.id !== keyword.id)
    }
    await commit(record)

    return { removed_assignments: affected.length }
  }],

  // --- the transfer (FA-801 to FA-804) ---------------------------------------

  // The export hands back the package; the **screen** turns it into a file, as
  // it does against the server. Marking the collection as secured happens here
  // all the same: this is the moment the content left, and the counter in the
  // header is about content that has not.
  ['POST', /^\/export$/, async (_match, { body }) => {
    const only = Array.isArray(body?.prompt_ids) && body.prompt_ids.length > 0
      ? body.prompt_ids.map(Number)
      : null

    if (body?.format === 'markdown') {
      const files = markdownFiles(current(), { only })
      // Not marked as secured: Markdown is **not** lossless (FA-803), and a
      // counter reset by it would say "you have a backup" about a file that
      // dropped the timestamps and the keyword definitions.
      return { format: 'markdown', files }
    }

    const pack = exportPackage(current(), { only })
    // Only a full export is a backup. A handful of prompts is a transfer.
    if (only === null) await markExported()

    return { format: 'json', filename: exportFilename(pack), package: pack }
  }],

  ['POST', /^\/import\/preview$/, (_match, { body }) => {
    const pack = reading(() => parse(body?.content))

    return { preview: preview(current(), pack) }
  }],

  // One decision at a time would be a second parse and a second preview, and
  // the two could disagree with what the user was shown. So the file is read
  // again here and the plan rebuilt from it — the decisions are the only thing
  // carried over, and they are keyed by position in the file (FA-802).
  //
  // **All or nothing** (SEC-12). There is no transaction here, so the work is
  // done on a copy and the copy replaces the collection only at the end. A file
  // that turns out to be unusable at prompt 40 of 51 leaves nothing behind.
  ['POST', /^\/import$/, async (_match, { body }) => {
    refuseIfLocked()

    const pack = reading(() => parse(body?.content))
    const record = current()
    const plan = preview(record, pack)

    // Cloned without the revisions, and they are put back below. Cloning them
    // would double the work of an import for something most of which is thrown
    // away again — but dropping them outright, which is what this line did
    // until AP-N7, silently took the undo off **every** prompt in the
    // collection, including the ones the file never mentioned.
    const draft = structuredClone({
      ...record,
      prompts: record.prompts.map((prompt) => ({ ...prompt, revision: undefined }))
    })
    const replaced = new Set()

    const report = {
      created: [],
      overwritten: [],
      skipped: [],
      keywords_created: [],
      keywords_overwritten: [],
      keywords_skipped: [],
      keywords_missing: plan.keywords.missing,
      unknown_fields: pack.unknown_fields
    }

    // The keywords first: a prompt that names one has to find it.
    //
    // Three outcomes per entry, and the middle one is the one that had to be
    // built. A name that is already taken was passed over in silence in the
    // first port of this logic, so the file's definition was dropped without
    // anybody being told. It is a decision instead,
    // and skipping is what an unanswered one means.
    const conflicts = new Map(plan.keywords.conflicts.map((entry) => [entry.index, entry]))

    for (const [index, entry] of pack.keywords.entries()) {
      const name = String(entry.name).trim()
      const conflict = conflicts.get(index)

      const definition = {
        name,
        description: entry.description ?? null,
        text: entry.text ?? '',
        position: entry.position ?? 'append',
        sort_order: Number(entry.sort_order) || 100
      }

      if (!conflict) {
        if (!plan.keywords.to_create.includes(name)) continue

        draft.nextKeywordId = draft.nextKeywordId ?? draft.keywords.length + 1
        draft.keywords.push({ id: draft.nextKeywordId, ...definition })
        draft.nextKeywordId += 1
        report.keywords_created.push(name)
        continue
      }

      if (reading(() => keywordDecisionFor(conflict, body?.keyword_decisions)) !== 'overwrite') {
        report.keywords_skipped.push(name)
        continue
      }

      // The identifier stays, because prompts already in the collection hold
      // their keywords in full and are matched back by it below.
      const at = draft.keywords.findIndex((keyword) => keyword.name === name)
      draft.keywords[at] = { ...draft.keywords[at], ...definition }
      report.keywords_overwritten.push(name)
    }

    // A prompt carries its keywords in full, for the preview. An overwritten
    // definition has to reach those copies, or the text on the screen would be
    // the old one while the catalogue shows the new.
    if (report.keywords_overwritten.length > 0) {
      const byId = new Map(draft.keywords.map((keyword) => [keyword.id, keyword]))
      for (const prompt of draft.prompts) {
        prompt.keywords = (prompt.keywords ?? []).map((held) => byId.get(held.id) ?? held)
      }
    }

    for (const entry of plan.prompts) {
      const source = pack.prompts[entry.index]
      const choice = reading(() => decisionFor(entry, body?.decisions))

      if (choice === 'skip') { report.skipped.push(entry.title); continue }

      const title = choice === 'copy' ? `${entry.title} (Kopie)` : entry.title
      const built = intoCollection(draft, { ...source, title })

      if (choice === 'overwrite') {
        const at = draft.prompts.findIndex((prompt) => prompt.id === entry.candidates[0].id)
        built.id = draft.prompts[at].id
        draft.prompts[at] = built
        replaced.add(built.id)
        report.overwritten.push(entry.title)
      } else {
        draft.prompts.push(built)
        report.created.push(title)
      }
    }

    // The undo states, back onto the prompts the file did not touch. An
    // overwritten one keeps none on purpose: the import is all or nothing
    // (SEC-12), and an undo that took one prompt of fifty-five back to before
    // it would be a partial undo of something that happened as a whole.
    const held = new Map(record.prompts
      .filter((prompt) => prompt.revision)
      .map((prompt) => [prompt.id, prompt.revision]))

    for (const prompt of draft.prompts) {
      if (replaced.has(prompt.id) || !held.has(prompt.id)) continue

      prompt.revision = held.get(prompt.id)
      prompt.revision_count = 1
    }

    // Nothing was touched until this line.
    Object.assign(record, draft)
    await commit(record)

    return { report }
  }]

]

// --- the call ---------------------------------------------------------------

export async function request (method, path, options = {}) {
  const { params = {}, body } = options
  const verb = method.toUpperCase()
  const route = path.startsWith(API_PREFIX) ? path.slice(API_PREFIX.length) : path

  for (const [expected, pattern, handle] of HANDLERS) {
    if (verb !== expected) continue

    const match = pattern.exec(route)
    if (!match) continue

    // A handler may reject, and it does so the way the server does: with a code
    // the interface turns into a sentence.
    return handle(match.slice(1), { params, body })
  }

  // Not "not found". A route that exists in the contract but has no handler yet
  // is a gap in this build, and saying so plainly is what keeps the next
  // package from hunting for a server that was never there.
  throw new ApiError({
    status: 501,
    code: 'unexpected',
    message: `[nano] ${verb} ${route} is not implemented in this build (AP-N3)`
  })
}

export const get = (path, options) => request('GET', path, options)
export const post = (path, options) => request('POST', path, options)
export const put = (path, options) => request('PUT', path, options)
export const del = (path, options) => request('DELETE', path, options)

// Present because upstream has them and something may import them. Neither has
// a subject here: no session can expire, and there is no cookie to read.
export function onSessionExpired () {}
export function readCookie () { return null }
