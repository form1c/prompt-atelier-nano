// Shadows vendor/router/index.js — see documentation/Quelltextabgleich.md,
// section 3.
//
// Two differences, and both are forced rather than chosen.
//
// **Hash paths.** `createWebHistory` produces addresses like `/prompt/12`, and
// those need a server that maps every address onto index.html. Opened from a
// folder there is none, and `/prompt/12` is a file that does not exist. So the
// address reads `…/prompt-atelier.html#/prompt/12`, which a bookmark carries
// just as well.
//
// **No guards.** The original asks the server whether there is a session before
// every navigation, redirects to the sign-in screen, and remembers where the
// visitor was headed. None of that has a subject here: there is no server to
// ask and nobody to turn away.
//
// What is deliberately kept from the original: the order of the two `/prompt/`
// routes, and the catch-all. Both carry a reason that has nothing to do with
// sessions, and losing a reason by copying carelessly is how a fork starts.

import { createRouter, createWebHashHistory } from 'vue-router'
import LibraryView from '@/views/LibraryView.vue'
import PromptView from '@/views/PromptView.vue'
import PromptEditorView from '@/views/PromptEditorView.vue'
import PromptTransferView from '@/views/PromptTransferView.vue'
import KeywordsView from '@/views/KeywordsView.vue'
import TrashView from '@/views/TrashView.vue'
import TransferView from '@/views/TransferView.vue'

const routes = [
  { path: '/', name: 'library', component: LibraryView },
  // Before '/prompt/:id', or "new" would be read as an identifier and the
  // editor for a new prompt would be a request for the prompt named "new".
  { path: '/prompt/new', name: 'prompt-new', component: PromptEditorView },
  { path: '/prompt/:id', name: 'prompt', component: PromptView },
  { path: '/prompt/:id/edit', name: 'prompt-edit', component: PromptEditorView },
  { path: '/prompt/:id/duplicate', name: 'prompt-duplicate', component: PromptTransferView },
  { path: '/keywords', name: 'keywords', component: KeywordsView },
  { path: '/trash', name: 'trash', component: TrashView },
  { path: '/transfer', name: 'transfer', component: TransferView },
  // An unknown address is not an error worth a screen of its own in an
  // application this size — it leads to the library, which is where someone
  // who mistyped wanted to go.
  { path: '/:rest(.*)*', redirect: { name: 'library' } }
]

// `/prompt/:id/move` is absent, not forgotten: moving a prompt needs a second
// collection to move it to, and EN-03 settled that there is one.

export function createAppRouter (history = createWebHashHistory()) {
  return createRouter({ history, routes })
}
