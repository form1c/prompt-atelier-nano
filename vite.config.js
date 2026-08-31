import { fileURLToPath } from 'node:url'
import { statSync, readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve, join } from 'node:path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// The build (Architekturentwurf.md, section 6). Everything here exists because
// the result is opened from a folder rather than served, and `file://` refuses
// most of what a modern build takes for granted.
//
// The four decisions, each of which the application would otherwise fail on:
//
//   1. **A classic script, not a module.** Chromium and Firefox refuse a
//      `<script type="module">` under `file://` as a cross-origin request. So
//      the bundle is an IIFE, and the entry tag is rewritten to match.
//   2. **One file.** Anything loaded separately would be fetched, and `fetch`
//      on a neighbouring file is blocked too. Script and styles are folded
//      into the HTML.
//   3. **No dynamic imports left over.** `inlineDynamicImports` folds them in;
//      what remains would be a second file, which brings us back to 2.
//   4. **`@/x` resolves src/ before vendor/.** That is the shadow rule of
//      Quelltextabgleich.md, and it lives in a plugin because Vite's alias maps
//      one prefix to exactly one directory.

const HERE = fileURLToPath(new URL('.', import.meta.url))

// The lookup order, and the same one scripts/audit.mjs walks. If the two ever
// disagree the audit reports files the build cannot resolve, or misses ones it
// can — so the order is written the same way in both, and changing it in one
// place is meant to look wrong.
const ROOTS = ['src', 'vendor']
const EXTENSIONS = ['', '.vue', '.js', '.json', '/index.js', '/index.vue']

// A file, and not merely something that exists. With a bare `existsSync` the
// empty extension matched the **directory** `src/router`, and the build died
// trying to read it. The order of EXTENSIONS puts '' first on purpose, so this
// is the check that makes that order safe.
const isFile = (path) => { try { return statSync(path).isFile() } catch { return false } }

export function shadowedPaths () {
  return {
    name: 'nano-shadowed-paths',
    // Before Vite's own resolution, or its alias handling gets there first and
    // there is nothing left to decide.
    enforce: 'pre',
    resolveId (source) {
      if (!source.startsWith('@/')) return null

      const rest = source.slice(2)
      for (const root of ROOTS) {
        for (const extension of EXTENSIONS) {
          const candidate = resolve(HERE, join(root, rest + extension))
          if (isFile(candidate)) return candidate
        }
      }
      return null
    }
  }
}

// Folds the emitted script and stylesheet into the HTML and drops them as
// separate files.
//
// Deliberately not vite-plugin-singlefile: that one inlines the script as
// `type="module"`, which is exactly the thing that does not start from a
// folder. The rewrite to a classic tag is the whole point, so it is done here
// where it can be seen.
export function singleFile () {
  return {
    name: 'nano-single-file',
    enforce: 'post',
    generateBundle (options, bundle) {
      const page = Object.values(bundle).find((file) => file.fileName.endsWith('.html'))
      if (!page) return

      const scripts = Object.values(bundle).filter((file) => file.type === 'chunk')
      const styles = Object.values(bundle).filter((file) => file.fileName.endsWith('.css'))

      let html = page.source

      // The stylesheet first: it has to be in place before the script paints.
      for (const style of styles) {
        html = html.replace(
          new RegExp(`\\s*<link[^>]*href="[^"]*${escapeForRegExp(style.fileName)}"[^>]*>`),
          ''
        )
        html = insert(html, '</head>', `<style>\n${style.source}\n</style>\n`)
        delete bundle[style.fileName]
      }

      for (const script of scripts) {
        html = html.replace(
          new RegExp(`\\s*<script[^>]*src="[^"]*${escapeForRegExp(script.fileName)}"[^>]*>\\s*</script>`),
          ''
        )
        // No `type` attribute, and that is the load-bearing detail of this
        // whole file.
        html = insert(html, '</body>', `<script>\n${safeInScript(script.code)}\n</script>\n`)
        delete bundle[script.fileName]
      }

      // A module preload would point at a file that no longer exists.
      html = html.replace(/\s*<link[^>]+rel="modulepreload"[^>]*>/g, '')

      page.source = withPolicy(withIcon(html))
    }
  }
}

const escapeForRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Puts `content` in front of `marker`, and the reason it is a function and not
// a `replace` with a string:
//
// `String.replace` reads `$&`, `$1` and their kin **inside the replacement**.
// The Vue bundle contains `$&` — in `V===ms?void 0:$&V[0]===ms?…` — and with a
// plain string replacement that `$&` became the matched text, so the built file
// carried a literal `</body>` in the middle of its JavaScript. It built without
// a word of complaint and died in every browser with `Unexpected token '<'`.
//
// A replacement function is handed the match instead of interpreting the text,
// which is the only form that is safe for arbitrary content.
const insert = (html, marker, content) => html.replace(marker, () => content + marker)

// `</script` anywhere in the code would end the element early, whatever the
// JavaScript around it meant. Not currently present, and cheap enough to keep
// out for good: the sequence is invalid in JavaScript but valid inside a string
// literal, so one prompt containing it would be enough.
const safeInScript = (code) => code.replace(/<\/script/gi, '<\\/script')

// The icon of the browser tab.
//
// The main application serves `/favicon.ico` as a file. Here there is nothing to
// serve, so the icon travels inside the page as a data URI, like the fonts and
// the images of the interface.
//
// **32 by 32 pixels, and as PNG rather than as the shared `.ico`.** The shared
// icon carries nine sizes as uncompressed bitmaps and is 432 kB, which is more
// than this whole application. Embedded it would add about 190 kB to the
// compressed file and break the promise that the delivery stays under 300 kB.
// One frame as an optimised PNG costs 2.4 kB compressed.
//
// Injected here rather than written into index.html, because 3 kB of base64 in
// a source file is 3 kB of noise in every diff of that file. The development
// server therefore shows no icon, which is one more way in which it is not the
// build that ships.
function withIcon (html) {
  const icon = resolve(HERE, 'img/favicon.png')
  if (!isFile(icon)) return html

  const encoded = readFileSync(icon).toString('base64')
  const link = `<link rel="icon" type="image/png" sizes="32x32" href="data:image/png;base64,${encoded}">`

  return html.replace('</head>', () => `${link}\n</head>`)
}

// The decision behind EN-05.
//
// SEC-11 asks for a policy without `unsafe-inline`. A single file is nothing
// but inline, so the only way to keep that promise is to name each block by its
// hash — which a build can do and a person cannot, and which is the argument
// for doing it here rather than writing the deviation down.
//
// Everything else is shut off rather than left unmentioned, and each line is a
// claim the application already makes elsewhere:
//
//   connect-src 'none'  NFA-13: not one network request, ever. This is the
//                       line that turns that promise into something the
//                       browser enforces instead of something a test measures.
//   img-src data:       the icons are data URIs; no file is fetched.
//   object-src 'none'   nothing is embedded.
//   base-uri 'none'     an injected <base> could redirect every relative
//                       address. There are none here, and there should stay
//                       none.
//
// Applied as a <meta>, which only governs what follows it — so it sits at the
// top of the head, above the style and far above the script.
function withPolicy (html) {
  const hashes = (tag) => [...html.matchAll(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'g'))]
    .map(([, content]) => `'sha256-${createHash('sha256').update(content, 'utf8').digest('base64')}'`)
    .join(' ')

  const policy = [
    "default-src 'none'",
    `script-src ${hashes('script')}`,
    `style-src ${hashes('style')}`,
    "img-src data:",
    "font-src data:",
    "connect-src 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'"
  ].join('; ')

  return html.replace('<head>', () => `<head>\n<meta http-equiv="Content-Security-Policy" content="${policy}">`)
}

// What this build is, baked in at build time.
//
// Prompt Atelier answers `GET /version` from the running process. There is no
// process here, so the only moment the question can be answered is while the
// file is being made — and the answer travels inside it from then on.
//
// **Three values, not one, and the second is the one that earns its place.**
// Nano is not an application of its own: forty-one of its files are copies of
// Prompt Atelier's, and the rendering pipeline is one of them. „Der Prompt
// sieht falsch aus" is a question about *that* version, not about this one. The
// copy list already knows it — `sync.manifest.json` records which state was
// taken and when — so it costs nothing to carry along, and a bug report without
// it costs a round trip every time.
export function buildInfo () {
  const read = (path) => JSON.parse(readFileSync(resolve(HERE, path), 'utf8'))
  const manifest = read('sync.manifest.json')

  return {
    __NANO_BUILD__: JSON.stringify({
      app: read('package.json').version,
      source: manifest.sourceVersion ?? null,
      synced: (manifest.syncedAt ?? '').slice(0, 10) || null,
      built: new Date().toISOString().slice(0, 10)
    })
  }
}

export default defineConfig({
  root: HERE,
  plugins: [shadowedPaths(), vue(), singleFile()],
  define: buildInfo(),

  build: {
    outDir: resolve(HERE, 'dist'),
    emptyOutDir: true,

    // One stylesheet rather than one per screen: several would each be a file,
    // and files are what this build is trying not to have.
    cssCodeSplit: false,

    // Small assets become data URIs by themselves. The limit is raised so that
    // nothing slips out as a separate file unnoticed; anything above it would
    // break the single-file promise loudly rather than quietly.
    assetsInlineLimit: 1024 * 1024,

    rollupOptions: {
      output: {
        format: 'iife',
        inlineDynamicImports: true,
        entryFileNames: 'nano.js',
        assetFileNames: 'nano.[ext]'
      }
    }
  }
})
