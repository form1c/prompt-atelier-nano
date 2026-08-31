// Tier 1: a real file on the disk (Speicherkonzept.md, section 6).
//
// **This is a correction to the storage concept, and the reason is worth the
// paragraphs.** The concept lists tier 1 as another place the collection lies —
// tried first, and used instead of the tiers below. Building it that way turned
// out to be wrong in a way that only shows up at start-up:
//
//   * The measurement on the target machine (AP-N1, second run) says the stored
//     access survives a restart but its **permission** does not: `queryPermission`
//     answers `prompt`, and a browser only turns that into `granted` after a
//     click. So the file cannot be read before somebody has clicked.
//   * A store that cannot be read until somebody clicks cannot be the store the
//     application starts from. It would come up empty and fill in afterwards —
//     the one state Speicherkonzept.md calls the worst of them.
//   * And if the browser's storage is cleared (RN-01, the case tier 1 exists
//     for), the stored access goes with it, because it lives in IndexedDB. The
//     file has to be pointed at by hand again either way.
//
// So tier 1 here is **not a second store, it is a continuous backup**: on every
// change the collection is written into a file of the person's choosing, in the
// exchange format of chapter 17.1. Three things follow from that choice, and
// all three are gains:
//
//   1. The file is one Prompt Atelier can read. A backup only this build could
//      open would be a worse backup.
//   2. Reading it back is the import that already exists, with its preview, its
//      decisions and its all-or-nothing (SEC-12). No second path, no second set
//      of bugs.
//   3. The "17 ungesichert" count in the header stops being a nag, because it
//      is continuously untrue: there **is** a current backup, on the disk.
//
// What the file does not carry: the trash and the undo states. It is an export,
// and an export is the living collection (FA-804). Said out loud in the
// documentation, because somebody who restores from it will notice.

// Whether this browser has the door at all. Asked rather than tried, uniquely
// in this project — trying means opening a file chooser, and a chooser that
// appears because a program wanted to know something is a chooser nobody asked
// for. The trying happens on the click, which is the next function down.
export const available = () => typeof globalThis.showSaveFilePicker === 'function'

// Opens the chooser. **Must be called from a click**, or the browser refuses.
// Answers null when the person closed the dialogue, which is not a failure and
// must not be reported as one.
export async function pick (suggestedName = 'prompt-atelier.json') {
  if (!available()) return null

  try {
    return await globalThis.showSaveFilePicker({
      suggestedName,
      types: [{
        description: 'Prompt Atelier',
        accept: { 'application/json': ['.json'] }
      }]
    })
  } catch (error) {
    // `AbortError` is the person pressing cancel. Everything else is a refusal
    // by the browser and belongs to the caller.
    if (error?.name === 'AbortError') return null
    throw error
  }
}

// 'granted' | 'prompt' | 'denied'. An older engine without the two permission
// methods is treated as granted: it has no notion of withholding, so the write
// itself is the only thing that can answer, and it will.
export async function permissionOf (handle) {
  if (!handle?.queryPermission) return 'granted'

  try {
    return await handle.queryPermission({ mode: 'readwrite' })
  } catch {
    return 'denied'
  }
}

// **Must be called from a click.** Returns true when writing is allowed now.
export async function allow (handle) {
  if (!handle?.requestPermission) return true

  try {
    return await handle.requestPermission({ mode: 'readwrite' }) === 'granted'
  } catch {
    return false
  }
}

// Writes the whole file. `createWritable` truncates, so a shorter collection
// does not leave the tail of a longer one behind — which would produce a file
// that is valid JSON up to the point where it is not.
export async function writeText (handle, text) {
  const stream = await handle.createWritable()

  try {
    await stream.write(text)
  } finally {
    // In a `finally`, because an unclosed stream leaves a lock on the file that
    // outlives the failure and makes every later attempt fail too — the second
    // symptom would then hide the first.
    await stream.close()
  }
}

export async function readText (handle) {
  const file = await handle.getFile()

  return file.text()
}
