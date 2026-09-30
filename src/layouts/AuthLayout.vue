<script setup>
import AppLogo from '@/components/ui/AppLogo.vue'
import HeroTree from '@/components/ui/HeroTree.vue'

const points = [
  { icon: 'sym_r_account_tree', text: 'Интерактивное древо: предки, потомки, кровные и все родственники' },
  { icon: 'sym_r_history_edu', text: 'События, места, документы и источники для каждого человека' },
  { icon: 'sym_r_description', text: 'Поколенные росписи, статистика и проверка данных' },
  { icon: 'sym_r_wifi_off', text: 'Работает без интернета, устанавливается как приложение' },
]
</script>

<template>
  <div class="al">
    <aside class="al__side">
      <AppLogo :to="{ name: 'home' }" class="al__logo" />
      <div class="al__pitch">
        <h2 class="ft-display">История вашей семьи — в одном месте</h2>
        <ul>
          <li v-for="p in points" :key="p.icon">
            <span><q-icon :name="p.icon" size="18px" /></span>
            {{ p.text }}
          </li>
        </ul>
      </div>
      <HeroTree class="al__art" />
    </aside>
    <main class="al__main">
      <AppLogo :to="{ name: 'home' }" class="al__logo-mobile" />
      <div class="al__card">
        <router-view v-slot="{ Component }">
          <transition name="page" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </div>
      <div class="al__links text-muted">
        <router-link :to="{ name: 'help' }">Справка</router-link>
        <router-link :to="{ name: 'privacy' }">Конфиденциальность</router-link>
        <router-link :to="{ name: 'terms' }">Условия</router-link>
      </div>
    </main>
  </div>
</template>

<style scoped lang="scss">
.al {
  min-height: 100vh;
  display: grid;
  grid-template-columns: minmax(380px, 44%) 1fr;
  background: var(--ft-bg);
}
.al__side {
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding: 36px 44px;
  background:
    radial-gradient(120% 80% at 0% 0%, color-mix(in srgb, var(--ft-primary) 16%, transparent), transparent 60%),
    linear-gradient(160deg, var(--ft-surface-2), var(--ft-surface-3));
  border-right: 1px solid var(--ft-border);
}
.al__pitch {
  margin-top: 56px;
  max-width: 440px;
  position: relative;
  z-index: 1;
  h2 {
    font-size: 32px;
    line-height: 1.2;
    margin: 0 0 24px;
  }
  ul {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  li {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    color: var(--ft-text-2);
    span {
      width: 32px;
      height: 32px;
      border-radius: 10px;
      display: grid;
      place-items: center;
      background: var(--ft-surface);
      color: var(--ft-primary-text);
      box-shadow: var(--ft-shadow-xs);
      flex: none;
    }
  }
}
.al__art {
  position: absolute;
  right: -40px;
  bottom: -20px;
  width: 520px;
  opacity: 0.9;
}
.al__main {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 20px;
}
.al__logo-mobile {
  display: none;
  margin-bottom: 24px;
}
.al__card {
  width: 100%;
  max-width: 420px;
}
.al__links {
  display: flex;
  gap: 16px;
  margin-top: 32px;
  font-size: 12.5px;
  a {
    color: var(--ft-muted);
  }
}
@media (max-width: 900px) {
  .al {
    grid-template-columns: 1fr;
  }
  .al__side {
    display: none;
  }
  .al__logo-mobile {
    display: inline-flex;
  }
  .al__main {
    justify-content: flex-start;
    padding-top: 40px;
  }
}
</style>
