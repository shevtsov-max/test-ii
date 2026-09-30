<script setup>
import { computed } from 'vue'
import { useTreeStore } from '@/stores/tree'
import { usePwaStore } from '@/stores/pwa'
import { api } from '@/api'

const tree = useTreeStore()
const pwa = usePwaStore()

const state = computed(() => {
  if (tree.readonly) return { icon: 'sym_r_visibility', text: 'Только просмотр', tone: 'muted' }
  switch (tree.saveState) {
    case 'pending':
    case 'saving':
      return { icon: 'sym_r_sync', text: 'Сохранение…', tone: 'muted', spin: true }
    case 'offline':
      return { icon: 'sym_r_cloud_off', text: 'Нет сети', tone: 'warning', tip: 'Изменения сохранены на устройстве и отправятся, когда появится интернет' }
    case 'error':
      return { icon: 'sym_r_error', text: 'Не сохранено', tone: 'negative', tip: tree.saveError }
    default:
      if (!pwa.online && api.mode === 'graphql') return { icon: 'sym_r_cloud_off', text: 'Офлайн', tone: 'warning' }
      return { icon: api.mode === 'local' ? 'sym_r_check_circle' : 'sym_r_cloud_done', text: 'Сохранено', tone: 'ok' }
  }
})
const tip = computed(() => {
  if (state.value.tip) return state.value.tip
  const at = tree.lastSavedAt ? new Date(tree.lastSavedAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : ''
  return api.mode === 'local' ? `Данные хранятся в этом браузере${at ? ` · сохранено в ${at}` : ''}` : `Синхронизировано с сервером${at ? ` в ${at}` : ''}`
})
</script>

<template>
  <div class="si" :class="`si--${state.tone}`" role="status">
    <q-icon :name="state.icon" size="16px" :class="{ 'si__spin': state.spin }" />
    <span class="si__text">{{ state.text }}</span>
    <q-tooltip>{{ tip }}</q-tooltip>
  </div>
</template>

<style scoped lang="scss">
.si {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12.5px;
  color: var(--ft-muted);
  padding: 4px 8px;
  border-radius: 8px;
  white-space: nowrap;
  cursor: default;
}
.si--ok .q-icon {
  color: var(--ft-positive);
}
.si--warning {
  color: var(--ft-warning);
  background: var(--ft-warning-soft);
}
.si--negative {
  color: var(--ft-negative);
  background: var(--ft-negative-soft);
}
.si__spin {
  animation: spin 1s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
@media (max-width: 760px) {
  .si__text {
    display: none;
  }
}
</style>
