<script setup>
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { t } from '@/i18n'
import { get, post, ApiError } from '@/api/client'
import { notify } from '@/state/notices'
import AppShell from '@/components/AppShell.vue'
import LoadingState from '@/components/LoadingState.vue'
import ErrorState from '@/components/ErrorState.vue'
import Icon from '@/components/Icon.vue'

// Shadows vendor/views/PromptTransferView.vue — see Quelltextabgleich.md,
// section 3.
//
// The original is one screen for two actions, because both ask the same
// question: **which workspace?** Duplicating puts a copy there, moving puts the
// prompt itself there. EN-03 answers that question once and for all — there is
// one collection — and the screen was left showing a chooser with a single
// entry above a heading reading „Ziel-Workspace", a word this build otherwise
// never uses.
//
// So the question goes and the confirmation stays. What is left is small, and
// it is deliberately not nothing: FA-204 says a copy is private and a draft,
// and TF-352 says it lands in the editor with its title selected. Somebody who
// picked „Duplizieren …" from a menu should be told what they are about to get
// before it appears under a name that is not a name.
//
// The move half is gone with the chooser. `/prompt/:id/move` is not a route in
// this build (router/index.js says so and says why), so the branch was already
// unreachable — and unreachable code that mentions a concept the project has
// ruled out is how the concept creeps back in.

const route = useRoute()
const router = useRouter()

const prompt = ref(null)
const loading = ref(true)
const working = ref(false)
const failure = ref(null)

onMounted(async () => {
  try {
    const payload = await get(`/prompts/${route.params.id}`)
    prompt.value = payload.prompt
  } catch (problem) {
    if (!(problem instanceof ApiError)) throw problem

    failure.value = problem
  } finally {
    loading.value = false
  }
})

async function confirm () {
  if (working.value) return

  working.value = true
  failure.value = null

  try {
    const payload = await post(`/prompts/${prompt.value.id}/duplicate`)

    notify(t('relocate.duplicated'))
    // TF-352: a copy lands in the editor with its title selected — "… (Kopie)"
    // is a placeholder, not a name.
    await router.replace({
      name: 'prompt-edit',
      params: { id: payload.prompt.id },
      query: { rename: '1' }
    })
  } catch (problem) {
    if (!(problem instanceof ApiError)) throw problem

    failure.value = problem
  } finally {
    working.value = false
  }
}

function cancel () {
  return router.back()
}
</script>

<template>
  <AppShell>
    <ErrorState v-if="failure && !prompt" :error="failure" />
    <LoadingState v-else-if="loading" :rows="3" />

    <section v-else class="transfer">
      <h1>{{ t('relocate.title_duplicate') }}</h1>
      <p class="transfer__subject">{{ prompt.title }}</p>

      <p v-if="failure" class="alert" role="alert">{{ failure.message }}</p>

      <!-- The two consequences nobody asked for and everybody has to know
           about (FA-204): the copy is a draft that only its owner sees, and it
           arrives carrying a title that has to be replaced. -->
      <p class="transfer__note">{{ t('nano.relocate.duplicate_hint') }}</p>

      <div class="transfer__actions">
        <button type="button" class="button button--quiet" @click="cancel">
          {{ t('relocate.cancel') }}
        </button>
        <button
          type="button"
          class="button"
          :disabled="working"
          data-test="confirm"
          @click="confirm"
        >
          <Icon name="files" /> {{ t('relocate.confirm_duplicate') }}
        </button>
      </div>
    </section>
  </AppShell>
</template>

<style scoped>
.transfer {
  max-width: 34rem;
}

.transfer__subject {
  margin-bottom: 1rem;
  color: var(--muted);
}

.transfer__note {
  margin: 0 0 1rem;
  padding: 0.75rem;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface-sunken);
  color: var(--muted);
}

.transfer__actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}
</style>
