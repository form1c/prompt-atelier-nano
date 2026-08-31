<script setup>
import { computed, onMounted, ref } from 'vue'
import { t } from '@/i18n'
import { get, post, del as remove, ApiError } from '@/api/client'
import { notify } from '@/state/notices'
import { formatTime, exactTime } from '@/util/time'
import { bulkRestore, bulkPurge } from '@/state/library'
import { createSelection, allSelected } from '@/util/selection'
import AppShell from '@/components/AppShell.vue'
import LoadingState from '@/components/LoadingState.vue'
import ErrorState from '@/components/ErrorState.vue'
import EmptyState from '@/components/EmptyState.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import SelectionBar from '@/components/SelectionBar.vue'
import Icon from '@/components/Icon.vue'

// Shadows vendor/views/TrashView.vue — see Quelltextabgleich.md, section 3.
//
// The seventh shadow, and the only one taken for the wording alone. Each line
// of the original says three things: when it was deleted, **who** deleted it,
// and which collection it came from. In a team the second is the one that
// matters — an administrator may bin somebody else's prompt and its owner has
// to be able to see who did. Here there is nobody to name and one collection to
// come from, so both were rendering as furniture: „gelöscht von unbekannt".
//
// Kept: the selection, both bulk actions, the two confirmations, and the rule
// that what may be done with a line comes from the line. None of that has
// anything to do with accounts, and copying it out would be a fork.
//
// **What is new, and it is not decoration.** The original never says when
// something will actually go, because on the server a job does it at some hour
// nobody sees. Here the clear-out happens at start-up (`store/retention.js`),
// which is close enough to the person for them to notice — so the line says
// „noch 12 Tage" and the removal stops being a surprise. FA-706 asks the server
// to log every run; this build has no log, so it says it on the screen instead.

const prompts = ref([])
const loading = ref(true)
const failure = ref(null)
const working = ref(false)
const doomed = ref(null)

// --- the selection (FA-510, FA-703a) --------------------------------------

const selection = createSelection()
const purgingSelection = ref(false)

const visibleIds = computed(() => prompts.value.map((prompt) => prompt.id))
const everyVisibleSelected = computed(() => allSelected(selection, visibleIds.value))

// **The bulk restore is the reason the bulk delete may exist at all** (FA-703a).
// Fifty prompts binned in one go and brought back one at a time would punish
// the person for using the feature — and a way back that is that tedious is a
// way back nobody takes.

// The trash is one list without paging, so there is no second "select all"
// here: what is on screen is everything there is.
function toggleVisible () {
  everyVisibleSelected.value ? selection.clear() : selection.selectVisible(visibleIds.value)
}

async function restoreSelection () {
  const report = await bulkRestore([...selection.state.ids])
  notify(t('trash.bulk_restored', { count: report.counts.done }))
  announceRefusals(report)
  selection.clear()
  load()
}

async function purgeSelection () {
  purgingSelection.value = false
  const report = await bulkPurge([...selection.state.ids])
  notify(t('trash.bulk_purged', { count: report.counts.done }))
  announceRefusals(report)
  selection.clear()
  load()
}

// Nothing can be forbidden here, so the only refusal left is the honest one —
// an identifier that is no longer there. The shape is kept all the same,
// because a shape that only exists in the good case is a shape nobody tests.
function announceRefusals (report) {
  if (report.counts.refused === 0) return

  const named = report.refused.filter((entry) => entry.title).map((entry) => entry.title)

  notify(named.length
    ? t('trash.bulk_refused', { names: named.join(', '), count: report.counts.refused })
    : t('trash.bulk_refused_unnamed', { count: report.counts.refused }))
}

onMounted(load)

async function load () {
  loading.value = true
  failure.value = null

  try {
    const payload = await get('/trash')
    prompts.value = payload.prompts ?? []
  } catch (problem) {
    if (!(problem instanceof ApiError)) throw problem

    failure.value = problem
  } finally {
    loading.value = false
  }
}

// The remaining days come from the dispatcher rather than being worked out
// here, so that the screen and the clear-out cannot disagree about the date a
// prompt goes. `null` means the stamp could not be read — the sweep leaves
// those alone, and the line has to say so rather than show a number.
function remaining (prompt) {
  const days = prompt.days_left

  if (days === null || days === undefined) return t('nano.trash.expiry_unknown')
  if (days <= 1) return t('nano.trash.expiry_today')

  return t('nano.trash.expiry', { days })
}

// FA-703: back with the metadata it had. Nothing is asked here — restoring is
// the reversible direction, and a confirmation for it would be a step in the
// way of the thing this screen is for (11.6).
async function restore (prompt) {
  if (working.value) return

  working.value = true

  try {
    await post(`/trash/${prompt.id}/restore`)
    notify(t('trash.restored', { title: prompt.title }))
    await load()
  } catch (problem) {
    if (!(problem instanceof ApiError)) throw problem

    failure.value = problem
  } finally {
    working.value = false
  }
}

// FA-704, and the one place on this screen where something goes for good.
async function confirmPurge () {
  if (working.value) return

  working.value = true
  const prompt = doomed.value

  try {
    await remove(`/trash/${prompt.id}`)
    notify(t('trash.purged', { title: prompt.title }))
    doomed.value = null
    await load()
  } catch (problem) {
    if (!(problem instanceof ApiError)) throw problem

    failure.value = problem
    doomed.value = null
  } finally {
    working.value = false
  }
}
</script>

<template>
  <AppShell>
    <h1>{{ t('trash.title') }}</h1>
    <p class="trash__intro">{{ t('trash.intro') }}</p>

    <ErrorState v-if="failure" :error="failure" :on-retry="load" />
    <LoadingState v-else-if="loading" :rows="4" />

    <section v-else-if="prompts.length" class="panel" aria-labelledby="trash-heading">
      <h2 id="trash-heading">{{ t('trash.heading', { count: prompts.length }) }}</h2>

      <label class="trash__select-all">
        <input
          type="checkbox"
          :checked="everyVisibleSelected"
          data-test="select-visible"
          @change="toggleVisible"
        >
        {{ t('selection.all_visible', { count: prompts.length }) }}
      </label>

      <SelectionBar
        v-if="!selection.empty.value"
        :count="selection.count.value"
        @clear="selection.clear()"
      >
        <button
          type="button"
          class="button button--quiet"
          data-test="bulk-restore"
          @click="restoreSelection"
        >
          <Icon name="arrow-counterclockwise" /> {{ t('trash.bulk_restore') }}
        </button>
        <button
          type="button"
          class="button button--quiet"
          data-test="bulk-purge"
          @click="purgingSelection = true"
        >
          <Icon name="trash" /> {{ t('trash.bulk_purge') }}
        </button>
      </SelectionBar>

      <ul class="entries">
        <li v-for="prompt in prompts" :key="prompt.id" class="entry">
          <label class="entry__select">
            <input
              type="checkbox"
              :checked="selection.has(prompt.id)"
              :aria-label="t('selection.for', { title: prompt.title })"
              @change="selection.toggle(prompt.id)"
            >
          </label>

          <span class="entry__name">{{ prompt.title }}</span>

          <!-- When it went, and when it goes. The exact instant sits in the
               title attribute, as everywhere else times are shown (TF-427). -->
          <span class="entry__detail" :title="exactTime(prompt.deleted_at)">
            {{ t('nano.trash.deleted', { when: formatTime(prompt.deleted_at) }) }}
            · <span class="trash__expiry">{{ remaining(prompt) }}</span>
          </span>

          <span class="entry__actions">
            <button
              v-if="prompt.permissions?.restore"
              type="button"
              class="button button--quiet"
              :aria-label="t('trash.restore_one', { title: prompt.title })"
              @click="restore(prompt)"
            >
              <Icon name="arrow-counterclockwise" /> {{ t('trash.restore') }}
            </button>

            <button
              v-if="prompt.permissions?.purge"
              type="button"
              class="button button--quiet"
              :aria-label="t('trash.purge_one', { title: prompt.title })"
              @click="doomed = prompt"
            >
              <Icon name="trash" /> {{ t('trash.purge') }}
            </button>
          </span>
        </li>
      </ul>
    </section>

    <EmptyState
      v-else
      :title="t('trash.empty_title')"
      :description="t('trash.empty_hint')"
    >
      <RouterLink class="button button--quiet" :to="{ name: 'library' }">
        {{ t('trash.to_library') }}
      </RouterLink>
    </EmptyState>

    <ConfirmDialog
      v-if="doomed"
      :title="t('trash.purge_title', { title: doomed.title })"
      :description="t('trash.purge_hint')"
      :confirm-label="t('trash.purge_confirm')"
      :danger="true"
      :busy="working"
      @confirm="confirmPurge"
      @cancel="doomed = null"
    />

    <!-- FA-703a: the only irreversible action of the application, and the only
         one that must never have a path without a question. The title carries
         the **number**, because "12 Prompts endgültig löschen" is the fact the
         person has to weigh — a list of twelve titles in a dialogue is read by
         nobody. -->
    <ConfirmDialog
      v-if="purgingSelection"
      :title="t('trash.bulk_purge_title', { count: selection.count.value })"
      :description="t('trash.bulk_purge_hint')"
      :confirm-label="t('trash.bulk_purge_confirm')"
      :danger="true"
      @confirm="purgeSelection"
      @cancel="purgingSelection = false"
    />
  </AppShell>
</template>

<style scoped>
.trash__intro {
  max-width: 46rem;
  color: var(--muted);
}

/* The one thing on the line that is about the future rather than the past. */
.trash__expiry {
  white-space: nowrap;
}
</style>
