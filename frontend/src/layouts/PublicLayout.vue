<script setup>
import { ref } from 'vue'
import AppLogo from '@/components/ui/AppLogo.vue'
import { useAuthStore } from '@/stores/auth'
import { usePrefsStore } from '@/stores/prefs'
import { config } from '@/app/config'

const auth = useAuthStore()
const prefs = usePrefsStore()
const menu = ref(false)
const year = new Date().getFullYear()
</script>

<template>
  <div class="pl">
    <header class="pl__head">
      <div class="pl__row">
        <AppLogo :to="{ name: 'home' }" />
        <nav class="pl__nav gt-sm">
          <router-link :to="{ name: 'home', hash: '#features' }">Возможности</router-link>
          <router-link :to="{ name: 'home', hash: '#how' }">Как это работает</router-link>
          <router-link :to="{ name: 'home', hash: '#faq' }">Вопросы</router-link>
          <router-link :to="{ name: 'help' }">Справка</router-link>
        </nav>
        <q-space />
        <q-btn
          flat
          round
          dense
          :icon="prefs.theme === 'dark' ? 'sym_r_light_mode' : 'sym_r_dark_mode'"
          class="text-muted gt-xs"
          :aria-label="prefs.theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'"
          @click="prefs.theme = prefs.theme === 'dark' ? 'light' : 'dark'"
        />
        <template v-if="auth.isAuthenticated && !auth.isGuest">
          <q-btn unelevated no-caps color="primary" icon-right="sym_r_arrow_forward" label="Мои древа" :to="{ name: 'dashboard' }" />
        </template>
        <template v-else>
          <q-btn flat no-caps label="Войти" :to="{ name: 'login' }" class="gt-xs" />
          <q-btn unelevated no-caps no-wrap color="primary" :label="$q.screen.lt.sm ? 'Начать' : 'Начать бесплатно'" :to="{ name: 'register' }" />
        </template>
        <q-btn flat round dense icon="sym_r_menu" class="lt-md" aria-label="Меню" @click="menu = !menu" />
      </div>
      <transition name="page">
        <nav v-if="menu" class="pl__mobile lt-md" @click="menu = false">
          <router-link :to="{ name: 'home', hash: '#features' }">Возможности</router-link>
          <router-link :to="{ name: 'home', hash: '#how' }">Как это работает</router-link>
          <router-link :to="{ name: 'home', hash: '#faq' }">Вопросы</router-link>
          <router-link :to="{ name: 'help' }">Справка</router-link>
          <router-link v-if="!auth.isAuthenticated || auth.isGuest" :to="{ name: 'login' }">Войти</router-link>
        </nav>
      </transition>
    </header>

    <main class="pl__main">
      <router-view v-slot="{ Component }">
        <transition name="page" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>

    <footer class="pl__foot">
      <div class="pl__foot-row">
        <div class="pl__foot-brand">
          <AppLogo :size="26" />
          <p class="text-muted">Семейное древо, которое остаётся с вами: работает в браузере и без интернета.</p>
        </div>
        <div class="pl__foot-cols">
          <div>
            <div class="ft-label q-mb-sm">Продукт</div>
            <router-link :to="{ name: 'home', hash: '#features' }">Возможности</router-link>
            <router-link :to="{ name: 'register' }">Регистрация</router-link>
            <router-link :to="{ name: 'login' }">Вход</router-link>
          </div>
          <div>
            <div class="ft-label q-mb-sm">Помощь</div>
            <router-link :to="{ name: 'help' }">Справка</router-link>
            <router-link :to="{ name: 'help', hash: '#import' }">Перенос из других программ</router-link>
            <a :href="`mailto:${config.supportEmail}`">Написать нам</a>
          </div>
          <div>
            <div class="ft-label q-mb-sm">Документы</div>
            <router-link :to="{ name: 'privacy' }">Конфиденциальность</router-link>
            <router-link :to="{ name: 'terms' }">Условия использования</router-link>
          </div>
        </div>
      </div>
      <div class="pl__copy text-faint">© {{ year }} Прапра · версия {{ config.version }}</div>
    </footer>
  </div>
</template>

<style scoped lang="scss">
.pl {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--ft-bg);
}
.pl__head {
  position: sticky;
  top: 0;
  z-index: 50;
  background: color-mix(in srgb, var(--ft-bg) 82%, transparent);
  backdrop-filter: saturate(1.4) blur(12px);
  border-bottom: 1px solid color-mix(in srgb, var(--ft-border) 70%, transparent);
}
.pl__row {
  max-width: 1200px;
  margin: 0 auto;
  height: 64px;
  padding: 0 20px;
  display: flex;
  align-items: center;
  gap: 10px;
}
.pl__nav {
  display: flex;
  gap: 4px;
  margin-left: 28px;
  a {
    padding: 6px 12px;
    border-radius: 8px;
    color: var(--ft-text-2);
    font-weight: 550;
    &:hover {
      background: var(--ft-surface-3);
      text-decoration: none;
    }
  }
}
.pl__mobile {
  display: flex;
  flex-direction: column;
  padding: 8px 16px 14px;
  a {
    padding: 10px 6px;
    color: var(--ft-text);
    font-weight: 550;
    border-bottom: 1px solid var(--ft-border);
  }
}
.pl__main {
  flex: 1;
}
.pl__foot {
  border-top: 1px solid var(--ft-border);
  background: var(--ft-surface-2);
  padding: 40px 20px 24px;
}
.pl__foot-row {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  gap: 40px;
  flex-wrap: wrap;
  justify-content: space-between;
}
.pl__foot-brand {
  max-width: 320px;
  p {
    margin: 12px 0 0;
  }
}
.pl__foot-cols {
  display: flex;
  gap: 56px;
  flex-wrap: wrap;
  > div {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  a {
    color: var(--ft-text-2);
  }
}
.pl__copy {
  max-width: 1200px;
  margin: 32px auto 0;
  font-size: 12.5px;
}
</style>
