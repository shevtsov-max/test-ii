<script setup>
/** Вход через внешние сервисы. Показывается, только если сервер их поддерживает (VITE_OAUTH_PROVIDERS). */
import { api } from '@/api'
import { config } from '@/app/config'

const LABELS = { google: 'Google', vk: 'ВКонтакте', yandex: 'Яндекс ID', apple: 'Apple', mailru: 'Mail.ru' }
const providers = api.capabilities.oauth ? config.oauthProviders : []
const go = (p) => (location.href = api.auth.oauthUrl(p))
</script>

<template>
  <div v-if="providers.length" class="oa">
    <q-btn v-for="p in providers" :key="p" outline no-caps class="oa__btn" :label="`Войти через ${LABELS[p] ?? p}`" @click="go(p)" />
    <div class="oa__or"><span>или по почте</span></div>
  </div>
</template>

<style scoped lang="scss">
.oa {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 8px;
}
.oa__btn {
  height: 44px;
}
.oa__or {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 8px 0;
  color: var(--ft-muted);
  font-size: 12.5px;
  &::before,
  &::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--ft-border);
  }
}
</style>
