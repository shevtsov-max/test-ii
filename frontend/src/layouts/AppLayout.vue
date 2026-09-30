<script setup>
import AppLogo from '@/components/ui/AppLogo.vue'
import UserMenu from '@/components/ui/UserMenu.vue'
import ShortcutsDialog from '@/components/dialogs/ShortcutsDialog.vue'
</script>

<template>
  <div class="apl">
    <header class="apl__head">
      <div class="apl__row">
        <AppLogo :to="{ name: 'dashboard' }" />
        <nav class="apl__nav">
          <router-link :to="{ name: 'dashboard' }" exact-active-class="active">Мои древа</router-link>
          <router-link :to="{ name: 'help' }">Справка</router-link>
        </nav>
        <q-space />
        <UserMenu />
      </div>
    </header>
    <main class="apl__main">
      <router-view v-slot="{ Component }">
        <transition name="page" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>
    <ShortcutsDialog />
  </div>
</template>

<style scoped lang="scss">
.apl {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
.apl__head {
  position: sticky;
  top: 0;
  z-index: 50;
  background: color-mix(in srgb, var(--ft-bg) 85%, transparent);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--ft-border);
}
.apl__row {
  max-width: 1320px;
  margin: 0 auto;
  height: 60px;
  padding: 0 24px;
  display: flex;
  align-items: center;
  gap: 12px;
}
.apl__nav {
  display: flex;
  gap: 2px;
  margin-left: 24px;
  a {
    padding: 6px 12px;
    border-radius: 8px;
    color: var(--ft-muted);
    font-weight: 600;
    &:hover {
      color: var(--ft-text);
      text-decoration: none;
      background: var(--ft-surface-3);
    }
    &.active {
      color: var(--ft-text);
      background: var(--ft-surface-3);
    }
  }
}
.apl__main {
  flex: 1;
}
@media (max-width: 600px) {
  .apl__row {
    padding: 0 12px;
  }
  .apl__nav {
    margin-left: 8px;
  }
}
</style>
