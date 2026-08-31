<script setup>
// Shadows vendor/components/AppShell.vue — see Quelltextabgleich.md, section 3.
//
// The most expensive shadow of the six, and the reason it is unavoidable: the
// header of the original carries a workspace switcher and a sign-out. Nano has
// one collection (EN-03) and nobody to sign out. A switcher over one entry is
// furniture, and a sign-out that signs nothing out is a lie on the screen.
//
// **The style block below is copied from the original without a single change**,
// and the sidebar is copied with it. Both had to be, because a scoped style
// only applies to the component it sits in — carrying the classes over without
// the rules would have produced an unstyled shell. That copy is exactly the
// drift RN-10 is about: when the original changes its layout, this file will
// not, and only the sync will say so.
//
// What is kept from the original for the reason the original gives:
//
//   * entries appear only once their route exists (`router.hasRoute`). With
//     Nano's router that removes the workspace and administration entries by
//     itself, without a second list to keep in step.
//   * `n` opens a new prompt, and only outside an input field.
//
// What is dropped: the workspace switcher, the account menu, and the
// `workspaceValue`/`allWorkspaces` properties that only a switcher would read.
// The properties stay declared — the screens still pass them, and a missing
// declaration would make Vue put them on the DOM element.
//
// **Upstream drift, acknowledged 2026-08-15.** Prompt Atelier added the version
// at the foot of its sidebar, next to the copy it already had in the account
// menu. The sync refused to run and named this file, which is what it is for.
// **Carried over as it stands**, placement included — see the note at `build`.

import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { t } from '@/i18n'
import { get } from '@/api/client'
import { notify } from '@/state/notices'
import Icon from '@/components/Icon.vue'
import {
  state as storage, forgetful, nearlyFull, tierLabel,
  chooseFile, unlockFile, releaseFile
} from '@/store'

const MAIN = [
  { route: 'library', label: 'shell.nav.library' },
  { route: 'favorites', label: 'shell.nav.favorites' },
  { route: 'recent', label: 'shell.nav.recent' }
]

const MANAGEMENT = [
  { route: 'keywords', label: 'shell.nav.keywords' },
  { route: 'transfer', label: 'shell.nav.transfer' },
  { route: 'trash', label: 'shell.nav.trash' }
]

// Accepted and ignored. The library passes both because it keeps the choice in
// the address (FA-506); here there is nothing to choose. Declaring them keeps
// them out of the rendered markup and keeps the screens unchanged.
defineProps({
  workspaceValue: { type: String, default: '' },
  allWorkspaces: { type: Boolean, default: false }
})

defineEmits(['choose-workspace'])

const router = useRouter()
const existing = (entries) => entries.filter((entry) => router.hasRoute(entry.route))

const canCreate = computed(() => router.hasRoute('prompt-new'))
const main = computed(() => existing(MAIN))
const management = computed(() => existing(MANAGEMENT))

// 11.6: `n` opens a new prompt, and single-key shortcuts only work outside an
// input field — inside one they would type their letter. It lives in the frame
// rather than on a screen because it works on all of them.
function onShortcut (event) {
  const inField = ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target?.tagName)
  if (event.key !== 'n' || inField || event.ctrlKey || event.metaKey || event.altKey) return
  if (!canCreate.value) return

  event.preventDefault()
  router.push({ name: 'prompt-new' })
}

onMounted(() => window.addEventListener('keydown', onShortcut))
onUnmounted(() => window.removeEventListener('keydown', onShortcut))

// What the header has to say about the storage, and why it is in the frame
// rather than on a settings screen (Speicherkonzept.md, section 5).
//
// Three of these are warnings and one is a count, and the count is the one that
// does the work: "17 Änderungen seit der letzten Sicherung" is a number that
// worries somebody into exporting. A date would be read past.
const banner = computed(() => {
  if (!storage.ready) return null
  if (storage.problem === 'second_window') return { kind: 'warn', text: t('storage.second_window') }
  if (storage.problem === 'newer') return { kind: 'warn', text: t('storage.newer') }
  if (storage.problem === 'unreadable') return { kind: 'warn', text: t('storage.unreadable') }
  if (storage.problem === 'full') return { kind: 'warn', text: t('storage.full') }
  // Tier 4 is a working state, not a fault — the application is complete in it
  // and simply cannot remember. It must say so without pause, or it looks
  // exactly like one that saves.
  if (forgetful.value) return { kind: 'warn', text: t('storage.memory_only') }
  if (nearlyFull.value) return { kind: 'warn', text: t('storage.nearly_full') }
  return null
})

// The count is hidden while a file on the disk is being written on every
// change: there is nothing unsaved then, and a nag about a thing that is
// demonstrably on the disk teaches people to ignore the header (AP-N7).
const unsaved = computed(() =>
  storage.ready && storage.changes > 0 && storage.file.status !== 'ready'
    ? storage.changes
    : null)

// --- tier 1, the file on the disk (AP-N7) ----------------------------------
//
// Three states reach the screen, and telling them apart is the whole point:
//
//   off     an offer, quiet, in the storage line. Not a warning — nothing is
//           wrong with a browser that stores in its own area.
//   locked  a **warning with a button**. The browser dropped the permission
//           when the session ended, which is its job (Speicherkonzept.md,
//           section 6), and until somebody presses the button no backup is
//           being written while the header says nothing is unsaved.
//   failed  a warning naming the reason. A removed stick, a deleted file.
//
// The storage line under the header is also where the reached tier is shown at
// all times. The concept puts that "in den Einstellungen"; there are none, and
// a fact nobody can read is not a fact — "meine Prompts sind weg" cannot be
// answered without it.

const busy = ref(false)

// --- which build this is ----------------------------------------------------
//
// Asked over `/version`, exactly as the original asks, because the original's
// reason holds here too: a bug report without a version costs a round trip every
// time. There is no server, so `api/client.js` answers from constants the build
// baked in.
//
// **At the foot of the sidebar, where the original puts it.** It sat in the
// storage line for one afternoon, and that was wrong: that line answers „wo
// liegen meine Daten", and a build number is a different kind of fact. Two
// unrelated things on one line make both of them harder to find.
//
// The known weakness comes with the placement: the library fills the same
// sidebar with the tag list, so with enough tags the version needs a scroll.
// Upstream answers that with a second copy in the account menu; Nano has no
// account menu and accepts the scroll. It is the same trade-off the original
// accepts for its primary placement, and Nano's sidebar is the shorter of the
// two — no workspace switcher, no administration section.
//
// **Only this build's own version is shown.** Where it came from is real and
// useful — forty-one of these files are copies — but two numbers side by side
// invite the question which one is "mine", and that question has no good answer
// on a screen. The provenance is one hover away, in `/version`, and in
// ABNAHME.txt beside the delivered file.
//
// Wrapped, and a failure leaves it null. A version is a comfort; a screen that
// refuses to draw because it could not learn one would be a fault.
const build = ref(null)

onMounted(async () => {
  try {
    build.value = await get('/version')
  } catch {
    build.value = null
  }
})

const fileBanner = computed(() => {
  if (!storage.ready || banner.value) return null
  if (storage.file.status === 'locked') {
    return { text: t('storage.file.locked', { name: storage.file.name ?? '' }), action: 'unlock' }
  }
  if (storage.file.status === 'failed') {
    return {
      text: t('storage.file.failed', {
        name: storage.file.name ?? '',
        reason: storage.file.problem ?? ''
      }),
      action: 'choose'
    }
  }
  return null
})

async function withBusy (run) {
  if (busy.value) return

  busy.value = true
  try { await run() } finally { busy.value = false }
}

const onChoose = () => withBusy(chooseFile)
const onUnlock = () => withBusy(unlockFile)
const onRelease = () => withBusy(async () => {
  await releaseFile()
  notify(t('storage.file.released'))
})
</script>

<template>
  <div class="shell">
    <header class="shell__header">
      <!-- „Prompt Atelier Nano", not „Prompt Atelier". The copied language files
           carry the name of the main application under `app.name` and must not
           be edited (RN-09), so the name of this build lives in Nano's own text
           table. It is a different application, and a header that claims
           otherwise sends somebody looking for functions that are not here. -->
      <p class="shell__brand">{{ t('nano.app.name') }}</p>

      <!-- The search field belongs to the screen, not to the frame: only the
           library knows what searching means there (11.2, 11.3). -->
      <div class="shell__search">
        <slot name="search" />
      </div>

      <!-- 11.2: making something new is reachable from every screen, not only
           from an empty library. -->
      <RouterLink v-if="canCreate" class="button shell__new" :to="{ name: 'prompt-new' }">
        <Icon name="plus-lg" /> <span class="shell__new-label">{{ t('shell.new_prompt') }}</span>
      </RouterLink>

      <!-- The count of unsaved changes sits beside the export, because that is
           the one thing to do about it (Datenaustausch.md, section 8). -->
      <RouterLink v-if="unsaved" class="button shell__save" :to="{ name: 'transfer' }">
        <Icon name="download" />
        <span class="shell__save-label">{{ t('storage.unsaved', { count: unsaved }) }}</span>
      </RouterLink>
    </header>

    <p v-if="banner" class="shell__banner" role="status">{{ banner.text }}</p>

    <p v-else-if="fileBanner" class="shell__banner" role="status">
      {{ fileBanner.text }}
      <button
        type="button"
        class="button button--quiet shell__banner-action"
        :disabled="busy"
        data-test="file-action"
        @click="fileBanner.action === 'unlock' ? onUnlock() : onChoose()"
      >
        {{ fileBanner.action === 'unlock' ? t('storage.file.unlock') : t('storage.file.retry') }}
      </button>
    </p>

    <!-- Where the collection lies, at all times, and the offer to put a second
         copy of it on the disk. Quiet on purpose: this is the state of things,
         not a message about it. -->
    <p v-if="storage.ready" class="shell__storage">
      <span>{{ t('storage.here', { tier: t(tierLabel) }) }}</span>

      <template v-if="storage.file.status === 'ready'">
        <span class="shell__storage-file">
          <Icon name="check-lg" /> {{ t('storage.file.ready', { name: storage.file.name ?? '' }) }}
        </span>
        <button
          type="button"
          class="shell__storage-link"
          :disabled="busy"
          data-test="file-release"
          @click="onRelease"
        >
          {{ t('storage.file.release') }}
        </button>
      </template>

      <button
        v-else-if="storage.file.available && storage.file.status === 'off'"
        type="button"
        class="shell__storage-link"
        :disabled="busy"
        data-test="file-choose"
        @click="onChoose"
      >
        {{ t('storage.file.offer') }}
      </button>
    </p>

    <div class="shell__body">
      <nav class="shell__sidebar">
        <ul class="nav">
          <li v-for="entry in main" :key="entry.route">
            <RouterLink :to="{ name: entry.route }">{{ t(entry.label) }}</RouterLink>
          </li>
        </ul>

        <slot name="sidebar" />

        <template v-if="management.length">
          <h2 class="nav__heading">{{ t('shell.sections.management') }}</h2>
          <ul class="nav">
            <li v-for="entry in management" :key="entry.route">
              <RouterLink :to="{ name: entry.route }">{{ t(entry.label) }}</RouterLink>
            </li>
          </ul>
        </template>

        <!-- **Only this application's own version is shown.** Two numbers side
             by side invite the question which of them is "mine", and the answer
             matters to nobody on the 364 days when nothing is wrong. Where this
             build came from sits in the title attribute, as every exact detail
             behind a short text does (TF-427) — and it is in `/version` and in
             ABNAHME.txt for the day somebody asks. -->
        <p
          v-if="build?.app"
          class="shell__version"
          :title="t('nano.app.origin', build)"
        >
          {{ t('shell.version', { version: build.app }) }}
        </p>
      </nav>

      <main class="shell__main">
        <slot />
      </main>
    </div>
  </div>
</template>

<style scoped>
.shell {
  display: flex;
  flex-direction: column;
  min-height: 100%;
}

.shell__banner {
  margin: 0;
  padding: 0.5rem 1rem;
  background: var(--warning-surface, #fcf3e2);
  color: var(--warning-text, #8a5a00);
  border-bottom: 1px solid var(--border);
  font-size: 0.9rem;
}

.shell__banner-action {
  margin-left: 0.5rem;
  vertical-align: baseline;
}

/* Set back, small, and never coloured: the tier is a fact about the machine,
   and dressing a fact as a warning spends the reader's attention on something
   that is not wrong. The warnings above have the colour. */
.shell__storage {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.25rem 0.75rem;
  margin: 0;
  padding: 0.3125rem 1rem;
  border-bottom: 1px solid var(--border);
  color: var(--muted);
  font-size: 0.8125rem;
}

.shell__storage-file {
  display: inline-flex;
  align-items: baseline;
  gap: 0.25rem;
}

.shell__storage-link {
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  text-decoration: underline;
  cursor: pointer;
}

.shell__storage-link:disabled {
  opacity: 0.5;
  cursor: default;
}

.shell__save {
  white-space: nowrap;
}

.shell__header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 1rem;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
}

.shell__brand {
  margin: 0;
  font-weight: 700;
}

.menu {
  position: relative;
}

.menu--end {
  margin-left: 0.5rem;
}

.shell__search {
  flex: 1;
  max-width: 32rem;
  margin-left: auto;
}

.shell__new {
  text-decoration: none;
}

/* Below the two-column threshold the label goes and the plus stays: the
   button keeps its meaning, the header keeps its room (11.6). */
@media (max-width: 599px) {
  .shell__new-label { display: none; }
}

.menu__divider {
  margin-top: 0.25rem;
  padding-top: 0.25rem;
  border-top: 1px solid var(--border);
}

.menu__list {
  position: absolute;
  z-index: 10;
  min-width: 12rem;
  margin: 0.25rem 0 0;
  padding: 0.25rem;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  box-shadow: var(--shadow);
  list-style: none;
}

.menu__list--end {
  right: 0;
}

.menu__item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.375rem 0.5rem;
  border: 0;
  border-radius: var(--radius);
  background: none;
  text-align: left;
  cursor: pointer;
}

.menu__item:hover { background: var(--surface-sunken); }
.menu__item[aria-current="true"] { font-weight: 600; }

.menu__note {
  margin-left: auto;
  color: var(--muted);
  font-size: 0.8125rem;
}

/* Small and set back: it says the button opens something, it is not part of
   what the button is called. */
.menu__caret {
  margin-left: 0.125rem;
  font-size: 0.75em;
  opacity: 0.7;
}

.shell__body {
  display: flex;
  flex: 1;
  align-items: stretch;
}

.shell__sidebar {
  flex: 0 0 14rem;
  padding: 1rem;
  border-right: 1px solid var(--border);
  background: var(--surface);
}

.nav {
  margin: 0 0 1rem;
  padding: 0;
  list-style: none;
}

.nav a {
  display: block;
  padding: 0.375rem 0.5rem;
  border-radius: var(--radius);
  color: var(--text);
  text-decoration: none;
}

.nav a:hover { background: var(--surface-sunken); }

.nav a.router-link-active {
  background: var(--surface-sunken);
  font-weight: 600;
}

.nav__heading {
  margin: 0 0 0.375rem;
  color: var(--muted);
  font-size: 0.75rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

/* Copied verbatim from the original, like every other rule in this block. */
.shell__version {
  margin: 1.5rem 0 0;
  color: var(--muted);
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
}

.menu__note {
  padding: 0.5rem 0.75rem 0.375rem;
  border-top: 1px solid var(--border);
  color: var(--muted);
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.shell__main {
  flex: 1;
  padding: 1.5rem;
}

/* Requirements 11.6: usable from 360 px. Below the two-column threshold the
   sidebar moves above the content instead of squeezing it. */
@media (max-width: 899px) {
  .shell__body { flex-direction: column; }

  .shell__sidebar {
    flex: 0 0 auto;
    border-right: 0;
    border-bottom: 1px solid var(--border);
  }
}
</style>
