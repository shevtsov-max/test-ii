import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { api } from '@/api'
import { hasLegacyTree } from '@/app/legacy'

const LS_TOKEN = 'rd:token'

/** Сессия пользователя: вход, регистрация, гостевой режим, профиль. */
export const useAuthStore = defineStore('auth', () => {
  /** @type {import('vue').Ref<import('@/domain/types').User | null>} */
  const user = ref(null)
  const token = ref(readToken())
  const ready = ref(false)

  const isAuthenticated = computed(() => !!user.value)
  const isGuest = computed(() => !!user.value?.guest)
  const displayName = computed(() => user.value?.name || user.value?.email || 'Гость')

  function readToken() {
    try {
      return localStorage.getItem(LS_TOKEN)
    } catch {
      return null
    }
  }
  function setSession(payload) {
    user.value = payload?.user ?? null
    token.value = payload?.token ?? null
    try {
      if (token.value) localStorage.setItem(LS_TOKEN, token.value)
      else localStorage.removeItem(LS_TOKEN)
    } catch {
      /* ignore */
    }
    return user.value
  }

  let initPromise = null
  /** Восстановить сессию при запуске. Если есть данные прежней версии — сразу гостевой вход. */
  function init() {
    initPromise ??= (async () => {
      api.auth.setUnauthorizedHandler(() => setSession(null))
      try {
        const me = await api.auth.me(token.value)
        if (me) user.value = me
        else setSession(null)
      } catch (e) {
        console.warn('[auth] сессия не восстановлена', e)
        // Офлайн с сервером: оставляем токен, пользователь увидит ошибку при загрузке данных
        if (api.mode === 'local') setSession(null)
      }
      if (!user.value && api.capabilities.guest && hasLegacyTree()) await continueAsGuest()
      ready.value = true
    })()
    return initPromise
  }

  async function login(email, password) {
    return setSession(await api.auth.login({ email, password }))
  }
  /** @param {{ name: string, email: string, password: string, consents: { document: string, version: string }[] }} input */
  async function register({ name, email, password, consents }) {
    const fromGuest = isGuest.value
    const oldToken = token.value
    const res = await api.auth.register({ name, email, password, consents }, { fromGuest })
    if (fromGuest && oldToken) api.auth.logout(oldToken).catch(() => {})
    return setSession(res)
  }
  async function continueAsGuest() {
    return setSession(await api.auth.continueAsGuest())
  }
  async function logout() {
    const t = token.value
    setSession(null)
    await api.auth.logout(t).catch(() => {})
  }
  async function requestPasswordReset(email) {
    return api.auth.requestPasswordReset(email)
  }
  async function resetPassword(resetToken, password) {
    return setSession(await api.auth.resetPassword(resetToken, password))
  }
  async function verifyEmail(t) {
    const r = await api.auth.verifyEmail(t)
    if (user.value) user.value = { ...user.value, emailVerified: true }
    return r
  }
  async function resendVerification() {
    return api.auth.resendVerification()
  }
  async function updateProfile(patch) {
    user.value = await api.auth.updateProfile(token.value, patch)
    return user.value
  }
  /** Принять новые редакции документов (после их обновления). */
  async function acceptDocuments(consents) {
    user.value = await api.auth.acceptDocuments(token.value, consents)
    return user.value
  }
  async function changePassword(current, next) {
    return api.auth.changePassword(token.value, { current, next })
  }
  async function deleteAccount(password) {
    await api.auth.deleteAccount(token.value, { password })
    setSession(null)
  }

  return {
    user,
    token,
    ready,
    isAuthenticated,
    isGuest,
    displayName,
    init,
    login,
    register,
    continueAsGuest,
    logout,
    requestPasswordReset,
    resetPassword,
    verifyEmail,
    resendVerification,
    updateProfile,
    acceptDocuments,
    changePassword,
    deleteAccount,
  }
})
