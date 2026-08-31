// The collection, standing where Prompt Atelier has a session.
//
// **This is not a shadow.** `state/session.js` is not on the copy list, so
// nothing upstream corresponds to it and nothing can drift. It exists because
// six screens import `@/state/session` and none of them needs changing: they
// ask for the current workspace and get one, they ask who is signed in and the
// question simply never arises. Providing the module is one file; shadowing six
// screens would be six forks (RN-10).
//
// Nano has exactly one collection. It is not a workspace and is never called
// one in the interface (EN-03) — it carries a name for one purpose, which is
// the header of the export file and the name of the file itself
// (Datenaustausch.md, section 3.1). Everything else about it is here so that
// the screens above find the shape they expect.

import { reactive, computed } from 'vue'

// A fixed identifier, and the reason it is fixed rather than absent: the six
// screens send `workspace_id` with every call and watch it for changes. A null
// would make each of them treat the library as "no workspace chosen yet" and
// show an empty state forever. One collection, one number, and the local
// dispatcher ignores it.
export const COLLECTION_ID = 1

export const session = reactive({
  // 'ready' from the first line. There is nothing to load and nobody to ask,
  // and a status that is briefly 'unknown' would only give the screens a state
  // to render that can never be reached again.
  status: 'ready',

  // No account exists. The object is here because the shell reads a name from
  // it, and an empty name renders as nothing, which is correct: there is one
  // person and they know who they are.
  user: { name: '', is_instance_admin: false, must_change_password: false },

  workspaces: [
    {
      id: COLLECTION_ID,
      name: 'Prompt Atelier Nano',
      is_personal: false,
      role: 'owner',

      // The ten keys of `WORKSPACE_ACTIONS`, and four screens read them: the
      // trash, the keywords, and both directions of the transfer each hide
      // themselves when their key is not exactly `true`. Missing them is not
      // an error anywhere — it is four screens that quietly show nothing.
      //
      // Three are false because they have no subject rather than because
      // something is forbidden: there are no members to manage, no ownership
      // to grant, and deleting the one collection would leave none.
      permissions: {
        create: true,
        keywords: true,
        trash: true,
        purge: true,
        export: true,
        import: true,
        rename: true,
        members: false,
        grant_owner: false,
        delete: false
      }
    }
  ],

  selectedWorkspaceId: COLLECTION_ID,
  signed_out: false
})

export const selectedWorkspace = () => session.workspaces[0]

// Kept because LibraryView calls it. There is nothing to switch to, so it
// checks rather than assigns: a call with a different identifier means
// something upstream changed its mind about how many collections exist, and a
// silent no-op would hide that until somebody wondered why the library was
// empty.
export function selectWorkspace (id) {
  if (id !== undefined && id !== null && Number(id) !== COLLECTION_ID) {
    console.warn(`[nano] selectWorkspace(${id}): this build has one collection, id ${COLLECTION_ID}`)
  }
  return session.selectedWorkspaceId
}

// The name shown in the export file. Set from the local preferences in AP-N3;
// until then the default above stands.
export function renameCollection (name) {
  session.workspaces[0].name = String(name ?? '').trim() || 'Prompt Atelier Nano'
}

// Nothing signs in, so nothing can be signed in wrongly. Present because the
// router asks, and answering honestly is shorter than teaching the router not
// to.
export const isSignedIn = () => true

export const collectionName = computed(() => session.workspaces[0].name)
