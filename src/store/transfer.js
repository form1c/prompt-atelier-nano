// Import and export (FA-801 to FA-804, Requirements chapter 17).
//
// A port of `services/transfer.rb`, and the one module where being a faithful
// port matters more than being a good one: what this reads and writes is the
// only thing the two applications ever say to each other.
//
// The promise that shapes everything here is FA-804 — a JSON export read back
// into an empty collection yields the same content. So the format is a content
// image and never a system image: no accounts, no favourites, no revisions, no
// internal identifiers. What travels is what somebody wrote.
//
// Two formats with two different promises, and the difference is not a detail:
//
//   * **JSON** is the removal van. Lossless, keeps timestamps and the full
//     keyword definitions.
//   * **Markdown** is the filing cabinet. One readable file per prompt, no
//     timestamps, keywords by name only — and therefore *not* lossless
//     (FA-803, 17.2). Saying so plainly is part of the requirement.
//
// Per `EN-04` only the Markdown **export** exists here. The way back is JSON,
// which loses nothing.

import { optionList, packageFrom } from '@/store/package'

export const FORMAT = 'promptatelier-export'
export const VERSION = 2
export const READABLE_VERSIONS = [1, 2]

// The name the product carried before it was called Prompt Atelier. Files
// written under it are still read, and that is not politeness: an export is
// somebody's backup, and a rename of the product must not make yesterday's file
// unreadable.
//
// ⚠ This string is **data**, not a name. A blanket rename across the source
// must leave it alone.
export const FORMER_FORMATS = ['promptstorage-export']

// 10 MB, SEC-12. Checked before anything is parsed — a limit that only applies
// after reading is not a limit, it is a report.
export const MAX_BYTES = 10 * 1024 * 1024

// The spellings a version 1 file carries. Applied to **every** incoming file
// rather than only to `"version": 1`: a Markdown export states no version at
// all, so a rule hung on that field would miss precisely the format that cannot
// carry it. The mapping is safe to apply twice — no English value is a key.
const LEGACY_VALUES = {
  visibility: { privat: 'private', instanz: 'instance' },
  status: { entwurf: 'draft', aktiv: 'active', archiviert: 'archived' },
  type: { mehrzeilig: 'multiline', auswahl: 'select', zahl: 'number' }
}

// What a collision may be answered with (FA-802). `overwrite` is absent from
// the list when the target holds more than one prompt of that title: there
// would be no way to say *which* one.
export const DECISIONS = ['skip', 'copy', 'overwrite']

// **Copying is deliberately absent for a keyword.** Its name is unique in the
// collection and is what an imported prompt resolves its keywords through, so a
// copy under a different name would be a definition no imported prompt refers
// to.
export const KEYWORD_DECISIONS = ['skip', 'overwrite']

// The fields 17.1 lists. Anything else in a file is unknown and is **reported**
// rather than silently dropped: a file from a newer version stays usable, and
// the report says what was left behind rather than letting the user find out
// later.
const PROMPT_FIELDS = ['title', 'description', 'body', 'visibility', 'status', 'model_hint',
  'tags', 'default_keywords', 'variables', 'created_at', 'updated_at']
const VARIABLE_FIELDS = ['key', 'label', 'type', 'default_value', 'options', 'required', 'position']
const KEYWORD_FIELDS = ['name', 'description', 'text', 'position', 'sort_order']

export class Refused extends Error {
  constructor (code, detail = {}) {
    super(code)
    this.name = 'Refused'
    this.code = code
    this.detail = detail
  }
}

const readableFormat = (value) => value === FORMAT || FORMER_FORMATS.includes(value)

const modernise = (field, value) => LEGACY_VALUES[field]?.[value] ?? value

// --- reading a file ---------------------------------------------------------

// Turns a file into a package, or refuses with a reason that names what is
// wrong. "Invalid file" alone leaves the user with a file and no idea what to
// do about it (FA-802).
//
// Both formats end up in the same shape, so everything downstream — the
// preview, the collision rules, the writing — exists once. A second path for
// Markdown would be a second place for the rules to be almost the same.
export function parse (content) {
  const text = String(content ?? '')
  if (text.trim() === '') throw new Refused('empty_file')

  // Counted in bytes, not characters: the limit is about the file, and a file
  // of umlauts is bigger than its length suggests.
  const bytes = new TextEncoder().encode(text).length
  if (bytes > MAX_BYTES) throw new Refused('file_too_large', { limit: MAX_BYTES })

  return text.trimStart().startsWith('{') ? parseJson(text) : parseMarkdown(text)
}

function parseJson (text) {
  let data
  try {
    data = JSON.parse(text)
  } catch (error) {
    // The parser's own message names the position, which is the one thing that
    // helps with a file somebody edited by hand.
    throw new Refused('malformed_json', { reason: String(error.message).split('\n')[0] })
  }

  if (!data || typeof data !== 'object' || !readableFormat(data.format)) throw new Refused('not_an_export')
  if (!READABLE_VERSIONS.includes(data.version)) throw new Refused('unsupported_version', { version: data.version })

  // **Either of the two is enough.** A full export carries every keyword of a
  // collection whether or not a prompt uses one, so a collection holding only
  // keywords exports to exactly this shape. Refusing it meant writing a file
  // that could not be read back. Refused is only the file that carries neither,
  // because there is nothing to preview and nothing to write.
  const prompts = data.prompts ?? []
  const keywords = data.keywords ?? []

  if (!Array.isArray(prompts)) throw new Refused('not_an_export')
  if (!Array.isArray(keywords)) throw new Refused('not_an_export')
  if (prompts.length === 0 && keywords.length === 0) throw new Refused('no_content')

  return packageOf(prompts, keywords, data.workspace?.name)
}

// One Markdown document is one prompt (17.2). The keyword **names** are in the
// frontmatter and their definitions are not — which is exactly the loss FA-803
// is honest about, and it shows up here as a package with prompts and no
// keywords.
function parseMarkdown (text) {
  const match = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/.exec(text)
  if (!match) throw new Refused('no_frontmatter')

  let data
  try {
    data = readFrontmatter(match[1])
  } catch (error) {
    throw new Refused('malformed_frontmatter', { reason: error.message })
  }

  if (!data || String(data.title ?? '').trim() === '') throw new Refused('not_an_export')

  return packageOf([{ ...data, body: match[2].trim() }], [], null)
}

function packageOf (prompts, keywords, workspaceName) {
  const unknown = new Set()

  const entries = prompts.map((entry, index) => {
    if (!entry || typeof entry !== 'object') throw new Refused('prompt_not_an_object', { index })
    if (String(entry.title ?? '').trim() === '') throw new Refused('prompt_without_title', { index })
    if (String(entry.body ?? '').trim() === '') throw new Refused('prompt_without_body', { index })

    for (const key of Object.keys(entry)) if (!PROMPT_FIELDS.includes(key)) unknown.add(key)
    for (const variable of entry.variables ?? []) {
      if (variable && typeof variable === 'object') {
        for (const key of Object.keys(variable)) if (!VARIABLE_FIELDS.includes(key)) unknown.add(key)
      }
    }

    return {
      ...entry,
      visibility: modernise('visibility', entry.visibility ?? 'private'),
      status: modernise('status', entry.status ?? 'draft'),
      variables: (entry.variables ?? []).map((variable) => ({
        ...variable,
        type: modernise('type', variable.type ?? 'text')
      }))
    }
  })

  const definitions = (keywords ?? []).filter((entry) =>
    entry && typeof entry === 'object' && String(entry.name ?? '').trim() !== '')
  for (const entry of definitions) {
    for (const key of Object.keys(entry)) if (!KEYWORD_FIELDS.includes(key)) unknown.add(key)
  }

  return {
    workspace_name: workspaceName ?? null,
    keywords: definitions,
    prompts: entries,
    unknown_fields: [...unknown].sort()
  }
}

// --- the preview (FA-802, W-8) ----------------------------------------------

// Nothing is written here, and that is the whole point: an import that silently
// overwrites 200 prompts is a data-loss event. The answer says per entry what
// would happen and what may be decided.
//
// Entries are addressed by their **position in the file**, not by their title.
// A file may well carry the same title twice — FA-204 produces "… (Kopie)" and
// somebody exports both — and a decision keyed by title would then apply to a
// row nobody meant.
export function preview (record, pack) {
  const existing = titlesIn(record)

  const entries = pack.prompts.map((entry, index) => {
    const matches = existing.get(collisionKey(entry.title)) ?? []

    return {
      index,
      title: String(entry.title).trim(),
      state: matches.length === 0 ? 'new' : matches.length === 1 ? 'collision' : 'ambiguous',
      decisions: matches.length === 0 ? [] : matches.length === 1 ? DECISIONS : DECISIONS.filter((one) => one !== 'overwrite'),
      candidates: matches
    }
  })

  return {
    prompts: entries,
    new_count: entries.filter((entry) => entry.state === 'new').length,
    collision_count: entries.filter((entry) => entry.state !== 'new').length,
    keywords: keywordReport(record, pack),
    unknown_fields: pack.unknown_fields
  }
}

// The comparison key of FA-802: the title inside the target collection, without
// regard to case or surrounding spaces.
export const collisionKey = (title) => String(title ?? '').trim().toLowerCase()

function titlesIn (record) {
  const byKey = new Map()

  for (const prompt of record.prompts) {
    if (prompt.deleted_at) continue

    const key = collisionKey(prompt.title)
    if (!byKey.has(key)) byKey.set(key, [])
    byKey.get(key).push({ id: prompt.id, title: prompt.title, updated_at: prompt.updated_at })
  }

  return byKey
}

// Which keywords the file needs, and which of them this collection has. A
// Markdown file carries names and no definitions, so the missing ones stay
// missing and are reported (17.2).
function keywordReport (record, pack) {
  const needed = [...new Set(pack.prompts.flatMap((entry) => entry.default_keywords ?? [])
    .map((name) => String(name).trim()).filter(Boolean))]
  const here = record.keywords.map((keyword) => keyword.name)
  const provided = pack.keywords.map((entry) => String(entry.name).trim())

  return {
    to_create: provided.filter((name) => !here.includes(name)).sort(),
    missing: needed.filter((name) => !here.includes(name) && !provided.includes(name)).sort(),
    conflicts: keywordConflicts(record, pack)
  }
}

// A keyword whose name is taken used to fall between the two lists above: not
// among the new ones, because it exists, and not among the missing ones,
// because the file provides it. The definition the file carried was dropped
// without a word. These are those.
//
// **Both texts travel, not a count.** A keyword has no revisions behind it, so
// overwriting one is final, and the decision belongs in sight of what it
// replaces.
function keywordConflicts (record, pack) {
  const here = new Map(record.keywords.map((keyword) => [keyword.name, keyword]))

  return pack.keywords.map((entry, index) => {
    const name = String(entry.name).trim()
    const row = here.get(name)
    if (!row) return null

    const incoming = Object.fromEntries(KEYWORD_FIELDS.map((field) => [field, entry[field] ?? null]))
    const existing = Object.fromEntries(KEYWORD_FIELDS.map((field) => [field, row[field] ?? null]))

    return {
      index,
      name,
      decisions: KEYWORD_DECISIONS,
      // Named rather than left to the screen to work out: an import of forty
      // keywords that changes none of them should not read as forty decisions
      // waiting to be made.
      identical: comparable(incoming) === comparable(existing),
      existing,
      incoming
    }
  }).filter(Boolean)
}

const comparable = (fields) => JSON.stringify(
  Object.fromEntries(KEYWORD_FIELDS.map((field) =>
    [field, fields[field] === null || fields[field] === undefined ? null : String(fields[field]).trim()])))

// --- deciding ---------------------------------------------------------------

// A collision with no decision is skipped, and an "overwrite" the preview did
// not offer is refused rather than quietly reinterpreted: the caller asked for
// something specific, and doing something else with their data is worse than
// refusing.
export function decisionFor (entry, decisions) {
  if (entry.state === 'new') return 'create'

  const choice = decisions?.[entry.index] ?? decisions?.[String(entry.index)] ?? null
  if (choice === null || choice === 'skip') return 'skip'

  if (!entry.decisions.includes(choice)) {
    throw new Refused('decision_not_available', { title: entry.title, decision: choice })
  }

  return choice
}

// The same rule for a keyword conflict, with the same default. Skipping stays
// the answer to a missing decision, and here that matters more: an overwrite
// cannot be taken back.
export function keywordDecisionFor (conflict, decisions) {
  const choice = decisions?.[conflict.index] ?? decisions?.[String(conflict.index)] ?? null
  if (choice === null || choice === 'skip') return 'skip'

  if (!conflict.decisions.includes(choice)) {
    throw new Refused('decision_not_available', { title: conflict.name, decision: choice })
  }

  return choice
}

// --- the Markdown export (FA-803, 17.2) -------------------------------------

// One file per prompt, named after the title. Deliberately **not** lossless: no
// timestamps, and keywords by name only. A caller who needs a complete move
// takes JSON, and the answer says so by simply not carrying the fields.
export function markdownFiles (record, { only = null } = {}) {
  const chosen = record.prompts
    .filter((prompt) => !prompt.deleted_at)
    .filter((prompt) => only === null || only.includes(prompt.id))
    .sort((one, other) => String(one.title).localeCompare(String(other.title), 'de'))

  const used = new Map()

  return chosen.map((prompt) => {
    const name = uniqueName(used, `${slug(prompt.title, 'prompt')}.md`)
    return { name, content: markdownDocument(prompt) }
  })
}

// The slug rule of 14.2, the same one the file name of a JSON export uses. Two
// prompts whose titles differ only in punctuation would otherwise overwrite
// each other on disk — which is why the counter below exists.
export function slug (text, fallback = 'promptatelier') {
  const folded = String(text ?? '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss')
    .replace(/ø/g, 'o').replace(/ł/g, 'l').replace(/đ/g, 'd')
    .replace(/æ/g, 'ae').replace(/œ/g, 'oe')
    .normalize('NFD').replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return folded === '' ? fallback : folded
}

function uniqueName (used, name) {
  const seen = (used.get(name) ?? 0) + 1
  used.set(name, seen)

  return seen === 1 ? name : `${name.replace(/\.md$/, '')}-${seen - 1}.md`
}

function markdownDocument (prompt) {
  const front = {
    title: prompt.title,
    description: prompt.description,
    visibility: prompt.visibility,
    status: prompt.status,
    model_hint: prompt.model_hint,
    tags: prompt.tags,
    default_keywords: (prompt.keywords ?? []).map((keyword) => keyword.name),
    variables: (prompt.variables ?? []).map((variable) => ({
      key: variable.key,
      label: variable.label,
      type: variable.type,
      default_value: variable.default_value,
      options: optionList(variable.options),
      required: variable.required
    }))
  }

  return `---\n${writeFrontmatter(front)}---\n\n${prompt.body}\n`
}

// --- the YAML subset --------------------------------------------------------
//
// Written out rather than pulled in, and the reason is `EN-04`: a library for
// this would be 40 kB in a bundle that is one file somebody sends by mail. What
// is needed is small and closed — strings, booleans, numbers, flat lists, and
// one list of maps for the variables.
//
// **The output has to be read by `YAML.safe_load` on the Ruby side**, which is
// why strings are double-quoted whenever they are not plainly safe. Quoting too
// much is ugly; quoting too little produces a file the other application
// refuses, and only for some titles.

const PLAIN = /^[A-Za-zÀ-ÿ][\w\-. äöüÄÖÜß]*$/u

function scalar (value) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'boolean') return String(value)
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '0'

  const text = String(value)
  // Plainly safe: starts with a letter, holds nothing that YAML reads as
  // structure, and does not end in a space. Everything else is quoted.
  if (PLAIN.test(text) && text === text.trim() && !/: |\s#/.test(text)) return text

  return `"${text.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '')}"`
}

function writeFrontmatter (front) {
  const lines = []

  for (const [key, value] of Object.entries(front)) {
    // A field that is absent is left out rather than written as null, which is
    // what `Transfer.markdown_document` does: `front.reject { |_, v| v.nil? }`.
    if (value === null || value === undefined) continue

    if (Array.isArray(value)) {
      if (value.length === 0) { lines.push(`${key}: []`); continue }

      lines.push(`${key}:`)
      for (const item of value) {
        if (item && typeof item === 'object') {
          const pairs = Object.entries(item).filter(([, one]) => one !== null && one !== undefined)
          if (pairs.length === 0) continue

          // The first pair carries the dash, the rest are indented under it.
          pairs.forEach(([name, one], at) => {
            const prefix = at === 0 ? '- ' : '  '
            if (Array.isArray(one)) {
              lines.push(`${prefix}${name}:`)
              for (const each of one) lines.push(`  - ${scalar(each)}`)
            } else {
              lines.push(`${prefix}${name}: ${scalar(one)}`)
            }
          })
        } else {
          lines.push(`- ${scalar(item)}`)
        }
      }
    } else {
      lines.push(`${key}: ${scalar(value)}`)
    }
  }

  return lines.join('\n') + '\n'
}

// Reading the same subset back. Only used by the Markdown **import**, which
// `EN-04` leaves out — kept because `parse` needs something to call and because
// the round-trip case in the bench uses it to prove the writer produces what a
// reader expects.
function readFrontmatter (text) {
  const data = {}
  let listKey = null
  let list = null
  let entry = null

  const finishEntry = () => { if (entry) { list.push(entry); entry = null } }
  const finishList = () => { if (listKey) { finishEntry(); data[listKey] = list; listKey = null; list = null } }

  for (const raw of text.split('\n')) {
    if (raw.trim() === '') continue

    const top = /^([A-Za-z_][\w]*):\s*(.*)$/.exec(raw)
    if (top && !raw.startsWith(' ') && !raw.startsWith('-')) {
      finishList()
      const [, key, rest] = top

      if (rest === '') { listKey = key; list = [] } else if (rest === '[]') data[key] = []
      else data[key] = unscalar(rest)
      continue
    }

    if (listKey === null) throw new Error(`unexpected line: ${raw.trim()}`)

    const item = /^-\s+(.*)$/.exec(raw.trim())
    const pair = /^([A-Za-z_][\w]*):\s*(.*)$/.exec(raw.trim().replace(/^-\s+/, ''))

    if (item && !pair) { finishEntry(); list.push(unscalar(item[1])); continue }

    if (raw.trim().startsWith('- ')) finishEntry()
    if (pair) {
      entry = entry ?? {}
      entry[pair[1]] = pair[2] === '' ? [] : unscalar(pair[2])
    }
  }

  finishList()
  return data
}

function unscalar (text) {
  const value = text.trim()
  if (value === 'true') return true
  if (value === 'false') return false
  if (value === 'null' || value === '~') return null
  if (/^-?\d+$/.test(value)) return Number(value)

  if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
    return value.slice(1, -1).replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\')
  }

  return value
}

// --- the JSON export --------------------------------------------------------

// Collection and day, so a folder of exports can be sorted and told apart.
export function exportFilename (pack, extension = 'json') {
  const day = String(pack.exported_at).slice(0, 10)
  return `${slug(pack.workspace?.name)}-${day}.${extension}`
}

export function exportPackage (record, { only = null } = {}) {
  if (only === null) return packageFrom(record)

  return packageFrom({
    ...record,
    prompts: record.prompts.filter((prompt) => only.includes(prompt.id))
  })
}
