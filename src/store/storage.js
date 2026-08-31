// Where the collection actually lies (Speicherkonzept.md, section 5).
//
// Four tiers, tried in order, and the one that answers is the one that is used.
// The whole module hands text in and takes text out — nothing above it knows
// which tier it reached, and the codec stays swappable for the day compression
// becomes worth its price (EN-06 says it is not).
//
// **Everything here is decided by trying, never by asking.** `'localStorage' in
// window` is true on a machine where every access throws, and a managed
// workstation is exactly where that happens. So each adapter writes a mark,
// reads it back, removes it, and only then claims to work.
//
// What this module deliberately does not do: promise anything. The browser may
// clear its storage without notice (RN-01), and no interface here can prevent
// it. That is why the export is the truth and this is the working copy.

const KEY = 'promptatelier.nano.record'
const DATABASE = 'promptatelier-nano'
const STORE = 'state'

// Where the chosen file's access is kept. Its own key beside the collection,
// never inside it: the collection is serialised to text and an access is not
// text — putting it there would turn it into `{}` on the way out.
export const HANDLE_KEY = 'promptatelier.nano.file'

// Measured in AP-N1 on four engines across two operating systems: 5.210.112
// characters, counted in characters rather than bytes. Used only to draw a fill
// level — the real limit is whatever the browser says when it refuses, and that
// refusal is handled where it happens.
const LOCALSTORAGE_LIMIT = 5_210_112

// A refusal from IndexedDB does not always arrive as an error. Under file://
// Chromium has been known to answer an `open` with silence, and an unguarded
// await on silence stops the application before it has drawn anything.
const PATIENCE = 5000

export const TIERS = {
  file: { rank: 1, label: 'storage.tier.file' },
  indexeddb: { rank: 2, label: 'storage.tier.indexeddb' },
  localstorage: { rank: 3, label: 'storage.tier.localstorage' },
  memory: { rank: 4, label: 'storage.tier.memory' }
}

// --- the adapters -----------------------------------------------------------

// Each one is `{ name, read, write, clear, capacity }` or null when it does not
// work here. `capacity` answers `{ used, limit }` in characters, with a null
// limit meaning "more than this application will ever ask for".

async function indexedDbAdapter () {
  if (!globalThis.indexedDB) return null

  const db = await open()
  if (!db) return null

  return {
    name: 'indexeddb',
    read: () => transact(db, 'readonly', (store) => store.get(KEY)),
    write: (text) => transact(db, 'readwrite', (store) => store.put(text, KEY)),
    clear: () => transact(db, 'readwrite', (store) => store.delete(KEY)),

    // Anything that is not the collection and is not a string. There is exactly
    // one such thing: the access to the file of tier 1, which is an object the
    // browser will only keep through its structured clone — and IndexedDB is
    // the only store in this list that takes one (Speicherkonzept.md, section
    // 6). The tiers below simply do not offer these, and a tier 1 without them
    // asks for the file once per session instead of once ever.
    remember: (name, value) => transact(db, 'readwrite', (store) => store.put(value, name)),
    recall: (name) => transact(db, 'readonly', (store) => store.get(name)),
    forget: (name) => transact(db, 'readwrite', (store) => store.delete(name)),
    capacity: async (text) => {
      // `estimate` reports the whole origin, not this record, so it answers the
      // question that matters: how much room is left, not how much we take.
      const room = await navigator.storage?.estimate?.().catch(() => null)
      return { used: text.length, limit: room?.quota ? null : null }
    }
  }

  function open () {
    return new Promise((resolve) => {
      let settled = false
      const finish = (value) => { if (!settled) { settled = true; resolve(value) } }
      setTimeout(() => finish(null), PATIENCE)

      let request
      try { request = indexedDB.open(DATABASE, 1) } catch { return finish(null) }

      request.onupgradeneeded = () => request.result.createObjectStore(STORE)
      request.onerror = () => finish(null)
      request.onblocked = () => finish(null)
      request.onsuccess = () => finish(request.result)
    })
  }

  function transact (handle, mode, run) {
    return new Promise((resolve, reject) => {
      let operation
      try {
        operation = run(handle.transaction(STORE, mode).objectStore(STORE))
      } catch (error) { return reject(error) }

      operation.onsuccess = () => resolve(operation.result ?? null)
      operation.onerror = () => reject(operation.error)
    })
  }
}

function localStorageAdapter () {
  // The access itself may throw. `globalThis.localStorage` is a getter, and a
  // policy that switches the storage off does it by making that getter raise —
  // so the plain existence check is the first thing to fall over. It did:
  // with both tiers disabled the whole start-up died here, the interface came
  // up with no tier and **no warning at all**, which is the one state
  // Speicherkonzept.md calls the worst of them.
  try {
    if (!globalThis.localStorage) return null
  } catch {
    return null
  }

  return {
    name: 'localstorage',
    read: async () => localStorage.getItem(KEY),
    write: async (text) => localStorage.setItem(KEY, text),
    clear: async () => localStorage.removeItem(KEY),
    capacity: async (text) => {
      // Everything under our own prefix, plus a rough allowance for what other
      // local files put in the same area. Under Chromium every file:// page
      // shares one bucket (RN-05), so "how full is it" is not a question about
      // this application alone.
      let used = 0
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index)
        used += (key?.length ?? 0) + (localStorage.getItem(key)?.length ?? 0)
      }
      return { used: Math.max(used, text.length), limit: LOCALSTORAGE_LIMIT }
    }
  }
}

// The last resort, and a working one: the application is complete in it, it
// simply cannot remember. Somebody who opens the file on a strange machine to
// assemble one prompt is served correctly here — as long as it says so, without
// pause, which is the caller's job.
function memoryAdapter () {
  let held = null

  return {
    name: 'memory',
    read: async () => held,
    write: async (text) => { held = text },
    clear: async () => { held = null },
    capacity: async (text) => ({ used: text.length, limit: null })
  }
}

// --- choosing one -----------------------------------------------------------

// Writes a mark, reads it back, removes it. An adapter that survives this is
// one that works; anything else is a claim.
async function works (adapter) {
  if (!adapter) return false

  const probe = `${KEY}.probe`
  try {
    const before = await adapter.read()
    await adapter.write(`probe-${Date.now()}`)
    const back = await adapter.read()
    // Put the real content back before judging, or a failed probe would be the
    // thing that lost the collection.
    if (before === null || before === undefined) await adapter.clear()
    else await adapter.write(before)

    return typeof back === 'string' && back.startsWith('probe-')
  } catch {
    return false
  } finally {
    try { globalThis.localStorage?.removeItem(probe) } catch { /* nothing owed */ }
  }
}

// The tier this browser actually grants, with the reason it stopped there.
//
// Tier 1, a real file on disk, is not in this list and does not belong in it.
// AP-N7 built it as a **continuous backup beside** these tiers rather than as a
// store above them, and `store/file.js` carries the reasoning: a file whose
// permission has to be renewed by a click once per session cannot be the place
// an application starts from. What remains here is its one dependency — the
// `remember`/`recall` pair above, which only tier 2 can offer.
export async function openStorage () {
  const rejected = []

  // Each one is built inside the loop and inside a guard. Building an adapter
  // is not supposed to be able to fail — and it did, which is why the guard is
  // here and not in a comment saying it cannot happen.
  const builders = [
    ['indexeddb', indexedDbAdapter],
    ['localstorage', localStorageAdapter],
    ['memory', memoryAdapter]
  ]

  for (const [name, build] of builders) {
    let adapter = null
    try { adapter = await build() } catch { adapter = null }

    if (await works(adapter)) return { ...adapter, tier: name, rejected }
    rejected.push(name)
  }

  // The memory adapter cannot fail, so this line is unreachable — and it
  // returns rather than throws, because the one thing this module must never do
  // is stop the application from starting. An application that runs and cannot
  // remember is usable; one that does not come up says nothing at all.
  return { ...memoryAdapter(), tier: 'memory', rejected }
}

// How full it is, as a number between 0 and 1, or null where the question does
// not arise. The interface warns from 0.8 upwards.
export async function fillLevel (storage, text) {
  const { used, limit } = await storage.capacity(text)
  return limit ? Math.min(used / limit, 1) : null
}

// True when a write failed for want of room rather than for any other reason.
// Browsers disagree on the name and on the code, so both are asked, and an
// unrecognised failure counts as "not a quota problem" — reporting a disk-full
// message for something else would send the reader after the wrong thing.
export function isQuotaError (error) {
  return error?.name === 'QuotaExceededError' ||
    error?.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    error?.code === 22
}
