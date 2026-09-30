<script setup>
import { onMounted, watch } from 'vue'
import { useQuasar } from 'quasar'
import { usePrefsStore } from '@/stores/prefs'
import { usePwaStore } from '@/stores/pwa'
import { useUiStore } from '@/stores/ui'
import UpdateBanner from '@/components/ui/UpdateBanner.vue'
import WhatsNewDialog from '@/components/dialogs/WhatsNewDialog.vue'
import LegalConsentDialog from '@/components/dialogs/LegalConsentDialog.vue'
import StorageNotice from '@/components/ui/StorageNotice.vue'

const $q = useQuasar()
const prefs = usePrefsStore()
const pwa = usePwaStore()
const ui = useUiStore()

watch(
  () => prefs.theme,
  (t) => {
    $q.dark.set(t === 'auto' ? 'auto' : t === 'dark')
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', $q.dark.isActive ? '#0F1216' : '#F6F4F0')
  },
  { immediate: true },
)
watch(
  () => $q.dark.isActive,
  (d) => document.querySelector('meta[name="theme-color"]')?.setAttribute('content', d ? '#0F1216' : '#F6F4F0'),
)

onMounted(() => {
  pwa.init()
  sessionStorage.removeItem('rd:chunk-reload')
  if (pwa.updatedFrom) ui.whatsNewOpen = true
  // Полноэкранный сплэш из index.html
  document.getElementById('boot')?.remove()
})
</script>

<template>
  <router-view v-slot="{ Component }">
    <component :is="Component" />
  </router-view>
  <UpdateBanner />
  <WhatsNewDialog />
  <LegalConsentDialog />
  <StorageNotice />
</template>
