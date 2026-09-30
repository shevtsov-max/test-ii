<script setup>
import { ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import { usePwaStore } from '@/stores/pwa'
import { useTreeStore } from '@/stores/tree'

const $q = useQuasar()
const pwa = usePwaStore()
const tree = useTreeStore()
const hidden = ref(false)
const updating = ref(false)

watch(
  () => pwa.offlineReady,
  (v) => v && $q.notify({ icon: 'sym_r_offline_pin', message: 'Приложение готово к работе без интернета', timeout: 4000 }),
)
watch(
  () => pwa.needRefresh,
  (v) => v && (hidden.value = false),
)

async function update() {
  updating.value = true
  // Сначала сохраняем несохранённые изменения древа
  await pwa.applyUpdate(() => tree.flush())
}
</script>

<template>
  <transition name="ub">
    <div v-if="pwa.needRefresh && !hidden" class="ub no-print" role="status">
      <div class="ub__icon"><q-icon name="sym_r_system_update_alt" size="20px" /></div>
      <div class="ub__text">
        <b>Доступна новая версия</b>
        <span>Обновление займёт пару секунд, данные сохранятся.</span>
      </div>
      <q-btn flat dense no-caps label="Позже" class="ub__later" @click="hidden = true" />
      <q-btn unelevated dense no-caps color="primary" label="Обновить" class="q-px-md" :loading="updating" @click="update" />
    </div>
  </transition>
</template>

<style scoped lang="scss">
.ub {
  position: fixed;
  left: 50%;
  bottom: calc(18px + env(safe-area-inset-bottom));
  transform: translateX(-50%);
  z-index: 7000;
  display: flex;
  align-items: center;
  gap: 12px;
  width: max-content;
  max-width: calc(100vw - 24px);
  padding: 10px 10px 10px 12px;
  border-radius: 16px;
  background: #1f242d;
  color: #fff;
  box-shadow: var(--ft-shadow-lg);
}
.ub__icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  background: rgba(255, 255, 255, 0.1);
  flex: none;
}
.ub__text {
  display: flex;
  flex-direction: column;
  line-height: 1.3;
  font-size: 13px;
  span {
    opacity: 0.7;
  }
}
.ub__later {
  color: rgba(255, 255, 255, 0.8);
}
@media (max-width: 520px) {
  .ub__text span {
    display: none;
  }
}
.ub-enter-active,
.ub-leave-active {
  transition:
    opacity 0.25s,
    transform 0.25s var(--ft-ease);
}
.ub-enter-from,
.ub-leave-to {
  opacity: 0;
  transform: translate(-50%, 16px);
}
</style>
