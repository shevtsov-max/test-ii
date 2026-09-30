<script setup>
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { errorMessage } from '@/api/errors'

const route = useRoute()
const auth = useAuthStore()
const email = ref(typeof route.query.email === 'string' ? route.query.email : '')
const loading = ref(false)
const error = ref('')
/** @type {import('vue').Ref<{ sent: boolean, devToken?: string | null } | null>} */
const result = ref(null)

async function submit() {
  error.value = ''
  loading.value = true
  try {
    result.value = await auth.requestPasswordReset(email.value.trim())
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div>
    <template v-if="!result">
      <router-link :to="{ name: 'login' }" class="fp__back"><q-icon name="sym_r_arrow_back" size="18px" />Ко входу</router-link>
      <h1 class="auth-title">Восстановление пароля</h1>
      <p class="auth-sub">Укажите почту, с которой регистрировались. Мы пришлём ссылку для создания нового пароля.</p>
      <div v-if="error" class="auth-error" role="alert"><q-icon name="sym_r_error" size="18px" />{{ error }}</div>
      <form class="auth-form" @submit.prevent="submit">
        <q-input v-model="email" type="email" label="Электронная почта" autocomplete="email" outlined autofocus>
          <template #prepend><q-icon name="sym_r_mail" size="20px" /></template>
        </q-input>
        <q-btn type="submit" unelevated no-caps color="primary" label="Отправить ссылку" class="auth-submit q-mt-md" :loading="loading" :disable="!email.includes('@')" />
      </form>
    </template>

    <div v-else class="auth-state">
      <div class="auth-state__icon"><q-icon name="sym_r_mark_email_read" size="30px" /></div>
      <h1 class="auth-title">Проверьте почту</h1>
      <p class="auth-sub">
        Если адрес <b>{{ email }}</b> зарегистрирован, на него придёт письмо со ссылкой. Ссылка действует один час. Не забудьте заглянуть в «Спам».
      </p>
      <template v-if="result.devToken !== undefined">
        <div class="auth-note auth-note--info">
          <q-icon name="sym_r_info" size="18px" />
          <span>
            Сейчас учётные записи хранятся в этом браузере, и письма не отправляются.
            <template v-if="result.devToken">Задайте новый пароль прямо здесь.</template>
            <template v-else>Учётной записи с такой почтой в этом браузере нет.</template>
          </span>
        </div>
        <q-btn
          v-if="result.devToken"
          unelevated
          no-caps
          color="primary"
          label="Задать новый пароль"
          class="auth-submit full-width q-mt-md"
          :to="{ name: 'reset', query: { token: result.devToken } }"
        />
      </template>
      <div class="auth-foot full-width">
        <a href="#" @click.prevent="result = null">Указать другую почту</a> · <router-link :to="{ name: 'login' }">Ко входу</router-link>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fp__back {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 18px;
  font-size: 13.5px;
  font-weight: 550;
  color: var(--ft-muted);
}
</style>
