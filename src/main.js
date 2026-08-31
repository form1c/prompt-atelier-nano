// Shadows vendor/main.js — see documentation/Quelltextabgleich.md, section 3.
//
// What the original does and this does not: install the handler for an expired
// session, and re-ask the server after the browser restored a page from its
// cache. Both are about a session, and there is none.
//
// This file will keep diverging rather than converge: AP-N3 puts the storage
// layer's self-check here, because the first thing the application must know is
// which storage tier it actually reached (Speicherkonzept.md, section 5), and
// that has to be settled before the first screen asks for anything.

import { createApp } from 'vue'
import App from '@/App.vue'
import { createAppRouter } from '@/router'
import { setLanguage, t } from '@/i18n'
import { start, state as storage } from '@/store'
import { notify } from '@/state/notices'
import '@/styles/base.css'

// FA-706 asks the server to write a line per clear-out run, because "ein Lauf,
// der nichts meldet, ist von einem, der nicht stattgefunden hat, nicht zu
// unterscheiden". There is no log here, so the line goes on the screen — once,
// after the first screen is up, and long enough to be read.
//
// Six seconds rather than the usual two: this is the only notice in the
// application that reports something *irreversible* which nobody asked for.
const SWEPT_MILLISECONDS = 6000

function announceSweep () {
  const gone = storage.purged ?? []
  if (gone.length === 0) return

  notify(gone.length === 1
    ? t('nano.trash.swept_one', { title: gone[0].title })
    : t('nano.trash.swept', { count: gone.length }), { milliseconds: SWEPT_MILLISECONDS })

  storage.purged = []
}

// FA-912 asks for profile, then config.yml, then Accept-Language, then English.
// Two of those four need a server. What is left is the browser's own setting,
// and it is asked here rather than in a screen because the first thing drawn
// must already be in the right language — a library that appears in English and
// turns German a moment later looks like a fault.
//
// The local preference goes in front of this in AP-N3, once there is somewhere
// to keep it.
//
// Awaited before mounting, and that await is also the proof that the language
// files really are inside this one file: they are pulled in by
// `import.meta.glob`, which normally leaves each of them as a separate chunk to
// be fetched. Under file:// a fetch of a neighbouring file is refused, so if
// this build had left them outside, the switch would fail here and now instead
// of silently doing nothing later.
// The order is the point: language, then storage, then the first screen.
//
// Storage before mounting, and not in a component, because the first thing the
// library does is ask for prompts. Mounted first, it would ask an empty
// collection, draw "nothing here yet", and fill in a moment later — which on a
// slow machine is indistinguishable from having lost everything.
//
// Neither step may stop the start. A browser that refuses every kind of storage
// still gets an application; it gets one that says it cannot remember
// (Speicherkonzept.md, section 5, tier 4).
async function begin () {
  try {
    await setLanguage(navigator.language ?? 'en')
  } catch { /* the base language is already loaded */ }

  try {
    await start()
  } catch (error) {
    console.error('[nano] storage did not come up', error)
  }

  createApp(App).use(createAppRouter()).mount('#app')

  // After the mount, not before: a notice pushed into the list while nothing
  // renders it is a notice that has already expired by the time anything does.
  announceSweep()
}

begin()
