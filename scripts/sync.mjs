#!/usr/bin/env node

// The one-way link to Prompt Atelier (documentation/Quelltextabgleich.md).
//
// This repository is a side branch. The main application is finished, accepted
// and in use, so the rule that shapes this file is not a preference:
//
//     Read the main application. Never write to it.
//
// There is no flag for the other direction and no code path that opens a file
// for writing outside this repository. That is the whole protection, and it is
// structural rather than conditional — a switch defaulting to off is a switch
// somebody turns on.
//
// What the copied files are worth depends on their staying identical. Two
// things would take that away, and both are guarded here:
//
//   * somebody edits a file in vendor/ — it is read-only, and a checksum
//     mismatch aborts the sync rather than overwriting the work in silence
//   * a shadowed file changes upstream — the shadow is a genuine fork of one
//     file, and the moment its origin moves is the moment somebody has to
//     decide whether to follow. Reported as an abort, not as a line of output
//     that scrolls past.
//
// Usage:
//   node scripts/sync.mjs                 sync, abort on either condition
//   node scripts/sync.mjs --accept-shadows  acknowledge upstream shadow changes
//   node scripts/sync.mjs --force         discard local edits in vendor/
//   node scripts/sync.mjs --check         report only, write nothing
//   node scripts/sync.mjs --quiet         only warnings and errors

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFile, writeFile, mkdir, chmod, unlink, readdir, stat } from 'node:fs/promises'
import { dirname, join, resolve, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const MANIFEST = join(ROOT, 'sync.manifest.json')
const VENDOR = join(ROOT, 'vendor')

// 0444: readable, never writable. The editor refuses before the developer
// does, which is one warning earlier than a checksum can manage.
const READ_ONLY = 0o444

const flags = new Set(process.argv.slice(2))
const accepting = flags.has('--accept-shadows')
const forcing = flags.has('--force')
const checking = flags.has('--check')
const quiet = flags.has('--quiet')

const say = (line = '') => { if (!quiet) console.log(line) }
const warn = (line) => console.error(line)

class Refused extends Error {}

// --- the steps -------------------------------------------------------------

// Step 1. Is the source there, and is all of it there? A missing file must not
// produce a half-filled vendor/ that looks like a successful sync.
async function locateSource (manifest) {
  const source = resolve(ROOT, manifest.source)

  if (!(await isDirectory(source))) {
    throw new Refused(
      `Source not found: ${source}\n` +
      `Adjust "source" in sync.manifest.json, or check out Prompt Atelier beside this repository.`
    )
  }

  const missing = []
  for (const entry of manifest.files) {
    if (!(await isFile(join(source, entry.from)))) missing.push(entry.from)
  }
  if (missing.length > 0) {
    throw new Refused(
      `${missing.length} file(s) on the copy list are missing from the source:\n` +
      missing.map((name) => `  ${name}`).join('\n') + '\n' +
      `Either the source moved on and the list is stale, or the checkout is incomplete.`
    )
  }

  return source
}

// Step 2. Has anybody worked in vendor/? Compared against the checksum written
// at the last sync, which is the content that was put there.
//
// The answer is an abort and not a warning. The edit is somebody's work, and
// overwriting it is exactly what this check exists to prevent. Where the change
// belongs instead — upstream, or into a shadow — is a decision, and a decision
// needs somebody awake.
async function findLocalEdits (manifest) {
  const edited = []

  for (const entry of manifest.files) {
    if (entry.sha256 === null) continue // never synced, nothing to compare
    const target = targetOf(entry)
    if (!(await isFile(target))) continue // gone; the copy below restores it

    if (await digestOf(target) !== entry.sha256) edited.push(entry.to)
  }

  return edited
}

// Step 3. Did the origin of a shadowed file move?
//
// For every other file a changed source is the normal case and the point of
// the exercise. For a shadow it is a fork whose origin drifted, and nobody
// finds out unless they are told here.
async function findShadowDrift (manifest, source) {
  const drifted = []

  for (const entry of manifest.files) {
    if (!entry.shadow || entry.sha256 === null) continue
    if (await digestOf(join(source, entry.from)) !== entry.sha256) drifted.push(entry)
  }

  return drifted
}

// Steps 4 and 5. Copy, then take the write permission away again.
//
// Read via readFile rather than copyFile: the existing target is read-only, and
// removing it first is both simpler and the only way to be sure no stale
// permission survives.
async function copyAll (manifest, source) {
  let copied = 0
  let changed = 0

  for (const entry of manifest.files) {
    const target = targetOf(entry)
    const content = await readFile(join(source, entry.from))
    const digest = digestOfBuffer(content)

    if (await isFile(target)) {
      if (await digestOf(target) === digest) {
        // **The mode is re-asserted even when the content is right.** It used to
        // be set only on the files this run wrote, which meant a copy whose
        // permissions had been changed by something else stayed writable for
        // ever — and the guard that rule 1 rests on stopped holding without a
        // word. It happened: 48 of 49 files were found writable, by something
        // outside these scripts, and only the test noticed.
        //
        // Cheap, idempotent, and it turns "read-only because we wrote it that
        // way once" into "read-only because every sync says so".
        await chmod(target, READ_ONLY)
        entry.sha256 = digest
        copied += 1
        continue
      }
      await unlink(target)
      changed += 1
    }

    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, content)
    await chmod(target, READ_ONLY)

    entry.sha256 = digest
    copied += 1
  }

  return { copied, changed }
}

// Anything in vendor/ that the list no longer mentions. Removing an entry from
// the list must remove the file too, or vendor/ slowly fills with things that
// nothing imports and nobody dares delete.
async function removeOrphans (manifest) {
  const wanted = new Set(manifest.files.map((entry) => resolve(targetOf(entry))))
  const orphans = []

  for (const found of await walk(VENDOR)) {
    if (wanted.has(resolve(found))) continue
    orphans.push(relative(ROOT, found))
    if (!checking) { await chmod(found, 0o644); await unlink(found) }
  }

  return orphans
}

// The version of the main application this copy was taken from. The checksums
// in the manifest are the actual evidence; this is the readable label beside
// them.
async function sourceVersion (source) {
  try {
    const text = await readFile(join(source, 'backend/version.rb'), 'utf8')
    return text.match(/VERSION\s*=\s*'([^']+)'/)?.[1] ?? null
  } catch {
    return null
  }
}

// And which commit of it. A version number names a release, a commit names one
// state of the source, and between two releases those are not the same thing.
//
// **Asked inside `source`, which is the repository itself.** Prompt Atelier's
// own build asked one directory above, in the working folder that is
// deliberately not a repository, and wrote `commit: unknown` into every archive
// it made, including ones built minutes after a commit. The mistake is cheap to
// repeat and was reported from a delivered archive, so the place is named here
// rather than assumed.
//
// `null` rather than a guess when there is no repository, no git, or no commit
// yet. A made-up commit is worse than none: it is the field somebody uses to
// find out which source a copy came from.
function sourceCommit (source) {
  const ask = (...args) => spawnSync('git', ['-C', source, ...args], { encoding: 'utf8' })

  const head = ask('rev-parse', '--short', 'HEAD')
  if (head.status !== 0 || !head.stdout?.trim()) return null

  const state = ask('status', '--porcelain')
  const dirty = state.status === 0 && state.stdout?.trim()

  return dirty ? `${head.stdout.trim()} (with uncommitted changes)` : head.stdout.trim()
}

// --- the run ---------------------------------------------------------------

async function main () {
  const manifest = JSON.parse(await readFile(MANIFEST, 'utf8'))
  const source = await locateSource(manifest)
  const shadows = manifest.files.filter((entry) => entry.shadow)

  const edited = await findLocalEdits(manifest)
  const drifted = await findShadowDrift(manifest, source)

  // --check answers about the whole state, not about the first thing wrong
  // with it. Stopping at the first refusal is right when something is about to
  // be written and wrong when somebody is asking what the situation is.
  if (checking) {
    say(`${manifest.files.length} files on the copy list, ${shadows.length} of them shadowed`)
    for (const name of edited) say(`  changed here:      vendor/${name}`)
    for (const entry of drifted) say(`  changed upstream:  ${entry.to}`)
    if (edited.length + drifted.length === 0) say('  in sync')

    return edited.length + drifted.length === 0 ? 0 : 1
  }

  if (edited.length > 0 && !forcing) {
    throw new Refused(
      `${edited.length} file(s) in vendor/ were changed here:\n` +
      edited.map((name) => `  vendor/${name}`).join('\n') + '\n\n' +
      `vendor/ is a copy, not a place to work. A fix belongs in Prompt Atelier itself,\n` +
      `so that both applications get it; a deliberate difference belongs in a shadow\n` +
      `file under src/ with the same path.\n\n` +
      `vendor/ is derived and ignored by git, so discarding it costs nothing:\n` +
      `  rm -rf vendor && npm run sync\n` +
      `Or run with --force to do the same in one step.`
    )
  }

  if (drifted.length > 0 && !accepting) {
    throw new Refused(
      `${drifted.length} shadowed file(s) changed upstream:\n` +
      drifted.map((entry) => `  ${entry.to}\n      ${entry.shadow}`).join('\n') + '\n\n' +
      `A shadow is a fork of one file. Compare vendor/<path> against src/<path> to see\n` +
      `what moved, carry over what applies, then run with --accept-shadows.`
    )
  }

  const { copied, changed } = await copyAll(manifest, source)
  const orphans = await removeOrphans(manifest)

  manifest.syncedAt = new Date().toISOString()
  manifest.sourceVersion = await sourceVersion(source)
  manifest.sourceCommit = sourceCommit(source)
  await writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`)

  say(`Prompt Atelier ${manifest.sourceVersion ?? 'unknown version'} from ${readablePath(source)}`)
  say(`  ${copied} files copied into vendor/, ${changed} of them changed since the last sync`)
  say(`  ${shadows.length} shadow file(s) tracked${drifted.length > 0 ? `, ${drifted.length} acknowledged now` : ''}`)
  if (orphans.length > 0) say(`  ${orphans.length} orphan(s) removed: ${orphans.join(', ')}`)
  if (forcing && edited.length > 0) warn(`  ${edited.length} local change(s) discarded (--force)`)

  return 0
}

// --- small helpers ---------------------------------------------------------

// Every write this script performs goes through here, which is why the bound
// is checked here and not trusted to the manifest. The manifest is versioned
// and reviewed, so a `"to": "../../elsewhere"` would be somebody's mistake
// rather than an attack — but "the script cannot write outside this repository"
// is a claim this project makes, and a claim held up by nobody having tried it
// is not held up at all.
function targetOf (entry) {
  const target = resolve(VENDOR, entry.to)
  if (target !== VENDOR && !target.startsWith(VENDOR + sep)) {
    throw new Refused(`Copy target leaves vendor/: "${entry.to}" in sync.manifest.json`)
  }
  return target
}

// `../../PromptStorage/project` reads better than the absolute path, and
// `../../../../../tmp/somewhere` reads worse. Whichever is shorter is the one
// a person can follow.
function readablePath (path) {
  const nearby = relative(ROOT, path)
  return nearby.length < path.length ? nearby : path
}

const digestOfBuffer = (buffer) => createHash('sha256').update(buffer).digest('hex')
const digestOf = async (path) => digestOfBuffer(await readFile(path))

async function isFile (path) {
  try { return (await stat(path)).isFile() } catch { return false }
}

async function isDirectory (path) {
  try { return (await stat(path)).isDirectory() } catch { return false }
}

async function walk (directory) {
  const found = []
  let entries
  try { entries = await readdir(directory, { withFileTypes: true }) } catch { return found }

  for (const entry of entries) {
    const path = join(directory, entry.name)
    found.push(...(entry.isDirectory() ? await walk(path) : [path]))
  }
  return found
}

try {
  process.exitCode = await main()
} catch (error) {
  warn(`\nsync refused.\n\n${error instanceof Refused ? error.message : error.stack}\n`)
  process.exitCode = 1
}
