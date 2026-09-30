<script setup>
/**
 * Уведомление о данных в браузере. Сайт не использует рекламные cookie и сторонние счётчики;
 * localStorage/IndexedDB нужны для работы (вход, настройки, офлайн-режим). Показывается один раз.
 */
import { ref } from 'vue'

const KEY = 'rd:cookie-notice'
const read = () => {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return '1'
  }
}
const visible = ref(!read())
function close() {
  visible.value = false
  try {
    localStorage.setItem(KEY, '1')
  } catch {
    /* ignore */
  }
}
</script>

<template>
  <transition name="sn">
    <div v-if="visible" class="sn no-print" role="status">
      <q-icon name="sym_r_cookie" size="20px" class="sn__icon" />
      <span>
        Браузер хранит только нужное для работы сайта — без рекламных cookie и счётчиков.
        <router-link :to="{ name: 'privacy' }">Подробнее</router-link>
      </span>
      <q-btn unelevated dense no-caps color="primary" label="Понятно" class="q-px-md" @click="close" />
    </div>
  </transition>
</template>

<style scoped lang="scss">
.sn {
  position: fixed;
  left: 16px;
  bottom: calc(16px + env(safe-area-inset-bottom));
  z-index: 6900;
  display: flex;
  align-items: center;
  gap: 12px;
  max-width: min(520px, calc(100vw - 32px));
  padding: 10px 10px 10px 14px;
  border-radius: 14px;
  background: var(--ft-surface);
  border: 1px solid var(--ft-border);
  box-shadow: var(--ft-shadow-lg);
  font-size: 12.5px;
  line-height: 1.45;
  color: var(--ft-text-2);
}
@media (max-width: 599px) {
  .sn {
    left: 8px;
    right: 8px;
    bottom: calc(8px + env(safe-area-inset-bottom));
    max-width: none;
    padding: 8px 8px 8px 12px;
  }
}
.sn__icon {
  color: var(--ft-primary-text);
  flex: none;
}
.sn-enter-active,
.sn-leave-active {
  transition:
    opacity 0.25s,
    transform 0.25s var(--ft-ease);
}
.sn-enter-from,
.sn-leave-to {
  opacity: 0;
  transform: translateY(12px);
}
</style>
