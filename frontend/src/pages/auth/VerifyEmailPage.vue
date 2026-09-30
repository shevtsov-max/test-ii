<script setup>
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useQuasar } from 'quasar'
import { useAuthStore } from '@/stores/auth'
import { errorMessage } from '@/api/errors'

const $q = useQuasar()
const route = useRoute()
const auth = useAuthStore()
/** checking — проверяем ссылку, done — почта подтверждена, failed — ошибка, waiting — ждём письмо */
const state = ref(typeof route.query.token === 'string' ? 'checking' : 'waiting')
const error = ref('')
const resending = ref(false)

onMounted(async () => {
  if (state.value !== 'checking') return
  try {
    await auth.verifyEmail(route.query.token)
    state.value = 'done'
  } catch (e) {
    error.value = errorMessage(e)
    state.value = 'failed'
  }
})

async function resend() {
  resending.value = true
  try {
    await auth.resendVerification()
    $q.notify({ type: 'positive', message: 'Письмо отправлено ещё раз' })
  } catch (e) {
    $q.notify({ type: 'negative', message: errorMessage(e) })
  } finally {
    resending.value = false
  }
}
</script>

<template>
  <div class="auth-state">
    <template v-if="state === 'checking'">
      <q-spinner size="40px" color="primary" class="q-mb-lg" />
      <h1 class="auth-title">Проверяем ссылку…</h1>
    </template>
    <template v-else-if="state === 'done'">
      <div class="auth-state__icon"><q-icon name="sym_r_verified" size="30px" /></div>
      <h1 class="auth-title">Почта подтверждена</h1>
      <p class="auth-sub">Спасибо! Теперь вы сможете восстановить пароль и получать приглашения в древа родственников.</p>
      <q-btn unelevated no-caps color="primary" label="Перейти к моим древам" class="auth-submit full-width" :to="{ name: 'dashboard' }" />
    </template>
    <template v-else-if="state === 'failed'">
      <div class="auth-state__icon"><q-icon name="sym_r_link_off" size="30px" /></div>
      <h1 class="auth-title">Не удалось подтвердить почту</h1>
      <p class="auth-sub">{{ error }} Попробуйте запросить письмо ещё раз.</p>
      <q-btn v-if="auth.isAuthenticated && !auth.isGuest" unelevated no-caps color="primary" label="Отправить письмо ещё раз" class="auth-submit full-width" :loading="resending" @click="resend" />
      <q-btn v-else unelevated no-caps color="primary" label="Войти" class="auth-submit full-width" :to="{ name: 'login' }" />
    </template>
    <template v-else>
      <div class="auth-state__icon"><q-icon name="sym_r_forward_to_inbox" size="30px" /></div>
      <h1 class="auth-title">Подтвердите почту</h1>
      <p class="auth-sub">
        Мы отправили письмо на <b>{{ auth.user?.email || 'вашу почту' }}</b>. Перейдите по ссылке из письма — так мы убедимся, что адрес ваш. А пока можно
        начинать работу.
      </p>
      <q-btn unelevated no-caps color="primary" label="Начать работу" class="auth-submit full-width" :to="{ name: 'dashboard' }" />
      <div class="auth-foot full-width">
        Письмо не пришло? <a href="#" :class="{ disabled: resending }" @click.prevent="resend">Отправить ещё раз</a>
      </div>
    </template>
  </div>
</template>
