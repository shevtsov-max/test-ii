<script setup>
/**
 * Просьба принять документы, если пользователь их ещё не принимал (вход через внешний сервис)
 * или вышла новая редакция (версии — src/app/legal.js). Без согласия пользоваться сервисом нельзя: можно только выйти.
 */
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { errorMessage } from '@/api/errors'
import { DOCUMENT_ROUTES, DOCUMENT_TITLES, consentsFor } from '@/app/legal'

const auth = useAuthStore()
const router = useRouter()
const pending = computed(() => (auth.user && !auth.user.guest ? (auth.user.pendingConsents ?? []) : []))
const open = computed(() => pending.value.length > 0)
const agree = ref(false)
const loading = ref(false)
const error = ref('')

async function accept() {
  loading.value = true
  error.value = ''
  try {
    await auth.acceptDocuments(consentsFor(pending.value))
    agree.value = false
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    loading.value = false
  }
}
async function logout() {
  await auth.logout()
  router.replace({ name: 'login' })
}
</script>

<template>
  <q-dialog :model-value="open" persistent>
    <q-card class="lc">
      <div class="lc__head">
        <q-icon name="sym_r_gavel" size="26px" />
        <div class="ft-h2">Примите условия сервиса</div>
      </div>
      <div class="lc__body">
        <p>Чтобы продолжить, ознакомьтесь с документами — они обновились или вы ещё не принимали их:</p>
        <ul>
          <li v-for="d in pending" :key="d">
            <router-link :to="{ name: DOCUMENT_ROUTES[d] }" target="_blank">{{ DOCUMENT_TITLES[d] }}</router-link>
          </li>
        </ul>
        <q-checkbox v-model="agree" dense class="lc__agree">
          <span>Мне есть 18 лет, я принимаю эти документы и даю согласие на обработку персональных данных на их условиях</span>
        </q-checkbox>
        <div v-if="error" class="auth-error q-mt-md" role="alert"><q-icon name="sym_r_error" size="18px" />{{ error }}</div>
      </div>
      <div class="lc__foot">
        <q-btn flat no-caps label="Выйти" @click="logout" />
        <q-btn unelevated no-caps color="primary" label="Принять и продолжить" :disable="!agree" :loading="loading" @click="accept" />
      </div>
    </q-card>
  </q-dialog>
</template>

<style scoped lang="scss">
.lc {
  width: 480px;
  max-width: 96vw;
}
.lc__head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px 24px 8px;
  .q-icon {
    color: var(--ft-primary-text);
  }
}
.lc__body {
  padding: 4px 24px 8px;
  color: var(--ft-text-2);
  font-size: 14px;
  line-height: 1.55;
  ul {
    margin: 6px 0 14px;
    padding-left: 20px;
  }
}
.lc__agree {
  align-items: flex-start;
  font-size: 13.5px;
}
.lc__foot {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 16px 16px;
}
</style>
