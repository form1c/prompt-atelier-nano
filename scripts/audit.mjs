#!/usr/bin/env node

// Does the copy list hold what is needed, and only that? (AP-N0, carried into
// AP-N2 because it needs an entry point to walk from.)
//
// sync.mjs already proves that every listed file exists in Prompt Atelier. That
// is the easy half. The other half is the one that rots: a list of dependencies
// written by hand is a claim, and a claim about imports is wrong within a month.
//
// So this walks the `import` statements from the entry point outwards and
// answers two questions the list cannot answer about itself:
//
//   * **unresolved** — something is imported that lies in neither src/ nor
//     vendor/. The build would fail, but it would fail with a path nobody
//     recognises. Here it fails with the file that asked for it.
//   * **unreached** — something sits in vendor/ that nothing imports. Not an
//     error, but every unreached file is weight in the bundle and a shadow
//     nobody will remember to check. The list should shrink to what is used.
//
// Resolution follows the Vite alias exactly: `@/x` is src/x first, vendor/x
// second. If this and vite.config.js ever disagree, this file is the one that
// lies, so both read the same order from one place — see ROOTS below.

import { readFile, readdir, stat } from 'node:fs/promises'
import { dirname, join, resolve, relative, extname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))

// The lookup order, and the single place it is written down. src/ shadows
// vendor/; see documentation/Quelltextabgleich.md, section 3.
const ROOTS = [join(ROOT, 'src'), join(ROOT, 'vendor')]

// Extensions tried when an import carries none. Vue single file components
// first: `@/components/Icon` means Icon.vue far more often than Icon.js.
const EXTENSIONS = ['', '.vue', '.js', '.json', '/index.js', '/index.vue']

// Bare specifiers come from node_modules and are not this file's business.
const isBare = (specifier) => !specifier.startsWith('.') && !specifier.startsWith('@/')

// Read by the test suites, not by the application. Without this they would be
// reported as dead weight on every run, and a report that is always wrong in
// the same place is a report nobody reads.
const REACHED_BY_TESTS = ['vendor/vectors/rendering.json']

// Vite resolves this one itself, and it is how the five locales are pulled in.
// Without it every language file is reported as unreached — which is what the
// first run did, and it would have led to deleting four of them.
const GLOB = /\bimport\.meta\.glob\s*\(\s*['"]([^'"]+)['"]/g

// `import x from 'y'`, `import 'y'`, `export … from 'y'`, `import('y')`.
// A regex rather than a parser: the sources here are ordinary ES modules and a
// parser would be a dependency for a check that must never be the reason a
// build cannot run.
const IMPORTS = [
  /\bimport\s+[^'"]*?\bfrom\s*['"]([^'"]+)['"]/g,
  /\bimport\s*['"]([^'"]+)['"]/g,
  /\bexport\s+[^'"]*?\bfrom\s*['"]([^'"]+)['"]/g,
  /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g
]

async function isFile (path) {
  try { return (await stat(path)).isFile() } catch { return false }
}

async function walkDirectory (directory) {
  const found = []
  let entries
  try { entries = await readdir(directory, { withFileTypes: true }) } catch { return found }

  for (const entry of entries) {
    const path = join(directory, entry.name)
    found.push(...(entry.isDirectory() ? await walkDirectory(path) : [path]))
  }
  return found
}

// A specifier as seen from `origin`, turned into a file on disk, or null.
async function resolveSpecifier (specifier, origin) {
  const bases = specifier.startsWith('@/')
    ? ROOTS.map((root) => join(root, specifier.slice(2)))
    : [resolve(dirname(origin), specifier)]

  for (const base of bases) {
    for (const extension of EXTENSIONS) {
      const candidate = base + extension
      if (await isFile(candidate)) return candidate
    }
  }
  return null
}

// The files an `import.meta.glob` pattern stands for. Only `*` is supported,
// which is all this code base uses; anything fancier should fail loudly rather
// than be guessed at, so it simply matches nothing and shows up as unreached.
async function globbed (pattern, origin) {
  const base = resolve(dirname(origin), dirname(pattern))
  const rule = new RegExp('^' + pattern.split('/').pop().replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*') + '$')

  let entries
  try { entries = await readdir(base, { withFileTypes: true }) } catch { return [] }

  return entries.filter((entry) => entry.isFile() && rule.test(entry.name)).map((entry) => join(base, entry.name))
}

function globsIn (source) {
  return [...source.matchAll(new RegExp(GLOB.source, GLOB.flags))].map(([, pattern]) => pattern)
}

function specifiersIn (source) {
  const found = new Set()
  for (const pattern of IMPORTS) {
    for (const [, specifier] of source.matchAll(new RegExp(pattern.source, pattern.flags))) {
      found.add(specifier)
    }
  }
  return [...found]
}

// The entry point is itself subject to the shadow rule: Nano may replace
// main.js, and if it does, that copy is the one the build starts from.
async function entryPoint () {
  for (const root of ROOTS) {
    const candidate = join(root, 'main.js')
    if (await isFile(candidate)) return candidate
  }
  return null
}

export async function audit () {
  const entry = await entryPoint()
  if (!entry) return { skipped: 'no main.js in src/ or vendor/' }

  const reached = new Set()
  const unresolved = []
  const queue = [entry]

  while (queue.length > 0) {
    const path = queue.pop()
    if (reached.has(path)) continue
    reached.add(path)

    // Only source files carry imports. A .json that got here was imported by
    // somebody and counts as reached, but has nothing to contribute.
    if (!['.js', '.vue'].includes(extname(path))) continue

    const source = await readFile(path, 'utf8')

    for (const pattern of globsIn(source)) {
      const matches = await globbed(pattern, path)
      if (matches.length === 0) unresolved.push({ from: relative(ROOT, path), specifier: pattern })
      queue.push(...matches)
    }

    for (const specifier of specifiersIn(source)) {
      if (isBare(specifier)) continue

      const target = await resolveSpecifier(specifier, path)
      if (target) queue.push(target)
      else unresolved.push({ from: relative(ROOT, path), specifier })
    }
  }

  // A shadowed file is usually unreached: src/ answered instead. Reporting it
  // as dead weight would make the report wrong in exactly the cases where the
  // mechanism worked.
  //
  // **Shadowing is decided by the twin in src/, not by reachability**, and the
  // difference is not academic. `i18n/index.js` is shadowed by a wrapper that
  // imports the original by its path, so the original *is* reached — and a
  // count based on reachability said five shadows where there were six.
  const shadowed = []
  const unreached = []

  for (const path of await walkDirectory(join(ROOT, 'vendor'))) {
    const name = relative(ROOT, path)
    const twin = join(ROOT, 'src', relative(join(ROOT, 'vendor'), path))

    if (await isFile(twin)) { shadowed.push(name); continue }
    if (reached.has(path) || REACHED_BY_TESTS.includes(name)) continue

    unreached.push(name)
  }

  return {
    entry: relative(ROOT, entry),
    reached: [...reached].map((path) => relative(ROOT, path)),
    unresolved,
    unreached,
    shadowed
  }
}

// Run directly: report and set the exit code. Imported by sync.mjs: just the
// numbers, so that a sync says in one line whether the list still fits.
//
// pathToFileURL and not a template string: this project lives under a path
// containing a space, `import.meta.url` percent-encodes it and `process.argv[1]`
// does not, so the naive comparison is false and the report silently does not
// happen. Which is exactly what it did the first time it was run.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await audit()

  if (result.skipped) {
    console.log(`audit skipped: ${result.skipped}`)
    process.exitCode = 0
  } else {
    console.log(`entry: ${result.entry}`)
    console.log(`${result.reached.length} file(s) reachable from it, ${result.shadowed.length} shadowed`)

    for (const miss of result.unresolved) {
      console.log(`  UNRESOLVED  ${miss.specifier}`)
      console.log(`              imported by ${miss.from}`)
    }
    for (const path of result.unreached) console.log(`  unreached   ${path}`)

    if (result.unresolved.length === 0 && result.unreached.length === 0) {
      console.log('  the copy list is exactly what is imported')
    }

    // Unresolved is an error: the build cannot succeed. Unreached is a report:
    // the list carries weight nobody asked for, which is worth knowing and not
    // worth stopping for.
    process.exitCode = result.unresolved.length === 0 ? 0 : 1
  }
}
