<script setup>
import { useAuthStore } from '@/stores/auth'
import AppLogo from '@/components/ui/AppLogo.vue'

const auth = useAuthStore()
</script>

<template>
  <div class="nf">
    <AppLogo :to="{ name: 'home' }" class="nf__logo" />
    <div class="nf__card">
      <svg viewBox="0 0 220 120" class="nf__art" aria-hidden="true">
        <path d="M110 30v22M50 90V74a10 10 0 0 1 10-10h100a10 10 0 0 1 10 10v16" fill="none" stroke="var(--ft-line)" stroke-width="3" stroke-linecap="round" />
        <rect x="80" y="6" width="60" height="26" rx="8" fill="var(--ft-surface)" stroke="var(--ft-border-strong)" stroke-width="2" />
        <rect x="20" y="88" width="60" height="26" rx="8" fill="var(--ft-surface)" stroke="var(--ft-border-strong)" stroke-width="2" />
        <rect x="140" y="88" width="60" height="26" rx="8" fill="none" stroke="var(--ft-primary)" stroke-width="2" stroke-dasharray="5 5" />
        <text x="170" y="106" text-anchor="middle" font-size="15" font-weight="700" fill="var(--ft-primary)">?</text>
      </svg>
      <div class="ft-label">Ошибка 404</div>
      <h1 class="nf__title">Такой страницы нет в древе</h1>
      <p>Возможно, ссылка устарела или в адресе опечатка. Древо, персона или документ могли быть удалены.</p>
      <div class="nf__actions">
        <q-btn v-if="auth.isAuthenticated" unelevated no-caps color="primary" label="К моим древам" :to="{ name: 'dashboard' }" />
        <q-btn v-else unelevated no-caps color="primary" label="На главную" :to="{ name: 'home' }" />
        <q-btn flat no-caps label="Справка" :to="{ name: 'help' }" />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.nf {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 20px;
  background: var(--ft-bg);
  text-align: center;
}
.nf__logo {
  position: absolute;
  top: 24px;
  left: 24px;
}
.nf__card {
  max-width: 460px;
  p {
    color: var(--ft-text-2);
    line-height: 1.6;
  }
}
.nf__art {
  width: 220px;
  margin-bottom: 20px;
}
.nf__title {
  margin: 8px 0 10px;
  font-family: var(--ft-font-display);
  font-size: 30px;
  font-weight: 600;
}
.nf__actions {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-top: 20px;
}
</style>
