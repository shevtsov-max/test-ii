<script setup>
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import UserAvatar from './UserAvatar.vue'
import { useAuthStore } from '@/stores/auth'
import { usePrefsStore } from '@/stores/prefs'
import { useUiStore } from '@/stores/ui'
import { useTreeStore } from '@/stores/tree'
import { useTreesStore } from '@/stores/trees'

const $q = useQuasar()
const router = useRouter()
const auth = useAuthStore()
const prefs = usePrefsStore()
const ui = useUiStore()
const tree = useTreeStore()
const trees = useTreesStore()

const themes = [
  { value: 'light', icon: 'sym_r_light_mode', label: 'Светлая' },
  { value: 'dark', icon: 'sym_r_dark_mode', label: 'Тёмная' },
  { value: 'auto', icon: 'sym_r_contrast', label: 'Как в системе' },
]

async function logout() {
  if (auth.isGuest) {
    const ok = await new Promise((resolve) =>
      $q
        .dialog({
          title: 'Выйти из гостевого режима?',
          message: 'Древа гостя останутся в этом браузере — вернуться к ним можно кнопкой «Попробовать без регистрации».',
          cancel: { flat: true, label: 'Отмена', noCaps: true },
          ok: { unelevated: true, label: 'Выйти', color: 'primary', noCaps: true },
        })
        .onOk(() => resolve(true))
        .onCancel(() => resolve(false)),
    )
    if (!ok) return
  }
  await tree.close()
  await auth.logout()
  trees.reset()
  router.push({ name: 'home' })
}
</script>

<template>
  <q-btn flat round dense class="um" :aria-label="auth.displayName">
    <UserAvatar :name="auth.displayName" :src="auth.user?.avatar" :guest="auth.isGuest" :size="32" />
    <q-menu anchor="bottom right" self="top right" :offset="[0, 8]" class="um__menu">
      <div class="um__head">
        <UserAvatar :name="auth.displayName" :src="auth.user?.avatar" :guest="auth.isGuest" :size="40" />
        <div class="min-w-0">
          <div class="fw-600 ellipsis-1">{{ auth.displayName }}</div>
          <div class="text-muted ellipsis-1" style="font-size: 12.5px">
            {{ auth.isGuest ? 'Гостевой режим — данные в этом браузере' : auth.user?.email }}
          </div>
        </div>
      </div>
      <q-list dense class="q-pb-xs">
        <template v-if="auth.isGuest">
          <q-item v-close-popup clickable :to="{ name: 'register' }" class="text-primary">
            <q-item-section avatar><q-icon name="sym_r_person_add" /></q-item-section>
            <q-item-section class="fw-600">Создать учётную запись</q-item-section>
          </q-item>
          <q-item v-close-popup clickable :to="{ name: 'login' }">
            <q-item-section avatar><q-icon name="sym_r_login" /></q-item-section>
            <q-item-section>Войти</q-item-section>
          </q-item>
          <q-separator class="q-my-xs" />
        </template>
        <q-item v-close-popup clickable :to="{ name: 'dashboard' }" exact>
          <q-item-section avatar><q-icon name="sym_r_forest" /></q-item-section>
          <q-item-section>Мои древа</q-item-section>
        </q-item>
        <q-item v-close-popup clickable :to="{ name: 'account' }">
          <q-item-section avatar><q-icon name="sym_r_manage_accounts" /></q-item-section>
          <q-item-section>Учётная запись и приложение</q-item-section>
        </q-item>
        <q-separator class="q-my-xs" />
        <q-item-label header class="q-py-xs">Оформление</q-item-label>
        <div class="um__themes">
          <button v-for="t in themes" :key="t.value" type="button" :class="{ active: prefs.theme === t.value }" @click="prefs.theme = t.value">
            <q-icon :name="t.icon" size="18px" />
            <span>{{ t.label }}</span>
          </button>
        </div>
        <q-separator class="q-my-xs" />
        <q-item v-close-popup clickable @click="ui.shortcutsOpen = true">
          <q-item-section avatar><q-icon name="sym_r_keyboard" /></q-item-section>
          <q-item-section>Горячие клавиши</q-item-section>
        </q-item>
        <q-item v-close-popup clickable :to="{ name: 'help' }">
          <q-item-section avatar><q-icon name="sym_r_help" /></q-item-section>
          <q-item-section>Справка</q-item-section>
        </q-item>
        <q-item v-close-popup clickable @click="ui.whatsNewOpen = true">
          <q-item-section avatar><q-icon name="sym_r_campaign" /></q-item-section>
          <q-item-section>Что нового</q-item-section>
        </q-item>
        <q-separator class="q-my-xs" />
        <q-item v-close-popup clickable @click="logout">
          <q-item-section avatar><q-icon name="sym_r_logout" /></q-item-section>
          <q-item-section>Выйти</q-item-section>
        </q-item>
      </q-list>
    </q-menu>
  </q-btn>
</template>

<style scoped lang="scss">
.um {
  padding: 2px;
}
.um__head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px 10px;
  min-width: 290px;
  max-width: 320px;
}
.um__themes {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
  padding: 2px 10px 8px;
  button {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 7px 4px;
    border-radius: 10px;
    border: 1px solid var(--ft-border);
    background: var(--ft-surface);
    color: var(--ft-text-2);
    font: inherit;
    font-size: 11.5px;
    cursor: pointer;
    &:hover {
      border-color: var(--ft-border-strong);
    }
    &.active {
      border-color: var(--ft-primary);
      color: var(--ft-primary-text);
      background: var(--ft-primary-soft);
    }
  }
}
</style>
