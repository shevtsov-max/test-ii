<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PasswordInput from '@/components/auth/PasswordInput.vue'
import OAuthButtons from '@/components/auth/OAuthButtons.vue'
import { useAuthStore } from '@/stores/auth'
import { api } from '@/api'
import { errorMessage } from '@/api/errors'
import { validatePassword } from '@/utils/password'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const form = ref({ name: '', email: '', password: '' })
const agree = ref(false)
const loading = ref(false)
const error = ref('')
const fields = ref({})

async function submit() {
  error.value = ''
  fields.value = {}
  const pw = validatePassword(form.value.password)
  if (pw) {
    fields.value = { password: pw }
    return
  }
  if (!agree.value) {
    error.value = 'Подтвердите согласие с условиями использования'
    return
  }
  loading.value = true
  try {
    await auth.register({ name: form.value.name.trim(), email: form.value.email.trim(), password: form.value.password })
    if (api.capabilities.emailFlows && !auth.user?.emailVerified) router.replace({ name: 'verify', query: { sent: '1' } })
    else router.replace(typeof route.query.redirect === 'string' && route.query.redirect.startsWith('/') ? route.query.redirect : { name: 'dashboard' })
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
    <h1 class="auth-title">Создайте учётную запись</h1>
    <p class="auth-sub">Бесплатно. Древо, фото и документы останутся с вами — их всегда можно выгрузить в файл.</p>

    <div v-if="auth.isGuest" class="auth-note auth-note--positive q-mb-md">
      <q-icon name="sym_r_verified" size="18px" />
      <span>Вы работали без регистрации — все созданные древа перейдут в новую учётную запись.</span>
    </div>

    <OAuthButtons />
    <div v-if="error" class="auth-error" role="alert"><q-icon name="sym_r_error" size="18px" />{{ error }}</div>

    <form class="auth-form" @submit.prevent="submit">
      <q-input v-model="form.name" label="Как вас зовут" autocomplete="name" outlined autofocus bottom-slots :error="!!fields.name" :error-message="fields.name">
        <template #prepend><q-icon name="sym_r_person" size="20px" /></template>
      </q-input>
      <q-input v-model="form.email" type="email" label="Электронная почта" autocomplete="email" outlined bottom-slots :error="!!fields.email" :error-message="fields.email">
        <template #prepend><q-icon name="sym_r_mail" size="20px" /></template>
      </q-input>
      <PasswordInput v-model="form.password" autocomplete="new-password" strength hint="Не короче 8 символов, буквы и цифры" :error="fields.password" />
      <q-checkbox v-model="agree" dense class="reg__agree">
        <span>
          Принимаю <router-link :to="{ name: 'terms' }" target="_blank">условия использования</router-link> и
          <router-link :to="{ name: 'privacy' }" target="_blank">политику конфиденциальности</router-link>
        </span>
      </q-checkbox>
      <q-btn
        type="submit"
        unelevated
        no-caps
        color="primary"
        label="Зарегистрироваться"
        class="auth-submit"
        :loading="loading"
        :disable="!form.email || !form.password"
      />
    </form>

    <div class="auth-foot">
      Уже есть учётная запись? <router-link :to="{ name: 'login', query: route.query.redirect ? { redirect: route.query.redirect } : {} }">Войти</router-link>
    </div>
  </div>
</template>

<style scoped>
.reg__agree {
  margin: 4px 0 6px;
  font-size: 13px;
  color: var(--ft-text-2);
  align-items: flex-start;
}
</style>
