<script setup>
// Shadows vendor/App.vue — see documentation/Quelltextabgleich.md, section 3.
//
// The original carries three things above every screen: the screen, the short
// confirmations, and the overlay for an expired session. The third is dropped:
// no session can expire, and a dialog that can never open is a component that
// nobody maintains and everybody trusts.
//
// In its place, and for the same reason it is here rather than on a screen:
// the one question of the first run (AP-N8). It belongs above everything
// because it is about what everything below it will contain.
import NoticeHost from '@/components/NoticeHost.vue'
import FirstRun from '@/components/FirstRun.vue'
import { offeringExamples } from '@/store'
</script>

<template>
  <RouterView />
  <NoticeHost />
  <FirstRun v-if="offeringExamples" />
</template>
