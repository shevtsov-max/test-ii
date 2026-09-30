<script setup>
/** Учётная запись: профиль, безопасность, уведомления, оформление, приложение (PWA и обновления), данные. */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import UserAvatar from '@/components/ui/UserAvatar.vue'
import PasswordInput from '@/components/auth/PasswordInput.vue'
import { useAuthStore } from '@/stores/auth'
import { usePrefsStore } from '@/stores/prefs'
import { usePwaStore } from '@/stores/pwa'
import { useTreesStore } from '@/stores/trees'
import { useUiStore } from '@/stores/ui'
import { api, errorMessage } from '@/api'
import { config } from '@/app/config'
import { downloadBackup } from '@/utils/backup'
import { formatBytes, pickFiles, readImage } from '@/utils/files'
import { validatePassword } from '@/utils/password'
import { timeAgo } from '@/utils/format'

const $q = useQuasar()
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const prefs = usePrefsStore()
const pwa = usePwaStore()
const trees = useTreesStore()
const ui = useUiStore()

const TABS = computed(() => [
  { name: 'profile', label: 'Профиль', icon: 'sym_r_person' },
  ...(auth.isGuest
    ? []
    : [
        { name: 'security', label: 'Безопасность', icon: 'sym_r_lock' },
        { name: 'notifications', label: 'Уведомления', icon: 'sym_r_notifications' },
      ]),
  { name: 'appearance', label: 'Оформление', icon: 'sym_r_palette' },
  { name: 'app', label: 'Приложение', icon: 'sym_r_install_desktop' },
  { name: 'data', label: 'Данные', icon: 'sym_r_database' },
])
const tab = computed({
  get: () => (TABS.value.some((t) => t.name === route.query.tab) ? route.query.tab : 'profile'),
  set: (v) => router.replace({ query: { ...route.query, tab: v } }),
})

async function run(fn, ok) {
  try {
    const r = await fn()
    if (ok) $q.notify({ type: 'positive', message: ok })
    return r ?? true
  } catch (e) {
    $q.notify({ type: 'negative', message: errorMessage(e) })
    return false
  }
}

// ------------------------------------------------------------------ профиль
const profile = ref({ name: '', email: '' })
watch(
  () => auth.user,
  (u) => (profile.value = { name: u?.name ?? '', email: u?.email ?? '' }),
  { immediate: true },
)
const profileDirty = computed(() => profile.value.name.trim() !== (auth.user?.name ?? '') || profile.value.email.trim() !== (auth.user?.email ?? ''))
const savingProfile = ref(false)
async function saveProfile() {
  savingProfile.value = true
  await run(() => auth.updateProfile({ name: profile.value.name.trim(), email: profile.value.email.trim() }), 'Профиль сохранён')
  savingProfile.value = false
}
async function changeAvatar() {
  const [file] = await pickFiles('image/*')
  if (!file) return
  await run(async () => {
    const img = await readImage(file)
    const avatar = await img.toDataUrl(256, 0.85)
    img.release()
    await auth.updateProfile({ avatar })
  }, 'Фото обновлено')
}
const removeAvatar = () => run(() => auth.updateProfile({ avatar: null }))
const marketing = computed({
  get: () => !!auth.user?.marketingOptIn,
  set: (v) => run(() => auth.updateProfile({ marketingOptIn: v }), v ? 'Подписка на новости включена' : 'Согласие на рассылку отозвано'),
})
const resend = () => run(() => auth.resendVerification(), 'Письмо отправлено')

// ------------------------------------------------------------------ безопасность
const pw = ref({ current: '', next: '', repeat: '' })
const pwErrors = ref({})
async function changePassword() {
  pwErrors.value = {}
  const e = validatePassword(pw.value.next)
  if (e) return (pwErrors.value = { next: e })
  if (pw.value.next !== pw.value.repeat) return (pwErrors.value = { repeat: 'Пароли не совпадают' })
  const ok = await run(() => auth.changePassword(pw.value.current, pw.value.next), 'Пароль изменён')
  if (ok) pw.value = { current: '', next: '', repeat: '' }
}
async function logout() {
  await auth.logout()
  trees.reset()
  router.replace({ name: 'home' })
}

// ------------------------------------------------------------------ уведомления
const notif = ref(null)
const notifLoading = ref(false)
const tgConsent = ref(false)
const linking = ref(false)
let pollTimer = null
const TIMES = Array.from({ length: 17 }, (_, i) => `${String(i + 6).padStart(2, '0')}:00`)
const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone
const TIMEZONES = [
  ...new Set([
    localTz,
    'Europe/Kaliningrad',
    'Europe/Moscow',
    'Europe/Samara',
    'Asia/Yekaterinburg',
    'Asia/Omsk',
    'Asia/Novosibirsk',
    'Asia/Krasnoyarsk',
    'Asia/Irkutsk',
    'Asia/Yakutsk',
    'Asia/Vladivostok',
    'Asia/Magadan',
    'Asia/Kamchatka',
  ]),
]
async function loadNotifications() {
  if (auth.isGuest || notif.value) return
  notifLoading.value = true
  try {
    notif.value = await api.notifications.settings()
  } catch (e) {
    $q.notify({ type: 'negative', message: errorMessage(e) })
  } finally {
    notifLoading.value = false
  }
}
watch(tab, (t) => t === 'notifications' && loadNotifications(), { immediate: true })
async function saveNotif(patch) {
  const prev = notif.value
  notif.value = { ...prev, ...patch }
  const r = await run(() => api.notifications.update(patch))
  if (r) notif.value = r
  else notif.value = prev
}
/** Подключение бота: ссылка t.me/<бот>?start=<код>, затем ждём, пока пользователь нажмёт «Start». */
async function connectTelegram() {
  linking.value = true
  const link = await run(() => api.notifications.telegramLink())
  if (!link) return (linking.value = false)
  window.open(link.url, '_blank', 'noopener')
  const until = Date.now() + 5 * 60 * 1000
  clearInterval(pollTimer)
  pollTimer = setInterval(async () => {
    const s = await api.notifications.settings().catch(() => null)
    if (s?.telegramLinked || Date.now() > until) {
      clearInterval(pollTimer)
      linking.value = false
      if (s) notif.value = s
      if (s?.telegramLinked) {
        if (s.timezone !== localTz && TIMEZONES.includes(localTz)) saveNotif({ timezone: localTz })
        $q.notify({ type: 'positive', message: 'Телеграм подключён — пришлём напоминание утром в день события' })
      }
    }
  }, 3000)
}
onBeforeUnmount(() => clearInterval(pollTimer))
async function disconnectTelegram() {
  const r = await run(() => api.notifications.disconnect(), 'Телеграм отключён')
  if (r) notif.value = r
}
const sendTest = () => run(() => api.notifications.test(), 'Тестовое сообщение отправлено')

// ------------------------------------------------------------------ оформление
const THEMES = [
  { value: 'auto', label: 'Как в системе', icon: 'sym_r_contrast' },
  { value: 'light', label: 'Светлая', icon: 'sym_r_light_mode' },
  { value: 'dark', label: 'Тёмная', icon: 'sym_r_dark_mode' },
]
const DENSITIES = [
  { value: 'compact', label: 'Компактные' },
  { value: 'normal', label: 'Обычные' },
  { value: 'detailed', label: 'Подробные' },
]
function resetChart() {
  prefs.resetChart()
  $q.notify({ message: 'Настройки древа сброшены' })
}

// ------------------------------------------------------------------ приложение
const isIos = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent)
async function checkUpdates() {
  const has = await pwa.check()
  if (!has) $q.notify({ message: `У вас последняя версия (${config.version})` })
}
const buildDate = config.buildTime ? new Date(config.buildTime).toLocaleString('ru-RU', { dateStyle: 'long', timeStyle: 'short' }) : ''

// ------------------------------------------------------------------ данные
const storage = ref(null)
const persisted = ref(null)
onMounted(async () => {
  if (!trees.loaded) trees.fetch().catch(() => {})
  if (navigator.storage?.estimate) storage.value = await navigator.storage.estimate().catch(() => null)
  if (navigator.storage?.persisted) persisted.value = await navigator.storage.persisted().catch(() => null)
})
async function persist() {
  const ok = await navigator.storage?.persist?.().catch(() => false)
  persisted.value = !!ok
  $q.notify(ok ? { type: 'positive', message: 'Браузер не будет удалять данные автоматически' } : { message: 'Браузер отклонил запрос. Установите приложение — тогда защита включается сама.' })
}
const exportingAll = ref(false)
async function exportAll() {
  exportingAll.value = true
  await run(async () => {
    for (const t of trees.list) {
      const { tree } = await api.trees.get(t.id, auth.user?.id)
      await downloadBackup(tree)
    }
  }, trees.list.length ? 'Резервные копии скачаны' : '')
  exportingAll.value = false
}
function deleteAccount() {
  if (auth.isGuest) {
    $q.dialog({
      title: 'Удалить все данные?',
      message: 'Все древа, фото и документы в этом браузере будут удалены безвозвратно.',
      prompt: { model: '', type: 'text', outlined: true, label: 'Введите «удалить»', isValid: (v) => v.trim().toLowerCase() === 'удалить' },
      cancel: { flat: true, label: 'Отмена', noCaps: true },
      ok: { unelevated: true, label: 'Удалить всё', color: 'negative', noCaps: true },
    }).onOk(async () => {
      const ok = await run(async () => {
        for (const t of [...trees.list]) await trees.remove(t.id)
      })
      if (ok) {
        await auth.logout()
        trees.reset()
        router.replace({ name: 'home' })
      }
    })
    return
  }
  $q.dialog({
    title: 'Удалить учётную запись?',
    message: 'Учётная запись и все ваши древа, фото и документы будут удалены безвозвратно. Введите пароль для подтверждения.',
    prompt: { model: '', type: 'password', outlined: true, label: 'Пароль', isValid: (v) => !!v },
    cancel: { flat: true, label: 'Отмена', noCaps: true },
    ok: { unelevated: true, label: 'Удалить навсегда', color: 'negative', noCaps: true },
  }).onOk(async (password) => {
    const ok = await run(() => auth.deleteAccount(password))
    if (ok) {
      trees.reset()
      router.replace({ name: 'home' })
      $q.notify({ message: 'Учётная запись удалена' })
    }
  })
}
const memberSince = computed(() => (auth.user?.createdAt ? new Date(auth.user.createdAt).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }) : ''))
</script>

<template>
  <div class="ft-page ac">
    <header class="ac__head">
      <UserAvatar :name="auth.displayName" :src="auth.user?.avatar" :guest="auth.isGuest" :size="64" />
      <div class="min-w-0">
        <h1 class="ft-h1 ellipsis-1">{{ auth.displayName }}</h1>
        <div class="text-muted">
          <template v-if="auth.isGuest">Работа без регистрации — данные только в этом браузере</template>
          <template v-else>{{ auth.user?.email }}<template v-if="memberSince"> · с нами с {{ memberSince }}</template></template>
        </div>
      </div>
      <q-space />
      <q-btn v-if="auth.isGuest" unelevated no-caps color="primary" icon="sym_r_person_add" label="Зарегистрироваться" :to="{ name: 'register' }" />
      <q-btn v-else flat no-caps icon="sym_r_logout" label="Выйти" @click="logout" />
    </header>

    <q-tabs v-model="tab" align="left" no-caps inline-label active-color="primary" indicator-color="primary" class="ac__tabs" outside-arrows mobile-arrows>
      <q-tab v-for="t in TABS" :key="t.name" :name="t.name" :icon="t.icon" :label="t.label" />
    </q-tabs>

    <!-- Профиль -->
    <div v-if="tab === 'profile'" class="ac__panel">
      <section v-if="auth.isGuest" class="ft-card ft-card--pad ac__section">
        <h2 class="ft-h3">Сохраните свою работу</h2>
        <p class="ac__p">
          Сейчас вы работаете без учётной записи. Зарегистрируйтесь — все созданные древа перейдут в неё.
          <template v-if="api.capabilities.sync">Древо станет доступно на всех ваших устройствах.</template>
        </p>
        <div>
          <q-btn unelevated no-caps color="primary" label="Зарегистрироваться" :to="{ name: 'register' }" />
          <q-btn flat no-caps label="У меня есть учётная запись" :to="{ name: 'login' }" class="q-ml-sm" />
        </div>
      </section>
      <section v-else class="ft-card ft-card--pad ac__section">
        <h2 class="ft-h3">Профиль</h2>
        <div class="ac__avatar">
          <UserAvatar :name="auth.displayName" :src="auth.user?.avatar" :size="72" />
          <div class="ac__avatar-actions">
            <q-btn outline no-caps color="primary" icon="sym_r_photo_camera" label="Загрузить фото" @click="changeAvatar" />
            <q-btn v-if="auth.user?.avatar" flat no-caps label="Убрать" @click="removeAvatar" />
          </div>
        </div>
        <form class="ac__form" @submit.prevent="saveProfile">
          <q-input v-model="profile.name" outlined label="Имя" autocomplete="name" />
          <q-input v-model="profile.email" outlined type="email" label="Электронная почта" autocomplete="email">
            <template v-if="api.capabilities.emailFlows" #append>
              <span v-if="auth.user?.emailVerified" class="ft-chip ft-chip--accent"><q-icon name="sym_r_verified" size="14px" />подтверждена</span>
              <span v-else class="ft-chip ft-chip--warning">не подтверждена</span>
            </template>
          </q-input>
          <div v-if="api.capabilities.emailFlows && !auth.user?.emailVerified" class="auth-note auth-note--info">
            <q-icon name="sym_r_mail" size="18px" />
            <span>Подтвердите почту — без этого не получится восстановить пароль. <a href="#" @click.prevent="resend">Отправить письмо ещё раз</a></span>
          </div>
          <div>
            <q-btn type="submit" unelevated no-caps color="primary" label="Сохранить" :disable="!profileDirty" :loading="savingProfile" />
          </div>
        </form>
      </section>
      <section v-if="!auth.isGuest" class="ft-card ft-card--pad ac__section">
        <h2 class="ft-h3">Согласия</h2>
        <q-toggle v-model="marketing" label="Получать новости сервиса на почту" />
        <p class="ac__p ac__small">
          По <router-link :to="{ name: 'marketing-consent' }">согласию на информационные сообщения</router-link>. Его можно отозвать в любой момент — выключите
          переключатель. Документы: <router-link :to="{ name: 'terms' }">соглашение</router-link>,
          <router-link :to="{ name: 'privacy' }">политика обработки персональных данных</router-link>,
          <router-link :to="{ name: 'consent' }">согласие на обработку</router-link>.
        </p>
      </section>
    </div>

    <!-- Уведомления -->
    <div v-else-if="tab === 'notifications'" class="ac__panel">
      <section class="ft-card ft-card--pad ac__section">
        <h2 class="ft-h3">Дни рождения в Телеграме</h2>
        <p class="ac__p">
          Бот пришлёт утром, у кого из родственников сегодня день рождения, годовщина свадьбы или день памяти — по всем вашим древам. Бесплатно.
        </p>
        <q-skeleton v-if="notifLoading && !notif" height="80px" />
        <template v-else-if="notif && !notif.available">
          <div class="auth-note auth-note--info">
            <q-icon name="sym_r_info" size="18px" />
            <span v-if="api.mode === 'local'">В демо-версии без сервера уведомления недоступны. Ближайшие даты видны на странице «Мои древа».</span>
            <span v-else>Бот пока не подключён администратором сайта. Ближайшие даты видны на странице «Мои древа».</span>
          </div>
        </template>
        <template v-else-if="notif && !notif.telegramLinked">
          <q-checkbox v-model="tgConsent" dense class="ac__consent">
            <span>
              Согласен(на), что имена и даты родственников из напоминаний передаются через Telegram — иностранный сервис
              (<router-link :to="{ name: 'privacy' }">Политика</router-link>, раздел о трансграничной передаче)
            </span>
          </q-checkbox>
          <div class="row items-center q-gutter-sm">
            <q-btn unelevated no-caps color="primary" icon="sym_r_send" label="Подключить Телеграм" :disable="!tgConsent" :loading="linking" @click="connectTelegram" />
            <span v-if="linking" class="text-muted" style="font-size: 13px">Откроется Телеграм — нажмите «Запустить» (Start) в чате с ботом…</span>
          </div>
        </template>
        <template v-else-if="notif">
          <div class="ac__tg">
            <q-icon name="sym_r_check_circle" size="22px" class="ac__tg-ok" />
            <div class="col">
              <b>Телеграм подключён</b>
              <div class="text-muted" style="font-size: 12.5px">{{ notif.telegramUsername ? '@' + notif.telegramUsername : 'чат с ботом' }}{{ notif.botUsername ? ` · бот @${notif.botUsername}` : '' }}</div>
            </div>
            <q-btn flat no-caps icon="sym_r_send" label="Проверить" @click="sendTest" />
            <q-btn flat no-caps color="negative" label="Отключить" @click="disconnectTelegram" />
          </div>
          <div class="ac__opts">
            <q-toggle :model-value="notif.enabled" label="Присылать напоминания" @update:model-value="(v) => saveNotif({ enabled: v })" />
            <template v-if="notif.enabled">
              <q-toggle :model-value="notif.birthdays" label="Дни рождения" @update:model-value="(v) => saveNotif({ birthdays: v })" />
              <q-toggle :model-value="notif.anniversaries" label="Годовщины свадеб" @update:model-value="(v) => saveNotif({ anniversaries: v })" />
              <q-toggle :model-value="notif.memorials" label="Дни памяти ушедших родных" @update:model-value="(v) => saveNotif({ memorials: v })" />
              <div class="ac__opt">
                <span>Время</span>
                <q-select :model-value="notif.sendTime" :options="TIMES" dense outlined style="width: 110px" @update:model-value="(v) => saveNotif({ sendTime: v })" />
                <q-select :model-value="notif.timezone" :options="TIMEZONES" dense outlined style="min-width: 190px" @update:model-value="(v) => saveNotif({ timezone: v })" />
              </div>
            </template>
          </div>
        </template>
      </section>
    </div>

    <!-- Безопасность -->
    <div v-else-if="tab === 'security'" class="ac__panel">
      <section class="ft-card ft-card--pad ac__section">
        <h2 class="ft-h3">Смена пароля</h2>
        <form class="ac__form" @submit.prevent="changePassword">
          <PasswordInput v-model="pw.current" label="Текущий пароль" />
          <PasswordInput v-model="pw.next" label="Новый пароль" autocomplete="new-password" strength :error="pwErrors.next" />
          <PasswordInput v-model="pw.repeat" label="Повторите новый пароль" autocomplete="new-password" :error="pwErrors.repeat" />
          <div>
            <q-btn type="submit" unelevated no-caps color="primary" label="Изменить пароль" :disable="!pw.current || !pw.next" />
          </div>
        </form>
      </section>
      <section class="ft-card ft-card--pad ac__section">
        <h2 class="ft-h3">Сеанс</h2>
        <p class="ac__p">Выход завершит сеанс на этом устройстве. Данные останутся в учётной записи.</p>
        <div><q-btn outline no-caps icon="sym_r_logout" label="Выйти из учётной записи" @click="logout" /></div>
      </section>
    </div>

    <!-- Оформление -->
    <div v-else-if="tab === 'appearance'" class="ac__panel">
      <section class="ft-card ft-card--pad ac__section">
        <h2 class="ft-h3">Тема</h2>
        <div class="ac__themes">
          <button v-for="t in THEMES" :key="t.value" type="button" class="ac__theme" :class="[`ac__theme--${t.value}`, { active: prefs.theme === t.value }]" @click="prefs.theme = t.value">
            <span class="ac__theme-art"><i /><i /><i /></span>
            <span class="ac__theme-label"><q-icon :name="t.icon" size="18px" />{{ t.label }}</span>
          </button>
        </div>
      </section>
      <section class="ft-card ft-card--pad ac__section">
        <h2 class="ft-h3">Древо по умолчанию</h2>
        <div class="ac__opts">
          <div class="ac__opt">
            <span>Карточки</span>
            <q-btn-toggle v-model="prefs.chart.density" :options="DENSITIES" no-caps unelevated toggle-color="primary" rounded dense class="ac__toggle" />
          </div>
          <q-toggle v-model="prefs.chart.relation" label="Подписи родства над именем («Брат», «Прабабушка»)" />
          <q-toggle v-model="prefs.chart.photos" label="Фотографии на карточках" />
          <q-toggle v-model="prefs.chart.patronymic" label="Отчество на карточках" />
          <q-toggle v-model="prefs.chart.animate" label="Плавные переходы" />
          <q-toggle v-model="prefs.chart.minimap" label="Мини-карта" />
        </div>
        <div><q-btn flat no-caps color="primary" icon="sym_r_restart_alt" label="Сбросить все настройки древа" @click="resetChart" /></div>
      </section>
    </div>

    <!-- Приложение -->
    <div v-else-if="tab === 'app'" class="ac__panel">
      <section class="ft-card ft-card--pad ac__section">
        <h2 class="ft-h3">Версия</h2>
        <div class="ac__version">
          <div>
            <div class="ac__version-n">{{ config.version }}</div>
            <div class="text-muted" style="font-size: 12.5px">
              <template v-if="buildDate">Сборка от {{ buildDate }}</template>
              <template v-if="pwa.lastCheck"> · проверено {{ timeAgo(pwa.lastCheck) }}</template>
            </div>
          </div>
          <q-space />
          <q-btn v-if="pwa.needRefresh" unelevated no-caps color="primary" icon="sym_r_system_update_alt" label="Установить обновление" @click="pwa.applyUpdate()" />
          <q-btn v-else outline no-caps icon="sym_r_refresh" label="Проверить обновления" :loading="pwa.checking" :disable="!pwa.registration || !pwa.online" @click="checkUpdates" />
        </div>
        <div class="ac__status">
          <span><q-icon :name="pwa.online ? 'sym_r_wifi' : 'sym_r_wifi_off'" size="16px" />{{ pwa.online ? 'В сети' : 'Нет интернета — работа продолжается' }}</span>
          <span v-if="pwa.supported"><q-icon :name="pwa.registration ? 'sym_r_offline_pin' : 'sym_r_hourglass'" size="16px" />{{ pwa.registration ? 'Работает без интернета' : 'Офлайн-режим включится после первой загрузки' }}</span>
        </div>
        <div><q-btn flat no-caps color="primary" icon="sym_r_celebration" label="Что нового" @click="ui.whatsNewOpen = true" /></div>
      </section>
      <section class="ft-card ft-card--pad ac__section">
        <h2 class="ft-h3">Установка на устройство</h2>
        <template v-if="pwa.installed">
          <div class="auth-note auth-note--positive"><q-icon name="sym_r_check_circle" size="18px" /><span>Приложение установлено и открывается с рабочего стола.</span></div>
        </template>
        <template v-else-if="pwa.installEvent">
          <p class="ac__p">Установите «Родословную» как приложение: отдельное окно, значок на рабочем столе и работа без интернета.</p>
          <div><q-btn unelevated no-caps color="primary" icon="sym_r_install_desktop" label="Установить приложение" @click="pwa.install()" /></div>
        </template>
        <template v-else-if="isIos">
          <p class="ac__p">
            В Safari нажмите <q-icon name="sym_r_ios_share" size="18px" /> «Поделиться», затем «На экран Домой». Приложение появится рядом с остальными.
          </p>
        </template>
        <template v-else>
          <p class="ac__p">
            Откройте меню браузера и выберите «Установить приложение» (в Chrome и Edge — значок в адресной строке). Если пункта нет, браузер не
            поддерживает установку — сайт продолжит работать как обычно.
          </p>
        </template>
        <p class="ac__p text-muted">
          Обновления приходят сами: когда выйдет новая версия, внизу экрана появится кнопка «Обновить». Ничего не потеряется — изменения сохраняются
          сразу.
        </p>
      </section>
    </div>

    <!-- Данные -->
    <div v-else class="ac__panel">
      <section class="ft-card ft-card--pad ac__section">
        <h2 class="ft-h3">Хранилище</h2>
        <template v-if="api.mode === 'local'">
          <p class="ac__p">Древа, фото и документы хранятся в этом браузере. Очистка данных сайта удалит их — держите резервную копию.</p>
          <div v-if="storage?.quota" class="ac__storage">
            <div class="ac__storage-top">
              <span>Занято {{ formatBytes(storage.usage) }}</span>
              <span class="text-muted">доступно {{ formatBytes(storage.quota) }}</span>
            </div>
            <q-linear-progress :value="Math.max(0.01, storage.usage / storage.quota)" rounded size="8px" color="primary" track-color="grey-3" />
          </div>
          <div class="ac__persist">
            <q-icon :name="persisted ? 'sym_r_verified_user' : 'sym_r_shield'" size="22px" :class="persisted ? 'text-positive' : 'text-muted'" />
            <div class="col">
              <b>{{ persisted ? 'Данные защищены от автоочистки' : 'Защита от автоочистки выключена' }}</b>
              <span>Когда на диске мало места, браузер может удалять данные сайтов. Защищённые данные он не трогает.</span>
            </div>
            <q-btn v-if="!persisted" outline no-caps color="primary" label="Защитить" @click="persist" />
          </div>
        </template>
        <p v-else class="ac__p">Данные хранятся на сервере и синхронизируются между устройствами.</p>
      </section>
      <section class="ft-card ft-card--pad ac__section">
        <h2 class="ft-h3">Резервные копии</h2>
        <p class="ac__p">Скачайте все древа ({{ trees.list.length }}) вместе с фото — по файлу на древо. Из копии древо восстанавливается через «Импорт».</p>
        <div><q-btn unelevated no-caps color="primary" icon="sym_r_download" label="Скачать все древа" :loading="exportingAll" :disable="!trees.list.length" @click="exportAll" /></div>
      </section>
      <section class="ft-card ft-card--pad ac__section ac__danger">
        <h2 class="ft-h3">{{ auth.isGuest ? 'Удалить все данные' : 'Удалить учётную запись' }}</h2>
        <p class="ac__p">
          {{ auth.isGuest ? 'Все древа, фото и документы в этом браузере будут удалены.' : 'Учётная запись и все древа будут удалены безвозвратно.' }}
          Сначала скачайте резервные копии.
        </p>
        <div><q-btn unelevated no-caps color="negative" :label="auth.isGuest ? 'Удалить все данные' : 'Удалить учётную запись'" @click="deleteAccount" /></div>
      </section>
    </div>
  </div>
</template>

<style scoped lang="scss">
.ac {
  max-width: 860px;
}
.ac__head {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 18px;
}
.ac__tabs {
  border-bottom: 1px solid var(--ft-border);
  margin-bottom: 18px;
}
.ac__panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.ac__section {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.ac__small {
  font-size: 12.5px;
  color: var(--ft-muted);
}
.ac__consent {
  align-items: flex-start;
  font-size: 13px;
  color: var(--ft-text-2);
  margin-bottom: 10px;
}
.ac__tg-ok {
  color: var(--ft-positive);
}
.ac__tg {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 12px;
  background: var(--ft-positive-soft);
}
.ac__p {
  margin: 0;
  color: var(--ft-text-2);
  line-height: 1.6;
  font-size: 14px;
}
.ac__form {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-width: 460px;
}
.ac__avatar {
  display: flex;
  align-items: center;
  gap: 18px;
}
.ac__avatar-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.ac__themes {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 180px));
  gap: 12px;
}
.ac__theme {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px;
  border-radius: 14px;
  border: 1px solid var(--ft-border);
  background: var(--ft-surface);
  color: var(--ft-text);
  font: inherit;
  cursor: pointer;
  &.active {
    border-color: var(--ft-primary);
    box-shadow: 0 0 0 3px var(--ft-primary-soft);
  }
}
.ac__theme-art {
  height: 72px;
  border-radius: 9px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  i {
    display: block;
    height: 10px;
    border-radius: 4px;
    &:first-child {
      width: 60%;
      background: #d24e26;
    }
  }
}
.ac__theme--light .ac__theme-art {
  background: #f6f4f0;
  i + i {
    background: #e6e2da;
  }
}
.ac__theme--dark .ac__theme-art {
  background: #0f1216;
  i + i {
    background: #2a313b;
  }
}
.ac__theme--auto .ac__theme-art {
  background: linear-gradient(135deg, #f6f4f0 50%, #0f1216 50%);
  i + i {
    background: #9aa0a9;
  }
}
.ac__theme-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13.5px;
  font-weight: 600;
}
.ac__opts {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.ac__opt {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 8px;
  font-size: 14px;
}
.ac__toggle {
  border: 1px solid var(--ft-border);
}
.ac__version {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}
.ac__version-n {
  font-size: 26px;
  font-weight: 750;
  letter-spacing: -0.02em;
}
.ac__status {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 20px;
  font-size: 13px;
  color: var(--ft-text-2);
  span {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
}
.ac__storage {
  max-width: 460px;
}
.ac__storage-top {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  margin-bottom: 6px;
}
.ac__persist {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--ft-surface-2);
  border: 1px solid var(--ft-border);
  flex-wrap: wrap;
  .col {
    display: flex;
    flex-direction: column;
    font-size: 12.5px;
    color: var(--ft-muted);
    min-width: 220px;
  }
  b {
    color: var(--ft-text);
    font-size: 14px;
  }
}
.ac__danger {
  border-color: color-mix(in srgb, var(--ft-negative) 35%, var(--ft-border));
}
@media (max-width: 600px) {
  .ac__themes {
    grid-template-columns: repeat(3, 1fr);
  }
}
</style>
