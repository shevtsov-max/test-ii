<script setup>
/**
 * Передача ветки родственнику: персона, её потомки и их супруги уходят в древо родственника,
 * у владельца остаются только для просмотра (с правками родственника). Здесь же — ожидающее приглашение
 * (ссылка, отзыв) и уже переданная ветка (клонирование себе).
 */
import { computed, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import PersonAvatar from '@/components/person/PersonAvatar.vue'
import { useTreeStore } from '@/stores/tree'
import { useUiStore } from '@/stores/ui'
import { usePersonActions } from '@/composables/usePersonActions'
import { errorMessage } from '@/api/errors'
import { branchPersonIds } from '@/domain/branches'
import { shortName } from '@/domain/names'
import { persons as personsText } from '@/utils/format'

const $q = useQuasar()
const tree = useTreeStore()
const ui = useUiStore()
const actions = usePersonActions()

const open = computed({
  get: () => ui.delegateDialog.open,
  set: (v) => (ui.delegateDialog.open = v),
})
const target = computed(() => ui.delegateDialog.personId)
const pending = computed(() => (target.value ? tree.pendingDelegationOf(target.value) : null))
const active = computed(() => (target.value ? tree.delegationOf(target.value) : null))
/** С кого начинается ветка: у уже переданной — её корень, иначе выбранная персона */
const p = computed(() => tree.person(active.value?.rootPersonId ?? pending.value?.rootPersonId ?? target.value))
const branch = computed(() => (p.value ? branchPersonIds(tree.tree, p.value.id).map((id) => tree.person(id)) : []))
const homeInside = computed(() => !!tree.homeId && branch.value.some((x) => x.id === tree.homeId))

const form = ref({ email: '', message: '' })
const confirmRight = ref(false)
const busy = ref(false)
/** Ссылка только что созданного приглашения */
const created = ref(null)

watch(open, (o) => {
  if (!o) return
  form.value = { email: '', message: '' }
  confirmRight.value = false
  created.value = null
})

const link = computed(() => created.value?.link ?? pending.value?.link ?? '')
const validEmail = computed(() => !form.value.email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.value.email.trim()))

async function submit() {
  busy.value = true
  try {
    created.value = await tree.delegate(p.value.id, { email: form.value.email.trim(), message: form.value.message.trim() })
    if (form.value.email) $q.notify({ type: 'positive', message: `Приглашение отправлено на ${form.value.email.trim()}` })
  } catch (e) {
    $q.notify({ type: 'negative', message: errorMessage(e) })
  } finally {
    busy.value = false
  }
}
async function copy() {
  try {
    await navigator.clipboard.writeText(link.value)
    $q.notify({ type: 'positive', message: 'Ссылка скопирована', timeout: 1500 })
  } catch {
    $q.notify({ message: 'Скопируйте ссылку вручную' })
  }
}
const canShare = typeof navigator !== 'undefined' && !!navigator.share
function share() {
  navigator
    .share({ title: 'Продолжи нашу ветку семейного древа', text: `Приглашаю продолжить ветку «${shortName(p.value)}» в семейном древе`, url: link.value })
    .catch(() => {})
}
async function revoke() {
  const ok = await actions.confirm({
    title: 'Отозвать приглашение?',
    message: 'Ссылка перестанет работать. Ветка останется в вашем древе, её снова можно будет править.',
    ok: { label: 'Отозвать', color: 'negative' },
  })
  if (!ok) return
  busy.value = true
  try {
    await tree.revokeDelegation(pending.value.id)
    created.value = null
    $q.notify({ message: 'Приглашение отозвано' })
  } catch (e) {
    $q.notify({ type: 'negative', message: errorMessage(e) })
  } finally {
    busy.value = false
  }
}
async function cloneBack() {
  if (await actions.cloneBranch(active.value)) open.value = false
}
</script>

<template>
  <q-dialog v-model="open" :maximized="$q.screen.lt.sm" transition-show="jump-up">
    <q-card v-if="p" class="dg">
      <header class="dg__head">
        <div class="col">
          <div class="ft-h2">{{ active ? 'Ветка передана' : 'Передать ветку родственнику' }}</div>
          <div class="text-muted" style="font-size: 13px">{{ shortName(p) }}, потомки и их супруги · {{ personsText(branch.length) }}</div>
        </div>
        <q-btn v-close-popup flat round dense icon="sym_r_close" aria-label="Закрыть" />
      </header>

      <div class="dg__body ft-scroll">
        <div class="dg__people">
          <div v-for="x in branch.slice(0, 12)" :key="x.id" class="dg__person">
            <PersonAvatar :person="x" :size="28" />
            <span class="ellipsis-1">{{ shortName(x) }}</span>
          </div>
          <div v-if="branch.length > 12" class="dg__more">и ещё {{ branch.length - 12 }}</div>
        </div>

        <!-- Уже передана -->
        <template v-if="active">
          <div class="dg__status">
            <q-icon name="sym_r_lock" size="20px" />
            <div>
              <b>Ветку ведёт {{ active.delegateName || 'родственник' }}</b>
              <span>В вашем древе она показывается из его древа — со всеми новыми людьми и фото, но только для просмотра.</span>
            </div>
          </div>
          <p class="dg__text">
            Чтобы править ветку самому, склонируйте её себе: текущая версия станет обычной частью вашего древа. Древо родственника не изменится, но его
            новые правки сюда больше попадать не будут.
          </p>
        </template>

        <!-- Приглашение создано или ждёт ответа -->
        <template v-else-if="created || pending">
          <div class="dg__status dg__status--pending">
            <q-icon name="sym_r_schedule_send" size="20px" />
            <div>
              <b>{{ (created?.delegation ?? pending)?.email ? `Приглашение отправлено на ${(created?.delegation ?? pending).email}` : 'Приглашение создано' }}</b>
              <span>Пока родственник не принял приглашение, ветку можно править. Ссылка действует 30 дней.</span>
            </div>
          </div>
          <div v-if="link" class="dg__link">
            <q-input :model-value="link" dense outlined readonly class="col" @focus="(e) => e.target.select()" />
            <q-btn unelevated no-caps color="primary" icon="sym_r_content_copy" label="Копировать" @click="copy" />
            <q-btn v-if="canShare" outline no-caps color="primary" icon="sym_r_share" aria-label="Поделиться" @click="share" />
          </div>
          <p class="dg__text">Отправьте ссылку в мессенджере или письмом. По ней родственник зарегистрируется (если ещё нет учётной записи) и примет ветку.</p>
        </template>

        <!-- Новая передача -->
        <template v-else>
          <ul class="dg__how">
            <li><q-icon name="sym_r_forward_to_inbox" size="18px" />Родственник получит своё древо с копией ветки и продолжит её сам.</li>
            <li><q-icon name="sym_r_visibility" size="18px" />У вас ветка останется на месте — с его новыми данными, но только для просмотра.</li>
            <li><q-icon name="sym_r_content_copy" size="18px" />В любой момент ветку можно склонировать себе и дальше править самому.</li>
            <li><q-icon name="sym_r_family_restroom" size="18px" />Родители этой персоны и остальное древо остаются вашими.</li>
          </ul>
          <div v-if="homeInside" class="dg__warn">
            <q-icon name="sym_r_warning" size="18px" />
            <span>В ветку входите вы сами («Это Вы»). Обычно передают ветку дальнего родственника — проверьте, ту ли персону вы выбрали.</span>
          </div>
          <q-input v-model="form.email" type="email" outlined dense label="Почта родственника (необязательно)" :error="!validEmail" error-message="Проверьте адрес" hint="Без почты получите ссылку, чтобы отправить её самостоятельно" />
          <q-input v-model="form.message" outlined dense autogrow maxlength="2000" label="Сообщение (необязательно)" placeholder="Денис, продолжишь нашу ветку? Ты лучше знаешь своих." />
          <q-checkbox v-model="confirmRight" dense class="dg__agree">
            <span>Я передаю сведения о родственниках члену семьи для ведения семейного древа и отвечаю за это решение</span>
          </q-checkbox>
        </template>
      </div>

      <footer class="dg__foot">
        <template v-if="active">
          <q-btn v-close-popup flat no-caps label="Закрыть" />
          <q-btn unelevated no-caps color="primary" icon="sym_r_content_copy" label="Склонировать себе" @click="cloneBack" />
        </template>
        <template v-else-if="created || pending">
          <q-btn v-if="pending" flat no-caps color="negative" label="Отозвать" :loading="busy" @click="revoke" />
          <q-space />
          <q-btn v-close-popup unelevated no-caps color="primary" label="Готово" class="q-px-lg" />
        </template>
        <template v-else>
          <q-btn v-close-popup flat no-caps label="Отмена" />
          <q-btn
            unelevated
            no-caps
            color="primary"
            :icon="form.email ? 'sym_r_send' : 'sym_r_link'"
            :label="form.email ? 'Отправить приглашение' : 'Создать ссылку'"
            :loading="busy"
            :disable="!confirmRight || !validEmail"
            @click="submit"
          />
        </template>
      </footer>
    </q-card>
  </q-dialog>
</template>

<style scoped lang="scss">
.dg {
  width: 560px;
  max-width: 96vw;
  max-height: 92vh;
  display: flex;
  flex-direction: column;
}
.dg__head {
  display: flex;
  align-items: flex-start;
  padding: 18px 18px 8px 22px;
}
.dg__body {
  flex: 1;
  overflow-y: auto;
  padding: 6px 22px 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.dg__people {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.dg__person {
  display: flex;
  align-items: center;
  gap: 6px;
  max-width: 200px;
  padding: 3px 10px 3px 3px;
  border-radius: 999px;
  background: var(--ft-surface-2);
  border: 1px solid var(--ft-border);
  font-size: 12.5px;
}
.dg__more {
  align-self: center;
  font-size: 12.5px;
  color: var(--ft-muted);
}
.dg__how {
  list-style: none;
  margin: 0;
  padding: 0;
  font-size: 13.5px;
  line-height: 1.5;
  color: var(--ft-text-2);
  li {
    display: flex;
    gap: 10px;
    padding: 4px 0;
  }
  .q-icon {
    color: var(--ft-primary-text);
    flex: none;
    margin-top: 1px;
  }
}
.dg__status {
  display: flex;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--ft-info-soft);
  font-size: 13.5px;
  line-height: 1.45;
  .q-icon {
    color: var(--ft-info);
    flex: none;
  }
  div {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  span {
    color: var(--ft-text-2);
  }
}
.dg__status--pending {
  background: var(--ft-warning-soft);
  .q-icon {
    color: var(--ft-warning);
  }
}
.dg__warn {
  display: flex;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 10px;
  background: var(--ft-warning-soft);
  font-size: 12.5px;
  line-height: 1.45;
  .q-icon {
    color: var(--ft-warning);
    flex: none;
  }
}
.dg__link {
  display: flex;
  gap: 8px;
  align-items: center;
}
.dg__text {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--ft-text-2);
}
.dg__agree {
  align-items: flex-start;
  font-size: 13px;
  color: var(--ft-text-2);
}
.dg__foot {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 18px 16px;
  border-top: 1px solid var(--ft-border);
}
@media (max-width: 520px) {
  .dg__link {
    flex-wrap: wrap;
  }
}
</style>
