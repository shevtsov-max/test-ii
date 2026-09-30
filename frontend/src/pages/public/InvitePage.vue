<script setup>
/**
 * Приглашение по ссылке /invite/<token>: доступ к чужому древу (member) или продолжение ветки (delegation).
 * Незарегистрированный родственник регистрируется и возвращается сюда же, чтобы принять приглашение.
 */
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { api } from '@/api'
import { errorMessage } from '@/api/errors'
import { useAuthStore } from '@/stores/auth'
import { useTreesStore } from '@/stores/trees'

const props = defineProps({
  token: { type: String, required: true },
})

const $q = useQuasar()
const router = useRouter()
const auth = useAuthStore()
const trees = useTreesStore()

const supported = api.capabilities.delegation || api.capabilities.sharing
const inv = ref(null)
const loading = ref(supported)
const error = ref('')
const busy = ref(false)

const ROLE = { owner: 'владелец', editor: 'редактор', viewer: 'читатель' }
const signedIn = computed(() => auth.isAuthenticated && !auth.isGuest)
const back = computed(() => ({ redirect: router.resolve({ name: 'invite', params: { token: props.token } }).fullPath }))
const usable = computed(() => inv.value && inv.value.status === 'pending' && !inv.value.expired)
const persons = computed(() => {
  const n = inv.value?.persons ?? 0
  const m10 = n % 10
  const m100 = n % 100
  const w = m10 === 1 && m100 !== 11 ? 'человек' : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? 'человека' : 'человек'
  return `${n} ${w}`
})

onMounted(async () => {
  if (!supported) return
  try {
    inv.value = await api.invitations.get(props.token)
    if (!inv.value) error.value = 'Приглашение не найдено: его уже приняли или отозвали. Если нужно, попросите прислать новое.'
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    loading.value = false
  }
})

async function accept() {
  busy.value = true
  try {
    const r = await api.invitations.accept(props.token)
    await trees.fetch().catch(() => {})
    $q.notify({ type: 'positive', message: r.kind === 'delegation' ? 'Ветка теперь в ваших древах' : 'Древо добавлено в ваш список' })
    router.replace({ name: 'tree-chart', params: { treeId: r.treeId } })
  } catch (e) {
    $q.notify({ type: 'negative', message: errorMessage(e) })
  } finally {
    busy.value = false
  }
}
async function decline() {
  busy.value = true
  try {
    await api.invitations.decline(props.token)
    inv.value = { ...inv.value, status: 'declined' }
    $q.notify({ message: 'Приглашение отклонено. Мы сообщим об этом отправителю.' })
  } catch (e) {
    $q.notify({ type: 'negative', message: errorMessage(e) })
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="iv">
    <div class="iv__card">
      <template v-if="!supported">
        <q-icon name="sym_r_cloud_off" size="40px" class="iv__icon" />
        <h1 class="iv__title">Приглашения доступны в облачной версии</h1>
        <p class="iv__text">В этой версии древо хранится только в вашем браузере, поэтому приглашения не работают.</p>
        <q-btn unelevated no-caps color="primary" label="На главную" :to="{ name: 'home' }" />
      </template>

      <div v-else-if="loading" class="iv__loading"><q-spinner size="32px" color="primary" /></div>

      <template v-else-if="error">
        <q-icon name="sym_r_link_off" size="40px" class="iv__icon" />
        <h1 class="iv__title">Не удалось открыть приглашение</h1>
        <p class="iv__text">{{ error }}</p>
        <q-btn unelevated no-caps color="primary" label="На главную" :to="{ name: 'home' }" />
      </template>

      <template v-else-if="inv">
        <q-icon :name="inv.kind === 'delegation' ? 'sym_r_forward_to_inbox' : 'sym_r_group_add'" size="40px" class="iv__icon" />
        <h1 v-if="inv.kind === 'delegation'" class="iv__title">{{ inv.inviterName }} предлагает вам продолжить ветку семейного древа</h1>
        <h1 v-else class="iv__title">{{ inv.inviterName }} приглашает вас в древо «{{ inv.treeName }}»</h1>

        <blockquote v-if="inv.message" class="iv__quote">{{ inv.message }}</blockquote>

        <div class="iv__facts">
          <div><span>Древо</span><b>{{ inv.treeName }}</b></div>
          <div v-if="inv.kind === 'delegation' && inv.rootName"><span>Ветка</span><b>{{ inv.rootName }} и потомки · {{ persons }}</b></div>
          <div v-if="inv.kind === 'member' && inv.role"><span>Роль</span><b>{{ ROLE[inv.role] ?? inv.role }}</b></div>
          <div v-if="inv.email"><span>Для</span><b>{{ inv.email }}</b></div>
        </div>

        <ul v-if="inv.kind === 'delegation'" class="iv__how">
          <li><q-icon name="sym_r_account_tree" size="18px" />У вас появится своё древо с этой веткой — дополняйте его людьми, датами, фото и документами.</li>
          <li><q-icon name="sym_r_visibility" size="18px" />{{ inv.inviterName }} будет видеть ветку в своём древе, но менять её не сможет.</li>
          <li><q-icon name="sym_r_content_copy" size="18px" />Если {{ inv.inviterName }} скопирует ветку себе, ваше древо не изменится.</li>
        </ul>

        <template v-if="!usable">
          <div class="iv__state">
            <q-icon name="sym_r_info" size="18px" />
            <span v-if="inv.expired">Срок приглашения истёк — попросите прислать новое.</span>
            <span v-else-if="inv.status === 'declined'">Приглашение отклонено.</span>
            <span v-else>Приглашение уже использовано или отозвано.</span>
          </div>
          <q-btn unelevated no-caps color="primary" :label="signedIn ? 'Мои древа' : 'На главную'" :to="{ name: signedIn ? 'dashboard' : 'home' }" />
        </template>

        <template v-else-if="signedIn">
          <div class="iv__actions">
            <q-btn unelevated no-caps color="primary" size="lg" :label="inv.kind === 'delegation' ? 'Продолжить ветку' : 'Принять приглашение'" :loading="busy" @click="accept" />
            <q-btn flat no-caps label="Отклонить" :disable="busy" @click="decline" />
          </div>
          <p class="iv__small">Вы вошли как {{ auth.user.email }}.</p>
        </template>

        <template v-else>
          <div class="iv__actions">
            <q-btn unelevated no-caps color="primary" size="lg" label="Зарегистрироваться и принять" :to="{ name: 'register', query: back }" />
            <q-btn outline no-caps color="primary" size="lg" label="У меня есть учётная запись" :to="{ name: 'login', query: back }" />
          </div>
          <p class="iv__small">Регистрация бесплатна и займёт минуту. После неё вы вернётесь на эту страницу.</p>
        </template>
      </template>
    </div>
  </div>
</template>

<style scoped lang="scss">
.iv {
  display: flex;
  justify-content: center;
  padding: 48px 16px 80px;
}
.iv__card {
  width: 100%;
  max-width: 560px;
  padding: 32px;
  border-radius: var(--ft-radius-xl);
  background: var(--ft-surface);
  border: 1px solid var(--ft-border);
  box-shadow: var(--ft-shadow);
  text-align: center;
}
.iv__loading {
  display: grid;
  place-items: center;
  min-height: 200px;
}
.iv__icon {
  color: var(--ft-primary-text);
}
.iv__title {
  margin: 14px 0 10px;
  font-family: var(--ft-font-display);
  font-size: clamp(22px, 3.4vw, 28px);
  font-weight: 600;
  line-height: 1.2;
}
.iv__text {
  color: var(--ft-text-2);
  margin: 0 0 20px;
}
.iv__quote {
  margin: 14px 0;
  padding: 12px 16px;
  border-left: 3px solid var(--ft-primary);
  border-radius: 0 10px 10px 0;
  background: var(--ft-primary-soft);
  text-align: left;
  font-style: italic;
  white-space: pre-line;
  color: var(--ft-text);
}
.iv__facts {
  display: grid;
  gap: 6px;
  margin: 16px 0;
  text-align: left;
  > div {
    display: flex;
    gap: 12px;
    padding: 8px 12px;
    border-radius: 10px;
    background: var(--ft-surface-2);
    font-size: 14px;
  }
  span {
    width: 64px;
    flex: none;
    color: var(--ft-muted);
  }
}
.iv__how {
  list-style: none;
  margin: 0 0 20px;
  padding: 0;
  text-align: left;
  font-size: 13.5px;
  line-height: 1.5;
  color: var(--ft-text-2);
  li {
    display: flex;
    gap: 10px;
    padding: 6px 0;
  }
  .q-icon {
    color: var(--ft-primary-text);
    flex: none;
    margin-top: 1px;
  }
}
.iv__state {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin: 0 0 16px;
  color: var(--ft-text-2);
}
.iv__actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.iv__small {
  margin: 12px 0 0;
  font-size: 12.5px;
  color: var(--ft-muted);
}
@media (max-width: 520px) {
  .iv__card {
    padding: 24px 18px;
  }
}
</style>
