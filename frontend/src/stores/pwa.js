import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'
import { config } from '@/app/config'

const LS_VERSION = 'rd:version'
const CHECK_INTERVAL = 30 * 60 * 1000

/**
 * PWA: установка на устройство, офлайн-режим, обновления.
 * Новая версия не включается сама — пользователь видит «Доступно обновление» и выбирает момент.
 */
export const usePwaStore = defineStore('pwa', () => {
  const needRefresh = ref(false)
  const offlineReady = ref(false)
  const checking = ref(false)
  const lastCheck = ref(null)
  const online = ref(typeof navigator === 'undefined' ? true : navigator.onLine)
  const installEvent = shallowRef(null)
  const installed = ref(false)
  const supported = typeof navigator !== 'undefined' && 'serviceWorker' in navigator
  /** Версия, с которой обновились (для «Что нового») */
  const updatedFrom = ref(null)
  const registration = shallowRef(null)
  let updateSW = null

  async function init() {
    installed.value = window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true
    window.addEventListener('online', () => (online.value = true))
    window.addEventListener('offline', () => (online.value = false))
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault()
      installEvent.value = e
    })
    window.addEventListener('appinstalled', () => {
      installed.value = true
      installEvent.value = null
    })

    try {
      const prev = localStorage.getItem(LS_VERSION)
      if (prev && prev !== config.version) updatedFrom.value = prev
      localStorage.setItem(LS_VERSION, config.version)
    } catch {
      /* ignore */
    }

    if (!supported || import.meta.env.DEV) return
    try {
      const { registerSW } = await import('virtual:pwa-register')
      updateSW = registerSW({
        immediate: true,
        onNeedRefresh: () => (needRefresh.value = true),
        onOfflineReady: () => (offlineReady.value = true),
        onRegisteredSW: (_url, r) => {
          registration.value = r ?? null
          if (r) setInterval(() => check(), CHECK_INTERVAL)
        },
        onRegisterError: (e) => console.warn('[pwa] регистрация не удалась', e),
      })
    } catch (e) {
      console.warn('[pwa] недоступно', e)
    }
  }

  /** Проверить обновления вручную. */
  async function check() {
    if (!registration.value || !navigator.onLine) return needRefresh.value
    checking.value = true
    try {
      await registration.value.update()
    } catch {
      /* офлайн или сервер недоступен */
    } finally {
      lastCheck.value = Date.now()
      checking.value = false
    }
    return needRefresh.value
  }

  /** Включить новую версию (страница перезагрузится). */
  async function applyUpdate(beforeReload) {
    await beforeReload?.()
    if (updateSW) await updateSW(true)
    else location.reload()
  }

  async function install() {
    const e = installEvent.value
    if (!e) return false
    e.prompt()
    const choice = await e.userChoice.catch(() => ({ outcome: 'dismissed' }))
    installEvent.value = null
    return choice.outcome === 'accepted'
  }

  return { supported, needRefresh, offlineReady, checking, lastCheck, online, installEvent, installed, updatedFrom, registration, init, check, applyUpdate, install }
})
