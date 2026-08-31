// The shape of what is stored, and what happens when that shape changes.
//
// NFA-18 asks that an update never lose data, and that a backup is taken before
// the first write of a migration. The main application copies its database file
// for that. Here there is no file, so one is **made**: before a record of an
// older version is touched, an export is handed to the browser without asking.
// A migration that goes wrong is then a bad afternoon rather than a loss.
//
// Three cases on load, and the third is the one people forget:
//
//   same version    load it
//   older version   export first, then migrate, then load
//   newer version   **refuse**. An older build reading a newer record would
//                   drop the fields it does not know about, and dropping them
//                   silently is data loss with a friendly face.

import { collectionFrom } from '@/store/package'

// Raised when the shape changes in a way that older builds cannot read. There
// is no migration yet, and MIGRATIONS below is where the first one goes.
export const CURRENT_VERSION = 1

export class RecordTooNew extends Error {
  constructor (found) {
    super(`[nano] the stored collection is version ${found}, this build reads ${CURRENT_VERSION}`)
    this.name = 'RecordTooNew'
    this.found = found
  }
}

export function emptyRecord ({ name = 'Prompt Atelier Nano' } = {}) {
  return {
    version: CURRENT_VERSION,
    collection: { name },
    prompts: [],
    tags: [],
    keywords: [],
    favorites: [],
    // Counted rather than dated. "17 Änderungen seit der letzten Sicherung" is
    // a number that worries somebody; "zuletzt gesichert am 12." is a date they
    // read past (Datenaustausch.md, section 8).
    changesSinceExport: 0,
    exportedAt: null,
    savedAt: null,
    nextId: 1,

    // Whether the question about the examples has been put. Three states, and
    // the third is why this is not a boolean pair: `false` means "not asked
    // yet", `true` means "asked and answered", and it is stored so that the
    // answer survives a restart. Somebody who said "leer anfangen" must not be
    // asked again the next morning — a question that comes back is a question
    // that was not taken seriously.
    examplesOffered: false
  }
}

// The starting contents, **when they are asked for**.
//
// FA-909 has no counterpart here — there is no instance to set up. Until AP-N8
// the examples simply went in on the first run, noted in this place as a
// deviation to be removed on purpose. It is removed: `store/index.js` starts
// empty and `components/FirstRun.vue` puts the question.
//
// The reason is not tidiness. A collection that arrives holding fifty-five
// prompts somebody else wrote looks like the person's own collection from the
// second day on, and the ones they never wanted are indistinguishable from the
// ones they did.
export function seededRecord (examples, options = {}) {
  const record = emptyRecord(options)
  const { prompts, tags, keywords } = collectionFrom(examples, { workspaceId: 1, firstId: 1 })

  // The examples carry no timestamps — they are a hand-written seed package,
  // not an export of a running instance. A prompt in the collection must have
  // them all the same: the column is `NOT NULL` on the server, the library
  // sorts by them, and an export that writes `null` produces a file whose round
  // trip cannot come out identical. The import path stamps for exactly this
  // reason; seeding forgot to, and the round-trip case found it.
  const now = new Date().toISOString()
  for (const prompt of prompts) {
    prompt.created_at = prompt.created_at ?? now
    prompt.updated_at = prompt.updated_at ?? now
  }

  record.prompts = prompts
  record.tags = tags
  record.keywords = keywords
  record.nextId = prompts.length + 1
  record.examplesOffered = true

  return record
}

// The same contents, into a collection that already exists. Used when the
// question is answered with yes, which happens **after** the empty record has
// been written — the first run has to survive being closed before anybody
// answered anything.
export function withExamples (record, examples) {
  const seeded = seededRecord(examples, { name: record.collection.name })

  return {
    ...record,
    prompts: seeded.prompts,
    tags: seeded.tags,
    keywords: seeded.keywords,
    nextId: seeded.nextId,
    examplesOffered: true
  }
}

// --- reading what was stored ------------------------------------------------

const MIGRATIONS = {
  // 1: (record) => { …turn a version-1 record into a version-2 one… }
}

// Returns `{ record, migratedFrom }`. `migratedFrom` is null when nothing had
// to change, and the caller uses it to decide whether an export was owed.
export function adopt (parsed) {
  if (!parsed || typeof parsed !== 'object') return null

  const found = Number(parsed.version ?? 0)
  if (found > CURRENT_VERSION) throw new RecordTooNew(found)
  if (found === CURRENT_VERSION) return { record: complete(parsed), migratedFrom: null }

  let record = parsed
  for (let version = found; version < CURRENT_VERSION; version += 1) {
    const migrate = MIGRATIONS[version]
    if (!migrate) throw new Error(`[nano] no way from version ${version} to ${version + 1}`)
    record = migrate(record)
  }

  return { record: complete({ ...record, version: CURRENT_VERSION }), migratedFrom: found }
}

// Fills in what a record of the current version may still be missing. Not a
// migration: a field added without a version bump is a field that older records
// simply do not carry, and defaulting it here is cheaper than a version for
// every addition.
function complete (record) {
  const base = emptyRecord()
  return {
    ...base,
    ...record,
    collection: { ...base.collection, ...record.collection },
    prompts: record.prompts ?? [],
    tags: record.tags ?? [],
    keywords: record.keywords ?? [],
    favorites: record.favorites ?? []
  }
}

export const serialise = (record) => JSON.stringify(record)

export function parse (text) {
  if (typeof text !== 'string' || text.trim() === '') return null

  try {
    return JSON.parse(text)
  } catch {
    // A record that cannot be read is not the same as no record. Saying which
    // one it is decides whether the right answer is "start fresh" or "do not
    // touch anything until somebody has looked".
    throw new Error('[nano] the stored collection is not readable JSON')
  }
}
