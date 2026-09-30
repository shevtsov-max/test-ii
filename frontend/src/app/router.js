/**
 * Маршруты. По умолчанию — hash-история (/#/app): работает на любом статическом хостинге,
 * включая GitHub Pages. Для «чистых» адресов: VITE_ROUTER_MODE=history + fallback на index.html.
 */
import { createRouter, createWebHashHistory, createWebHistory } from 'vue-router'
import { config } from './config'
import { useAuthStore } from '@/stores/auth'

const routes = [
  // ---------------------------------------------------------------- публичные
  {
    path: '/',
    component: () => import('@/layouts/PublicLayout.vue'),
    children: [
      { path: '', name: 'home', component: () => import('@/pages/public/LandingPage.vue'), meta: { title: 'Семейное древо онлайн' } },
      { path: 'help', name: 'help', component: () => import('@/pages/public/HelpPage.vue'), meta: { title: 'Справка' } },
      { path: 'privacy', name: 'privacy', component: () => import('@/pages/public/LegalPage.vue'), props: { doc: 'privacy' }, meta: { title: 'Политика обработки персональных данных' } },
      { path: 'terms', name: 'terms', component: () => import('@/pages/public/LegalPage.vue'), props: { doc: 'terms' }, meta: { title: 'Пользовательское соглашение' } },
      { path: 'consent', name: 'consent', component: () => import('@/pages/public/LegalPage.vue'), props: { doc: 'personal_data' }, meta: { title: 'Согласие на обработку персональных данных' } },
      { path: 'marketing-consent', name: 'marketing-consent', component: () => import('@/pages/public/LegalPage.vue'), props: { doc: 'marketing' }, meta: { title: 'Согласие на информационные сообщения' } },
      { path: 'invite/:token', name: 'invite', component: () => import('@/pages/public/InvitePage.vue'), props: true, meta: { title: 'Приглашение' } },
    ],
  },
  // ---------------------------------------------------------------- вход
  {
    path: '/',
    component: () => import('@/layouts/AuthLayout.vue'),
    children: [
      { path: 'login', name: 'login', component: () => import('@/pages/auth/LoginPage.vue'), meta: { title: 'Вход', guestOnly: true } },
      { path: 'register', name: 'register', component: () => import('@/pages/auth/RegisterPage.vue'), meta: { title: 'Регистрация', guestOnly: true } },
      { path: 'forgot-password', name: 'forgot', component: () => import('@/pages/auth/ForgotPasswordPage.vue'), meta: { title: 'Восстановление пароля' } },
      { path: 'reset-password', name: 'reset', component: () => import('@/pages/auth/ResetPasswordPage.vue'), meta: { title: 'Новый пароль' } },
      { path: 'verify-email', name: 'verify', component: () => import('@/pages/auth/VerifyEmailPage.vue'), meta: { title: 'Подтверждение почты' } },
    ],
  },
  // ---------------------------------------------------------------- кабинет
  {
    path: '/app',
    component: () => import('@/layouts/AppLayout.vue'),
    meta: { auth: true },
    children: [
      { path: '', name: 'dashboard', component: () => import('@/pages/app/DashboardPage.vue'), meta: { title: 'Мои древа' } },
      { path: 'new', name: 'new-tree', component: () => import('@/pages/app/NewTreePage.vue'), meta: { title: 'Новое древо' } },
      { path: 'account', name: 'account', component: () => import('@/pages/app/AccountPage.vue'), meta: { title: 'Учётная запись' } },
    ],
  },
  // ---------------------------------------------------------------- древо
  {
    path: '/app/tree/:treeId',
    component: () => import('@/layouts/TreeLayout.vue'),
    meta: { auth: true },
    props: true,
    children: [
      { path: '', name: 'tree', redirect: (to) => ({ name: 'tree-chart', params: to.params }) },
      { path: 'overview', name: 'tree-overview', component: () => import('@/pages/tree/OverviewPage.vue'), meta: { title: 'Обзор' } },
      { path: 'chart', name: 'tree-chart', component: () => import('@/pages/tree/ChartPage.vue'), meta: { title: 'Древо', fullBleed: true } },
      { path: 'people', name: 'tree-people', component: () => import('@/pages/tree/PeoplePage.vue'), meta: { title: 'Персоны', fullBleed: true } },
      { path: 'people/:personId', name: 'tree-person', component: () => import('@/pages/tree/PersonPage.vue'), props: true, meta: { title: 'Персона' } },
      { path: 'events', name: 'tree-events', component: () => import('@/pages/tree/EventsPage.vue'), meta: { title: 'События' } },
      { path: 'places', name: 'tree-places', component: () => import('@/pages/tree/PlacesPage.vue'), meta: { title: 'Места' } },
      { path: 'media', name: 'tree-media', component: () => import('@/pages/tree/MediaPage.vue'), meta: { title: 'Медиа и документы' } },
      { path: 'sources', name: 'tree-sources', component: () => import('@/pages/tree/SourcesPage.vue'), meta: { title: 'Источники' } },
      { path: 'clans', name: 'tree-clans', component: () => import('@/pages/tree/ClansPage.vue'), meta: { title: 'Роды' } },
      { path: 'reports', name: 'tree-reports', component: () => import('@/pages/tree/ReportsPage.vue'), meta: { title: 'Росписи' } },
      { path: 'stats', name: 'tree-stats', component: () => import('@/pages/tree/StatsPage.vue'), meta: { title: 'Статистика' } },
      { path: 'check', name: 'tree-check', component: () => import('@/pages/tree/CheckPage.vue'), meta: { title: 'Проверка данных' } },
      { path: 'settings', name: 'tree-settings', component: () => import('@/pages/tree/TreeSettingsPage.vue'), meta: { title: 'Настройки древа' } },
    ],
  },
  { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('@/pages/public/NotFoundPage.vue'), meta: { title: 'Страница не найдена' } },
]

export function createAppRouter() {
  const router = createRouter({
    history: config.routerMode === 'history' ? createWebHistory(import.meta.env.BASE_URL) : createWebHashHistory(),
    routes,
    scrollBehavior(to, from, saved) {
      if (saved) return saved
      if (to.hash && !to.hash.startsWith('#/')) return { el: to.hash, behavior: 'smooth' }
      if (to.name === from.name) return false
      return { top: 0 }
    },
  })

  router.beforeEach(async (to) => {
    const auth = useAuthStore()
    await auth.init()
    if (to.matched.some((r) => r.meta.auth) && !auth.isAuthenticated) return { name: 'login', query: { redirect: to.fullPath } }
    // Гость может войти или зарегистрироваться (его древа перейдут в учётную запись)
    if (to.meta.guestOnly && auth.isAuthenticated && !auth.isGuest) return typeof to.query.redirect === 'string' ? to.query.redirect : { name: 'dashboard' }
  })

  router.afterEach((to) => {
    const t = [...to.matched].reverse().find((r) => r.meta.title)?.meta.title
    document.title = t ? `${t} · ${config.appName}` : config.appName
  })

  // После обновления приложения старые чанки исчезают — перезагружаем страницу
  router.onError((e, to) => {
    if (/Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(e?.message ?? '')) {
      if (!sessionStorage.getItem('rd:chunk-reload')) {
        sessionStorage.setItem('rd:chunk-reload', '1')
        if (config.routerMode === 'hash' && to?.fullPath) location.hash = '#' + to.fullPath
        location.reload()
      }
    }
  })
  return router
}
