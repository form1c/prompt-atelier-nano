<script setup>
import { ref } from 'vue'
import { t } from '@/i18n'
import { takeExamples, declineExamples } from '@/store'

// The one question this application asks by itself, once, on the first run.
//
// **Nano-eigen, kein Schatten.** There is no counterpart upstream: Prompt
// Atelier sets an instance up with FA-909, over a screen, with an account and a
// name. Here there is nothing to set up — only one decision worth putting to
// somebody, and it is worth putting because of what the alternative does.
//
// Until AP-N8 the fifty-five examples went in unasked. That is comfortable on
// the first morning and wrong on the second: a collection that arrives holding
// prompts somebody else wrote looks like the person's own collection from then
// on, and the ones they never wanted are indistinguishable from the ones they
// did. Deleting fifty-five prompts one by one is not the way to fix that.
//
// **Not `ConfirmDialog`**, although the shape is the same and the component is
// right there. Its second button says „Abbrechen", and cancelling a question
// about examples reads as „not now, ask me later" — which is exactly what will
// not happen. Both answers here are answers, and both say what they do. That is
// the whole reason for sixty lines of their own.

const busy = ref(false)

async function answer (run, { reload = false } = {}) {
  if (busy.value) return

  busy.value = true
  // No `finally`: on success the component disappears with the state that
  // renders it, and re-enabling a button on a component that is going away is
  // a frame of flicker for nothing. A failure keeps it and re-enables.
  try {
    await run()
    if (reload) location.reload()
  } catch (error) {
    console.error('[nano] the first-run answer did not stick', error)
    busy.value = false
  }
}

// **Taking the examples reloads the page, and it has to.**
//
// The library asked for its prompts while this dialogue was going up and was
// answered "none". Putting fifty-five behind its back leaves it showing „Noch
// keine Prompts" over a full collection — which is what happened, and the
// acceptance run is what caught it.
//
// The alternative was to tell the library, and telling it means shadowing it:
// 639 lines forked so that one list refreshes once, ever. A reload of a single
// local file takes about a tenth of a second (NFA-03, measured) and re-reads
// everything from the storage, so there is no second path to keep in step.
//
// Declining changes nothing that is on the screen, so it does not reload.
const take = () => answer(takeExamples, { reload: true })
const decline = () => answer(declineExamples)
</script>

<template>
  <div class="firstrun" role="dialog" aria-modal="true" :aria-label="t('nano.firstrun.title')">
    <div class="firstrun__box">
      <h1 class="firstrun__title">{{ t('nano.firstrun.title') }}</h1>
      <p class="firstrun__lead">{{ t('nano.firstrun.lead') }}</p>

      <div class="firstrun__choices">
        <button
          type="button"
          class="button"
          :disabled="busy"
          data-test="take-examples"
          @click="take"
        >
          {{ t('nano.firstrun.take') }}
        </button>
        <button
          type="button"
          class="button button--quiet"
          :disabled="busy"
          data-test="decline-examples"
          @click="decline"
        >
          {{ t('nano.firstrun.decline') }}
        </button>
      </div>

      <p class="firstrun__note">{{ t('nano.firstrun.note') }}</p>
    </div>
  </div>
</template>

<style scoped>
/* Deliberately the same shape as ConfirmDialog, whose styles are scoped to
   itself and therefore cannot be borrowed. Copied rules, not copied code: the
   alternative was a ninth shadow for a wording. */
.firstrun {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgb(0 0 0 / 40%);
}

.firstrun__box {
  width: min(32rem, 100%);
  padding: 1.5rem;
  border-radius: var(--radius);
  background: var(--surface);
  box-shadow: var(--shadow);
}

.firstrun__title {
  margin: 0 0 0.5rem;
  font-size: 1.25rem;
}

.firstrun__lead {
  margin: 0 0 1.25rem;
  color: var(--muted);
}

.firstrun__choices {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.firstrun__note {
  margin: 1rem 0 0;
  color: var(--muted);
  font-size: 0.8125rem;
}
</style>
