<script setup>
import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { api } from '@/api'

const auth = useAuthStore()
const hidden = ref(sessionStorage.getItem('rd:guest-banner') === '0')
function hide() {
  hidden.value = true
  sessionStorage.setItem('rd:guest-banner', '0')
}
</script>

<template>
  <div v-if="auth.isGuest && !hidden" class="gb">
    <q-icon name="sym_r_info" size="20px" class="gb__icon" />
    <div class="gb__text">
      <b>Гостевой режим.</b>
      {{ api.mode === 'local' ? 'Древа хранятся только в этом браузере.' : '' }}
      Создайте учётную запись — ваши древа перейдут в неё, и вы сможете вернуться к ним после выхода.
    </div>
    <q-btn unelevated dense no-caps color="primary" label="Создать учётную запись" :to="{ name: 'register' }" class="q-px-md" />
    <q-btn flat round dense icon="sym_r_close" size="sm" aria-label="Скрыть" @click="hide" />
  </div>
</template>

<style scoped lang="scss">
.gb {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px 10px 14px;
  border-radius: 14px;
  background: var(--ft-info-soft);
  border: 1px solid color-mix(in srgb, var(--ft-info) 25%, transparent);
  margin-bottom: 18px;
}
.gb__icon {
  color: var(--ft-info);
  flex: none;
}
.gb__text {
  flex: 1;
  font-size: 13.5px;
  color: var(--ft-text-2);
}
@media (max-width: 700px) {
  .gb {
    flex-wrap: wrap;
  }
}
</style>
