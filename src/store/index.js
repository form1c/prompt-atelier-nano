// The living collection: what is loaded, what is written back, and what the
// interface is told about both.
//
// The rule this module exists to serve is the one from Speicherkonzept.md,
// section 1, and it is the opposite of the main application's:
//
//   > The exported file is the truth. The browser's storage is the working copy.
//
// Three duties follow, and none of them is optional decoration:
//
//   1. **Say which tier was reached**, always, and say it loudest when it is
//      the one that forgets. An application that silently runs in memory looks
//      exactly like one that saves.
//   2. **Count the changes since the last export.** A number worries somebody
//      into acting; a date gets read past.
//   3. **Never lose what is there.** A migration exports first, a full disk is
//      reported rather than thrown, and a second window does not overwrite the
//      first.

import { reactive, computed } from 'vue'
import { openStorage, fillLevel, isQuotaError, TIERS, HANDLE_KEY } from '@/store/storage'
import { emptyRecord, withExamples, adopt, serialise, parse, RecordTooNew } from '@/store/record'
import { packageFrom } from '@/store/package'
import { sweep } from '@/store/retention'
import * as file from '@/store/file'
import { download, jsonDocument } from '@/util/download'
import examples from '@/examples/examples.json'

const CHANNEL = 'promptatelier.nano'

// How long a new window waits for an older one to answer. Long enough for a
// message to cross between two tabs of the same browser, short enough that
// nobody watches an empty screen for it.
const LISTEN = 400

export const state = reactive({
  ready: false,
  tier: null,
  rejected: [],
  fill: null,
  changes: 0,
  exportedAt: null,
  readOnly: false,
  problem: null,

  // What the clear-out removed at start-up, by name. The server writes this to
  // its log (FA-706); there is no log here, so it goes on the screen once and
  // the interface clears it after saying it.
  purged: [],

  // Whether the question about the examples has been answered (AP-N8). Kept
  // **here** and not read off the record, and the reason is a bug that cost a
  // test run: `record` is a plain object, so a computed over one of its fields
  // has nothing to depend on and never runs again. It answered `true` once and
  // the dialogue stayed on the screen after the button was pressed.
  examplesOffered: true,

  // Tier 1, the file on the disk. Four states, and `locked` is the interesting
  // one: the access is known, the permission is not — one click away, once per
  // session, exactly as measured in AP-N1.
  file: {
    available: false,
    name: null,
    status: 'off', // 'off' | 'ready' | 'locked' | 'failed'
    problem: null,
    writtenAt: null
  }
})

export const tierLabel = computed(() => TIERS[state.tier]?.label ?? 'storage.tier.unknown')
export const forgetful = computed(() => state.tier === 'memory')
export const nearlyFull = computed(() => state.fill !== null && state.fill >= 0.8)

// The header asks this rather than `state.changes` directly: with a file on the
// disk being written on every change, a count of unsaved changes is a warning
// about something that is not true.
export const backedUpToFile = computed(() => state.file.status === 'ready')

let storage = null
let record = emptyRecord()
let handle = null
const identity = Math.random().toString(36).slice(2, 10)

export const current = () => record

// --- starting up ------------------------------------------------------------

export async function start () {
  guardSecondWindow()

  // Wrapped, and the wrap ends with `ready` set no matter what. The interface
  // only speaks once it is ready; a start-up that fell over silently left the
  // header empty, and an application that says nothing about its storage looks
  // exactly like one that saves.
  try {
    storage = await openStorage()
  } catch (error) {
    console.error('[nano] no storage could be opened', error)
    storage = { name: 'memory', tier: 'memory', rejected: [], read: async () => null, write: async () => {}, clear: async () => {}, capacity: async (text) => ({ used: text.length, limit: null }) }
  }

  state.tier = storage.tier
  state.rejected = storage.rejected ?? []

  try {
    record = await load()
  } catch (error) {
    // A record that exists and cannot be used is the one case where starting
    // fresh would be the wrong kindness: it would replace something recoverable
    // with something empty. So the application comes up read-only and says why.
    state.problem = error instanceof RecordTooNew ? 'newer' : 'unreadable'
    state.readOnly = true
    record = emptyRecord()
  }

  await resumeFile()

  // FA-703, and the only place where content goes without anybody pressing
  // anything. After the load, so that a record this build refuses to read is
  // never swept — and not at all while read-only, for the same reason.
  //
  // Written back straight away rather than at the next change: a sweep that
  // only reaches the storage when the person happens to edit something would
  // report the same removals again on the next start.
  if (!state.readOnly) {
    const { removed } = sweep(record)
    state.purged = removed
    if (removed.length > 0) await write(record)
  }

  state.changes = record.changesSinceExport ?? 0
  state.exportedAt = record.exportedAt
  state.examplesOffered = record.examplesOffered === true
  state.fill = await fillLevel(storage, serialise(record))
  state.ready = true

  return record
}

async function load () {
  const stored = parse(await storage.read())

  if (stored === null) {
    // First run: **empty**, and the question comes afterwards (AP-N8). Written
    // straight away rather than after the answer, so that closing the window
    // without answering leaves a collection rather than nothing — the next
    // start then asks again, which is right, because nothing was decided.
    const fresh = emptyRecord()
    await write(fresh)
    return fresh
  }

  const { record: adopted, migratedFrom } = adopt(stored)

  if (migratedFrom !== null) {
    // NFA-18: a backup before the first write of a migration. There is no file
    // to copy, so one is made — and handed over without asking, because a
    // question here would be answered by somebody who does not yet know what
    // it is for.
    handOverBackup(adopted, `vor-migration-v${migratedFrom}`)
    await write(adopted)
  }

  return adopted
}

// --- writing ----------------------------------------------------------------

// Every change goes through here, and the counter goes up with it. `counts`
// is false for things that are not the user's content — the seed on the first
// run, and the stamp after an export.
export async function save ({ counts = true } = {}) {
  if (state.readOnly) return false

  if (counts) {
    record.changesSinceExport = (record.changesSinceExport ?? 0) + 1
    state.changes = record.changesSinceExport
  }

  return write(record)
}

async function write (next) {
  // The file first, because a successful write to it resets the counter that
  // the very next line serialises. The other order stores a count that is one
  // save out of date, and after a reload the header would nag about changes
  // that are demonstrably on the disk.
  await mirror(next)

  const text = serialise({ ...next, savedAt: new Date().toISOString() })

  try {
    await storage.write(text)
    state.fill = await fillLevel(storage, text)
    state.problem = null
    return true
  } catch (error) {
    // A full disk is a situation, not a crash. Reported so the interface can
    // say it, and the collection stays in memory meanwhile — which is exactly
    // the moment an export is worth more than anything else on the screen.
    state.problem = isQuotaError(error) ? 'full' : 'write_failed'
    return false
  }
}

// --- the examples, as an offer (AP-N8) --------------------------------------

// True while the question has not been answered. Asked once, ever: the answer
// is stored with the collection, so „leer anfangen" survives a restart. A
// question that comes back is a question that was not taken seriously.
//
// Not asked at all when the collection cannot be written — a decision that
// cannot be recorded would be put again tomorrow, and asking somebody
// something every morning is worse than deciding for them.
export const offeringExamples = computed(() =>
  state.ready && !state.readOnly && !state.examplesOffered)

export async function takeExamples () {
  record = withExamples(record, examples)
  state.examplesOffered = true
  // Not counted as a change: this is the starting position, not work. The
  // header would otherwise open on „55 ungesichert" before anything was done.
  await save({ counts: false })

  return record
}

export async function declineExamples () {
  record.examplesOffered = true
  state.examplesOffered = true
  await save({ counts: false })

  return record
}

// --- tier 1: the file on the disk -------------------------------------------
//
// See store/file.js for why this is a backup beside the storage rather than a
// tier above it. What is here is the part that touches the collection: picking
// up where the last session left off, the two actions that need a click, and
// the write that happens on every change.

// At start-up. Never asks for anything and never opens a dialogue: it looks up
// whether a file was chosen before and what the browser currently thinks of it.
async function resumeFile () {
  // Reset first. `start()` reloads everything, and a file state left over from
  // a previous run would be a claim about a handle this run has not seen.
  handle = null
  state.file.name = null
  state.file.status = 'off'
  state.file.problem = null
  state.file.available = file.available()

  if (!state.file.available || !storage.recall) return

  try {
    handle = await storage.recall(HANDLE_KEY)
  } catch {
    handle = null
  }
  if (!handle) return

  state.file.name = handle.name ?? null
  // 'prompt' is the normal state at the beginning of a session, measured on the
  // target machine. It is an offer, not a fault — the interface has to show it
  // as one (Speicherkonzept.md, section 6).
  state.file.status = await file.permissionOf(handle) === 'granted' ? 'ready' : 'locked'
}

// **From a click only.** Chooses the file and writes it at once, because a
// backup that is announced and then waits for the next change is a promise
// about a file that does not exist yet.
export async function chooseFile () {
  // Asked again rather than read off the flag: the flag is what the interface
  // draws, and a guard that trusts a value written at start-up is a guard about
  // the past.
  if (!file.available()) return false
  state.file.available = true

  let chosen = null
  try {
    chosen = await file.pick(exportName())
  } catch (error) {
    state.file.status = 'failed'
    state.file.problem = error?.message ?? String(error)
    return false
  }

  // Cancelled. Nothing changes, and nothing is reported: a person who closed a
  // dialogue does not need to be told what they just did.
  if (!chosen) return false

  handle = chosen
  state.file.name = chosen.name ?? null
  state.file.status = 'ready'
  state.file.problem = null

  try { await storage.remember?.(HANDLE_KEY, chosen) } catch { /* asked again next session */ }

  // Through the ordinary save, so that the file and the storage go through the
  // one path that keeps them consistent. Writing the file here directly and
  // saving afterwards would write it twice.
  await save({ counts: false })

  return state.file.status === 'ready'
}

// **From a click only.** The renewal of a permission the browser dropped when
// the session ended.
export async function unlockFile () {
  if (!handle) return false

  if (!await file.allow(handle)) {
    state.file.status = 'locked'
    return false
  }

  state.file.status = 'ready'
  state.file.problem = null

  await save({ counts: false })

  return state.file.status === 'ready'
}

// Stops writing to it. Needed because the alternative is a wrong file that
// cannot be got rid of — and because somebody who is about to hand the machine
// on should be able to cut the link without clearing the browser.
export async function releaseFile () {
  handle = null
  state.file.name = null
  state.file.status = 'off'
  state.file.problem = null
  state.file.writtenAt = null

  try { await storage.forget?.(HANDLE_KEY) } catch { /* gone or never there */ }
}

// The write itself. Answers whether it happened, and never throws: this is the
// second copy, and a second copy that takes the first one down with it is worse
// than no second copy at all.
//
// On success the change count goes to zero — the collection is on the disk, in
// the format the main application reads, which is the definition of secured
// this project uses (Datenaustausch.md, section 8).
async function mirror (next) {
  if (state.file.status !== 'ready' || !handle) return false
  // A second window must not write the file either. It holds the collection as
  // it was when it opened, and the file would come out older than the browser's
  // own copy — a backup that undoes work is the worst kind.
  if (state.readOnly) return false

  try {
    await file.writeText(handle, jsonDocument(packageFrom(next)))

    next.changesSinceExport = 0
    next.exportedAt = new Date().toISOString()
    state.changes = 0
    state.exportedAt = next.exportedAt
    state.file.writtenAt = next.exportedAt
    state.file.problem = null

    return true
  } catch (error) {
    // A revoked permission, a removed USB stick, a file somebody deleted. All
    // of them mean the same thing for the person: the backup they believe in is
    // not happening, and the count of unsaved changes has to start again.
    state.file.status = error?.name === 'NotAllowedError' ? 'locked' : 'failed'
    state.file.problem = error?.message ?? String(error)

    return false
  }
}

// --- the export, which is the actual backup ---------------------------------

export function handOverBackup (source = record, suffix = null) {
  const data = packageFrom(source)
  const day = data.exported_at.slice(0, 10)
  const slug = slugOf(source.collection.name)

  download(`${slug}-${day}${suffix ? `-${suffix}` : ''}.json`, jsonDocument(data))
  return data
}

// Marks the collection as saved. Separate from handing the file over, because
// the counter must only fall when the file really left — and because a
// migration backup is not the user saying "I have secured this".
export async function markExported () {
  record.changesSinceExport = 0
  record.exportedAt = new Date().toISOString()
  state.changes = 0
  state.exportedAt = record.exportedAt

  await save({ counts: false })
}

// The slug rule of 14.2, as far as a file name needs it. Not the full
// normalisation of FA-501 — that one belongs to the search and arrives with
// AP-N5; here a name only has to be a usable file name.
// What the file chooser offers as a name. Without a date, unlike the export:
// this one file is overwritten on every change, and a name carrying the day it
// was created would be wrong from the next morning on.
const exportName = () => `${slugOf(record.collection.name)}.json`

function slugOf (name) {
  return String(name ?? '')
    .toLowerCase()
    .replace(/[äàáâã]/g, 'a').replace(/[öòóô]/g, 'o').replace(/[üùúû]/g, 'u')
    .replace(/ß/g, 'ss').replace(/[éèêë]/g, 'e')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'prompt-atelier'
}

// --- two windows ------------------------------------------------------------

// RN-03. Two windows on one storage area overwrite each other and the loser
// notices nothing, which under file:// is easy to arrange: the file is opened
// a second time by double-clicking it again.
//
// The newcomer is the one that yields. It announces itself, and any window
// already open answers; an answer means somebody was here first.
function guardSecondWindow () {
  if (!globalThis.BroadcastChannel) return

  const channel = new BroadcastChannel(CHANNEL)

  channel.onmessage = (event) => {
    const message = event.data
    if (message?.from === identity) return

    if (message?.type === 'hello') channel.postMessage({ type: 'here', from: identity })
    if (message?.type === 'here') {
      state.readOnly = true
      state.problem = 'second_window'
    }
  }

  channel.postMessage({ type: 'hello', from: identity })
  setTimeout(() => { /* nobody answered; this window is the only one */ }, LISTEN)
}
