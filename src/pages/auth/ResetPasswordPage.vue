<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import PasswordInput from '@/components/auth/PasswordInput.vue'
import { useAuthStore } from '@/stores/auth'
import { errorMessage } from '@/api/errors'
import { validatePassword } from '@/utils/password'

const $q = useQuasar()
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const token = computed(() => (typeof route.query.token === 'string' ? route.query.token : ''))
const password = ref('')
const repeat = ref('')
const loading = ref(false)
const error = ref('')
const fields = ref({})

async function submit() {
  error.value = ''
  fields.value = {}
  const pw = validatePassword(password.value)
  if (pw) return (fields.value = { password: pw })
  if (password.value !== repeat.value) return (fields.value = { repeat: 'Пароли не совпадают' })
  loading.value = true
  try {
    await auth.resetPassword(token.value, password.value)
    $q.notify({ type: 'positive', message: 'Пароль изменён. Вы вошли в учётную запись.' })
    router.replace({ name: 'dashboard' })
  } catch (e) {
    error.value = errorMessage(e)
    fields.value = e.fields ?? {}
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div>
    <template v-if="token">
      <h1 class="auth-title">Новый пароль</h1>
      <p class="auth-sub">Придумайте пароль, который вы не используете на других сайтах.</p>
      <div v-if="error" class="auth-error" role="alert"><q-icon name="sym_r_error" size="18px" />{{ error }}</div>
      <form class="auth-form" @submit.prevent="submit">
        <PasswordInput v-model="password" label="Новый пароль" autocomplete="new-password" strength :error="fields.password" />
        <PasswordInput v-model="repeat" label="Повторите пароль" autocomplete="new-password" :error="fields.repeat" />
        <q-btn type="submit" unelevated no-caps color="primary" label="Сохранить пароль" class="auth-submit" :loading="loading" :disable="!password || !repeat" />
      </form>
    </template>
    <div v-else class="auth-state">
      <div class="auth-state__icon"><q-icon name="sym_r_link_off" size="30px" /></div>
      <h1 class="auth-title">Ссылка недействительна</h1>
      <p class="auth-sub">Возможно, она устарела или уже была использована. Запросите новую — это займёт минуту.</p>
      <q-btn unelevated no-caps color="primary" label="Запросить новую ссылку" class="auth-submit full-width" :to="{ name: 'forgot' }" />
    </div>
  </div>
</template>
