<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PasswordInput from '@/components/auth/PasswordInput.vue'
import OAuthButtons from '@/components/auth/OAuthButtons.vue'
import { useAuthStore } from '@/stores/auth'
import { api } from '@/api'
import { errorMessage } from '@/api/errors'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const email = ref(typeof route.query.email === 'string' ? route.query.email : '')
const password = ref('')
const loading = ref(false)
const error = ref('')
const fields = ref({})

const next = () => (typeof route.query.redirect === 'string' && route.query.redirect.startsWith('/') ? route.query.redirect : { name: 'dashboard' })

async function submit() {
  error.value = ''
  fields.value = {}
  loading.value = true
  try {
    await auth.login(email.value.trim(), password.value)
    router.replace(next())
  } catch (e) {
    error.value = errorMessage(e)
    fields.value = e.fields ?? {}
  } finally {
    loading.value = false
  }
}
async function guest() {
  loading.value = true
  try {
    if (!auth.isGuest) await auth.continueAsGuest()
    router.replace(next())
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div>
    <h1 class="auth-title">Вход</h1>
    <p class="auth-sub">Рады видеть вас снова. Ваше древо ждёт.</p>

    <OAuthButtons />
    <div v-if="error" class="auth-error" role="alert"><q-icon name="sym_r_error" size="18px" />{{ error }}</div>

    <form class="auth-form" @submit.prevent="submit">
      <q-input
        v-model="email"
        type="email"
        label="Электронная почта"
        autocomplete="email"
        outlined
        autofocus
        bottom-slots
        :error="!!fields.email"
        :error-message="fields.email"
      >
        <template #prepend><q-icon name="sym_r_mail" size="20px" /></template>
      </q-input>
      <PasswordInput v-model="password" :error="fields.password" />
      <div class="row justify-end" style="margin-top: -8px">
        <router-link :to="{ name: 'forgot', query: email ? { email } : {} }" class="login__forgot">Забыли пароль?</router-link>
      </div>
      <q-btn type="submit" unelevated no-caps color="primary" label="Войти" class="auth-submit" :loading="loading" :disable="!email || !password" />
    </form>

    <template v-if="api.capabilities.guest">
      <div class="auth-or">или</div>
      <q-btn outline no-caps class="full-width" style="height: 44px" icon="sym_r_person" label="Продолжить без регистрации" :disable="loading" @click="guest" />
      <div class="auth-note q-mt-md">
        <q-icon name="sym_r_info" size="18px" />
        <span>
          Без регистрации древо хранится только в этом браузере. Зарегистрироваться можно позже — всё созданное сохранится.
          Продолжая, вы принимаете <router-link :to="{ name: 'terms' }" target="_blank">Пользовательское соглашение</router-link>.
        </span>
      </div>
    </template>

    <div class="auth-foot">
      Нет учётной записи?
      <router-link :to="{ name: 'register', query: route.query.redirect ? { redirect: route.query.redirect } : {} }">Зарегистрироваться</router-link>
    </div>
  </div>
</template>

<style scoped>
.login__forgot {
  font-size: 13px;
  font-weight: 550;
}
</style>
