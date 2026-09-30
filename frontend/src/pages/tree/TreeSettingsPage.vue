<script setup>
/** Настройки древа: сведения, «Это Вы», дополнительные поля, доступ, импорт/экспорт, удаление. */
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import PageHeader from '@/components/ui/PageHeader.vue'
import PersonSelect from '@/components/person/PersonSelect.vue'
import PersonAvatar from '@/components/person/PersonAvatar.vue'
import { useTreeStore } from '@/stores/tree'
import { useTreesStore } from '@/stores/trees'
import { useTreeNav } from '@/composables/useTreeNav'
import { api } from '@/api'
import { errorMessage } from '@/api/errors'
import { CUSTOM_FIELD_TYPES, uid } from '@/domain/model'
import { downloadBackup, downloadGedcom, readTreeFile } from '@/utils/backup'
import { pickFiles } from '@/utils/files'
import { persons as personsText, timeAgo } from '@/utils/format'
import { usePersonActions } from '@/composables/usePersonActions'
import { useUiStore } from '@/stores/ui'
import { shortName } from '@/domain/names'

const $q = useQuasar()
const router = useRouter()
const tree = useTreeStore()
const trees = useTreesStore()
const nav = useTreeNav()
const ui = useUiStore()
const personActions = usePersonActions()

const SECTIONS = [
  { id: 'general', label: 'Основное', icon: 'sym_r_info' },
  { id: 'fields', label: 'Дополнительные поля', icon: 'sym_r_list_alt' },
  { id: 'sharing', label: 'Совместный доступ', icon: 'sym_r_group_add' },
  ...(api.capabilities.delegation ? [{ id: 'branches', label: 'Переданные ветки', icon: 'sym_r_forward_to_inbox' }] : []),
  { id: 'export', label: 'Экспорт', icon: 'sym_r_download' },
  { id: 'import', label: 'Импорт', icon: 'sym_r_upload' },
  { id: 'danger', label: 'Удаление', icon: 'sym_r_delete' },
]
const scrollTo = (id) => document.getElementById(`ts-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

// ------------------------------------------------------------------ основное
const name = ref('')
const description = ref('')
watch(
  () => [tree.tree?.name, tree.tree?.description],
  ([n, d]) => {
    name.value = n ?? ''
    description.value = d ?? ''
  },
  { immediate: true },
)
function saveInfo() {
  const n = name.value.trim()
  if (!n) {
    name.value = tree.tree.name
    return
  }
  if (n === tree.tree.name && description.value === tree.tree.description) return
  tree.updateInfo({ name: n, description: description.value })
  trees.patchSummary(tree.treeId, { name: n })
}
const homeId = computed({
  get: () => tree.homeId,
  set: (id) => id && id !== tree.homeId && tree.setHome(id),
})

// ------------------------------------------------------------------ поля
const newField = ref({ label: '', type: 'text' })
function addField() {
  const label = newField.value.label.trim()
  if (!label) return
  tree.saveCustomField({ id: uid('cf'), label, type: newField.value.type })
  newField.value = { label: '', type: 'text' }
}
const usage = (fid) => tree.persons.filter((p) => p.custom?.[fid]).length
function removeField(f) {
  const n = usage(f.id)
  $q.dialog({
    title: `Удалить поле «${f.label}»?`,
    message: n ? `Значения у ${personsText(n)} будут удалены. Действие можно отменить (Ctrl+Z).` : 'Поле пока нигде не заполнено.',
    cancel: { flat: true, label: 'Отмена', noCaps: true },
    ok: { unelevated: true, label: 'Удалить', color: 'negative', noCaps: true },
  }).onOk(() => tree.removeCustomField(f.id))
}

// ------------------------------------------------------------------ доступ
const ROLES = [
  { value: 'owner', label: 'Владелец', text: 'Всё, включая удаление древа и управление доступом' },
  { value: 'editor', label: 'Редактор', text: 'Добавляет и изменяет персоны, фото и источники' },
  { value: 'viewer', label: 'Читатель', text: 'Только просмотр' },
]
const canShare = api.capabilities.sharing
const members = ref([])
const invite = ref({ email: '', role: 'editor' })
const inviting = ref(false)
async function loadMembers() {
  if (!canShare || !tree.treeId) return
  try {
    members.value = await api.sharing.members(tree.treeId)
  } catch (e) {
    $q.notify({ type: 'negative', message: errorMessage(e) })
  }
}
watch(() => tree.treeId, loadMembers, { immediate: true })
async function sendInvite() {
  inviting.value = true
  try {
    await api.sharing.invite(tree.treeId, invite.value.email.trim(), invite.value.role)
    $q.notify({ type: 'positive', message: `Приглашение отправлено на ${invite.value.email}` })
    invite.value.email = ''
    await loadMembers()
  } catch (e) {
    $q.notify({ type: 'negative', message: errorMessage(e) })
  } finally {
    inviting.value = false
  }
}
async function setRole(m, role) {
  try {
    await api.sharing.updateRole(m.id, role)
    await loadMembers()
  } catch (e) {
    $q.notify({ type: 'negative', message: errorMessage(e) })
  }
}
async function removeMember(m) {
  try {
    await api.sharing.remove(m.id)
    await loadMembers()
  } catch (e) {
    $q.notify({ type: 'negative', message: errorMessage(e) })
  }
}

// ------------------------------------------------------------------ переданные ветки
const DELEGATION_STATUS = {
  pending: { label: 'Ждёт ответа', tone: 'warning' },
  active: { label: 'Ведёт родственник', tone: 'info' },
  cloned: { label: 'Склонирована вами', tone: '' },
  declined: { label: 'Отклонено', tone: '' },
  revoked: { label: 'Отозвано', tone: '' },
  ended: { label: 'Возвращена', tone: '' },
}
const rootName = (d) => shortName(tree.person(d.rootPersonId)) || 'Персона удалена'
const delegationWho = (d) => {
  if (d.status === 'active') return d.delegateName ? `ведёт ${d.delegateName}` : 'ведёт родственник'
  if (d.status === 'pending') return d.email ? `приглашение на ${d.email}` : 'приглашение по ссылке'
  if (d.status === 'ended') return 'родственник удалил своё древо — ветка снова ваша'
  return d.delegateName ?? d.email ?? ''
}
async function copyDelegationLink(d) {
  try {
    await navigator.clipboard.writeText(d.link)
    $q.notify({ type: 'positive', message: 'Ссылка скопирована', timeout: 1500 })
  } catch {
    $q.notify({ message: d.link, timeout: 8000 })
  }
}
async function revokeDelegation(d) {
  try {
    await tree.revokeDelegation(d.id)
    $q.notify({ message: 'Приглашение отозвано' })
  } catch (e) {
    $q.notify({ type: 'negative', message: errorMessage(e) })
  }
}

// ------------------------------------------------------------------ экспорт
const ged = ref({ hideLiving: false, excludePrivate: true })
const exporting = ref(false)
async function exportJson() {
  exporting.value = true
  try {
    await tree.flush()
    await downloadBackup(tree.tree)
  } catch (e) {
    $q.notify({ type: 'negative', message: errorMessage(e) })
  } finally {
    exporting.value = false
  }
}
const exportGed = () => downloadGedcom(tree.tree, ged.value)

// ------------------------------------------------------------------ импорт
const importing = ref(false)
async function importAsNew() {
  const [file] = await pickFiles('.json,.ged,.gedcom', false)
  if (!file) return
  importing.value = true
  try {
    const s = await trees.importFile(file)
    $q.notify({ type: 'positive', message: `Создано древо «${s.name}»` })
    router.push({ name: 'tree-overview', params: { treeId: s.id } })
  } catch (e) {
    $q.notify({ type: 'negative', message: errorMessage(e) })
  } finally {
    importing.value = false
  }
}
async function importReplace() {
  const [file] = await pickFiles('.json,.ged,.gedcom', false)
  if (!file) return
  importing.value = true
  try {
    const data = await readTreeFile(file, tree.treeId)
    const n = Object.keys(data.persons).length
    $q.dialog({
      title: 'Заменить данные древа?',
      message: `Сейчас в древе ${personsText(tree.count)}, в файле — ${personsText(n)}. Текущие данные будут заменены. Отменить можно сразу после импорта (Ctrl+Z).`,
      cancel: { flat: true, label: 'Отмена', noCaps: true },
      ok: { unelevated: true, label: 'Заменить', color: 'negative', noCaps: true },
    }).onOk(() => {
      tree.replaceData(data)
      $q.notify({ type: 'positive', message: 'Данные заменены', actions: [{ label: 'Отменить', color: 'white', noCaps: true, handler: () => tree.undo() }] })
    })
  } catch (e) {
    $q.notify({ type: 'negative', message: errorMessage(e) })
  } finally {
    importing.value = false
  }
}

// ------------------------------------------------------------------ опасная зона
async function duplicate() {
  try {
    await tree.flush()
    const s = await trees.duplicate(tree.treeId)
    $q.notify({ type: 'positive', message: `Создана копия «${s.name}»`, actions: [{ label: 'Открыть', color: 'white', noCaps: true, handler: () => router.push({ name: 'tree-overview', params: { treeId: s.id } }) }] })
  } catch (e) {
    $q.notify({ type: 'negative', message: errorMessage(e) })
  }
}
function removeTree() {
  const treeName = tree.tree.name
  $q.dialog({
    title: 'Удалить древо безвозвратно?',
    message: `Будут удалены ${personsText(tree.count)}, все фото и документы. Чтобы подтвердить, введите название древа: «${treeName}»`,
    prompt: { model: '', type: 'text', outlined: true, isValid: (v) => v.trim() === treeName.trim() },
    cancel: { flat: true, label: 'Отмена', noCaps: true },
    ok: { unelevated: true, label: 'Удалить навсегда', color: 'negative', noCaps: true },
  }).onOk(async () => {
    const id = tree.treeId
    try {
      await router.push({ name: 'dashboard' })
      await tree.close()
      await trees.remove(id)
      $q.notify({ message: `Древо «${treeName}» удалено` })
    } catch (e) {
      $q.notify({ type: 'negative', message: errorMessage(e) })
    }
  })
}
const isOwner = computed(() => tree.role === 'owner')
</script>

<template>
  <div class="ft-page ts">
    <PageHeader title="Настройки древа" icon="sym_r_settings" :subtitle="tree.tree.name" />

    <div class="ts__layout">
      <nav class="ts__nav">
        <button v-for="s in SECTIONS" :key="s.id" type="button" @click="scrollTo(s.id)">
          <q-icon :name="s.icon" size="18px" />{{ s.label }}
        </button>
      </nav>

      <div class="ts__content">
        <!-- Основное -->
        <section id="ts-general" class="ft-card ft-card--pad ts__section">
          <h2 class="ft-h3">Основное</h2>
          <q-input v-model="name" outlined label="Название древа" maxlength="120" :readonly="tree.readonly" @blur="saveInfo" @keyup.enter="saveInfo" />
          <q-input
            v-model="description"
            outlined
            autogrow
            type="textarea"
            label="Описание"
            hint="Например: «Потомки Петра Орлова из Твери» — показывается в обзоре"
            :readonly="tree.readonly"
            @blur="saveInfo"
          />
          <div>
            <PersonSelect v-model="homeId" label="«Это Вы» — от кого считается родство" icon="sym_r_home" :disable="tree.readonly" />
            <div class="ts__hint">
              Подписи на карточках («Брат», «Прабабушка», «Муж свояченицы») и памятные даты считаются относительно этой персоны. Её также можно выбрать в меню
              персоны: «Это я».
            </div>
          </div>
        </section>

        <!-- Поля -->
        <section id="ts-fields" class="ft-card ft-card--pad ts__section">
          <div>
            <h2 class="ft-h3">Дополнительные поля</h2>
            <div class="ts__hint">
              Свои поля для всех персон древа: «Основное занятие», «Место службы», «Номер в метрической книге»… Заполняются в карточке персоны и
              выводятся как столбцы в таблице персон.
            </div>
          </div>
          <div v-if="tree.tree.customFields.length" class="ts__fields">
            <div v-for="f in tree.tree.customFields" :key="f.id" class="ts__field">
              <q-input
                :model-value="f.label"
                dense
                outlined
                class="col"
                :readonly="tree.readonly"
                @change="(v) => v.trim() && tree.saveCustomField({ ...f, label: v.trim() })"
              />
              <q-select
                :model-value="f.type"
                :options="CUSTOM_FIELD_TYPES"
                emit-value
                map-options
                dense
                outlined
                style="width: 140px"
                :readonly="tree.readonly"
                @update:model-value="(type) => tree.saveCustomField({ ...f, type })"
              />
              <span class="ts__usage text-muted">{{ usage(f.id) ? `заполнено: ${usage(f.id)}` : 'не заполнено' }}</span>
              <q-btn flat round dense icon="sym_r_delete" aria-label="Удалить поле" :disable="tree.readonly" @click="removeField(f)" />
            </div>
          </div>
          <form v-if="!tree.readonly" class="ts__field" @submit.prevent="addField">
            <q-input v-model="newField.label" dense outlined class="col" placeholder="Название нового поля" />
            <q-select v-model="newField.type" :options="CUSTOM_FIELD_TYPES" emit-value map-options dense outlined style="width: 140px" />
            <q-btn type="submit" unelevated no-caps color="primary" icon="sym_r_add" label="Добавить" :disable="!newField.label.trim()" />
          </form>
        </section>

        <!-- Доступ -->
        <section id="ts-sharing" class="ft-card ft-card--pad ts__section">
          <div>
            <h2 class="ft-h3">Совместный доступ</h2>
            <div class="ts__hint">Пригласите родственников вести древо вместе. У каждого — своя роль.</div>
          </div>
          <div v-if="!canShare" class="ts__notice">
            <q-icon name="sym_r_cloud_off" size="22px" />
            <div>
              <b>Сейчас данные хранятся только в этом браузере.</b>
              Совместная работа, синхронизация между устройствами и передача веток родственникам станут доступны после подключения сервера. До тех пор делитесь
              древом через экспорт — файл резервной копии можно открыть в «Родословной» на любом устройстве.
            </div>
          </div>
          <div class="ts__roles">
            <div v-for="r in ROLES" :key="r.value" class="ts__role">
              <b>{{ r.label }}</b>
              <span>{{ r.text }}</span>
            </div>
          </div>
          <template v-if="canShare">
            <form v-if="isOwner" class="ts__field" @submit.prevent="sendInvite">
              <q-input v-model="invite.email" type="email" dense outlined class="col" placeholder="Почта родственника" />
              <q-select v-model="invite.role" :options="ROLES.slice(1)" emit-value map-options dense outlined style="width: 150px" />
              <q-btn type="submit" unelevated no-caps color="primary" icon="sym_r_send" label="Пригласить" :loading="inviting" :disable="!invite.email.includes('@')" />
            </form>
            <div v-for="m in members" :key="m.id" class="ts__member">
              <q-avatar size="32px" color="grey-4" text-color="grey-9">{{ (m.name || m.email || '?')[0].toUpperCase() }}</q-avatar>
              <div class="col min-w-0">
                <div class="fw-600 ellipsis-1">{{ m.name || m.email }}</div>
                <div class="text-muted" style="font-size: 12.5px">{{ m.pending ? 'приглашение отправлено' : m.email }}</div>
              </div>
              <q-select
                :model-value="m.role"
                :options="ROLES"
                emit-value
                map-options
                dense
                borderless
                :disable="!isOwner || m.role === 'owner'"
                @update:model-value="(r) => setRole(m, r)"
              />
              <q-btn v-if="isOwner && m.role !== 'owner'" flat round dense icon="sym_r_person_remove" aria-label="Закрыть доступ" @click="removeMember(m)" />
            </div>
          </template>
        </section>

        <!-- Переданные ветки -->
        <section v-if="api.capabilities.delegation" id="ts-branches" class="ft-card ft-card--pad ts__section">
          <div>
            <h2 class="ft-h3">Переданные ветки</h2>
            <div class="ts__hint">
              Ветку дальнего родственника можно передать ему: он продолжит её в своём древе, а вы будете видеть изменения. Откройте меню персоны → «Передать ветку
              родственнику…».
            </div>
          </div>
          <div v-if="!tree.delegations.length" class="ts__empty text-muted">Вы ещё не передавали ветки.</div>
          <div v-for="d in tree.delegations" :key="d.id" class="ts__member" :class="{ 'ts__member--muted': !['pending', 'active'].includes(d.status) }">
            <PersonAvatar :person="tree.person(d.rootPersonId)" :size="32" />
            <div class="col min-w-0">
              <div class="fw-600 ellipsis-1">{{ rootName(d) }} <span class="text-muted">· {{ personsText(d.personIds.length) }}</span></div>
              <div class="text-muted ellipsis-1" style="font-size: 12.5px">{{ delegationWho(d) }} · {{ timeAgo(d.acceptedAt ?? d.createdAt) }}</div>
            </div>
            <span class="ft-chip" :class="DELEGATION_STATUS[d.status]?.tone ? `ft-chip--${DELEGATION_STATUS[d.status].tone}` : ''">{{ DELEGATION_STATUS[d.status]?.label ?? d.status }}</span>
            <template v-if="isOwner">
              <template v-if="d.status === 'pending'">
                <q-btn v-if="d.link" flat round dense icon="sym_r_content_copy" aria-label="Копировать ссылку" @click="copyDelegationLink(d)"><q-tooltip>Копировать ссылку</q-tooltip></q-btn>
                <q-btn flat round dense icon="sym_r_cancel_schedule_send" aria-label="Отозвать" @click="revokeDelegation(d)"><q-tooltip>Отозвать приглашение</q-tooltip></q-btn>
              </template>
              <q-btn v-else-if="d.status === 'active'" flat dense no-caps color="primary" icon="sym_r_content_copy" label="Склонировать" @click="personActions.cloneBranch(d)" />
              <q-btn v-if="tree.person(d.rootPersonId) && ['pending', 'active'].includes(d.status)" flat round dense icon="sym_r_open_in_new" aria-label="Подробнее" @click="ui.delegate(d.rootPersonId)"><q-tooltip>Подробнее</q-tooltip></q-btn>
            </template>
          </div>
        </section>

        <!-- Экспорт -->
        <section id="ts-export" class="ft-card ft-card--pad ts__section">
          <h2 class="ft-h3">Экспорт</h2>
          <div class="ts__export">
            <div class="ts__export-item">
              <q-icon name="sym_r_backup" size="26px" />
              <div class="col">
                <b>Резервная копия (.json)</b>
                <span>Всё древо вместе с фото и документами. Из неё древо восстанавливается без потерь.</span>
              </div>
              <q-btn unelevated no-caps color="primary" label="Скачать" :loading="exporting" @click="exportJson" />
            </div>
            <div class="ts__export-item">
              <q-icon name="sym_r_account_tree" size="26px" />
              <div class="col">
                <b>GEDCOM (.ged)</b>
                <span>Стандартный формат для других программ: MyHeritage, Ancestry, Gramps, «Древо Жизни». Фото не входят.</span>
                <div class="ts__export-opts">
                  <q-checkbox v-model="ged.hideLiving" dense label="Скрыть даты и места живых людей" />
                  <q-checkbox v-model="ged.excludePrivate" dense label="Не выгружать личные записи" />
                </div>
              </div>
              <q-btn outline no-caps color="primary" label="Скачать" @click="exportGed" />
            </div>
            <div class="ts__export-item">
              <q-icon name="sym_r_table" size="26px" />
              <div class="col">
                <b>Таблица (.csv)</b>
                <span>Список персон с выбранными столбцами — для Excel и Google Таблиц.</span>
              </div>
              <q-btn outline no-caps color="primary" label="Открыть таблицу" :to="nav.to('tree-people')" />
            </div>
          </div>
        </section>

        <!-- Импорт -->
        <section id="ts-import" class="ft-card ft-card--pad ts__section">
          <div>
            <h2 class="ft-h3">Импорт</h2>
            <div class="ts__hint">Поддерживаются резервные копии «Родословной» (.json) и GEDCOM (.ged) из других программ.</div>
          </div>
          <div class="ts__import">
            <q-btn outline no-caps color="primary" icon="sym_r_add" label="Импортировать как новое древо" :loading="importing" @click="importAsNew" />
            <q-btn flat no-caps color="negative" icon="sym_r_sync" label="Заменить данные этого древа…" :disable="tree.readonly" :loading="importing" @click="importReplace" />
          </div>
        </section>

        <!-- Удаление -->
        <section id="ts-danger" class="ft-card ft-card--pad ts__section ts__danger">
          <h2 class="ft-h3">Копия и удаление</h2>
          <div class="ts__danger-row">
            <div class="col">
              <b>Создать копию древа</b>
              <span>Удобно, чтобы попробовать крупные изменения, не рискуя основным древом.</span>
            </div>
            <q-btn outline no-caps label="Создать копию" @click="duplicate" />
          </div>
          <div class="ts__danger-row">
            <div class="col">
              <b>Удалить древо</b>
              <span>Все персоны, фото и документы будут удалены без возможности восстановления. Сначала скачайте резервную копию.</span>
            </div>
            <q-btn unelevated no-caps color="negative" label="Удалить древо" :disable="!isOwner" @click="removeTree" />
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.ts__layout {
  display: grid;
  grid-template-columns: 200px minmax(0, 760px);
  gap: 24px;
  align-items: start;
}
.ts__nav {
  position: sticky;
  top: 12px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  button {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    border: 0;
    border-radius: 8px;
    background: none;
    color: var(--ft-text-2);
    font: inherit;
    font-size: 13.5px;
    font-weight: 550;
    text-align: left;
    cursor: pointer;
    &:hover {
      background: var(--ft-surface-3);
      color: var(--ft-text);
    }
  }
}
.ts__content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.ts__section {
  display: flex;
  flex-direction: column;
  gap: 14px;
  scroll-margin-top: 16px;
}
.ts__hint {
  font-size: 12.5px;
  color: var(--ft-muted);
  line-height: 1.5;
  margin-top: 4px;
}
.ts__fields {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.ts__field {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.ts__usage {
  font-size: 12px;
  width: 100px;
}
.ts__notice {
  display: flex;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--ft-info-soft);
  color: var(--ft-text-2);
  font-size: 13px;
  line-height: 1.5;
  .q-icon {
    color: var(--ft-info);
    flex: none;
  }
  b {
    color: var(--ft-text);
  }
}
.ts__roles {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
.ts__role {
  display: flex;
  flex-direction: column;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--ft-border);
  font-size: 12.5px;
  color: var(--ft-muted);
  b {
    font-size: 13.5px;
    color: var(--ft-text);
  }
}
.ts__member {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 0;
}
.ts__member--muted {
  opacity: 0.65;
}
.ts__empty {
  font-size: 13.5px;
}
.ts__export {
  display: flex;
  flex-direction: column;
}
.ts__export-item {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 14px 0;
  & + & {
    border-top: 1px solid var(--ft-border);
  }
  > .q-icon {
    color: var(--ft-primary);
    margin-top: 2px;
  }
  .col {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 13px;
    color: var(--ft-muted);
  }
  b {
    color: var(--ft-text);
    font-size: 14px;
  }
}
.ts__export-opts {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 18px;
  margin-top: 8px;
  color: var(--ft-text-2);
}
.ts__import {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.ts__danger {
  border-color: color-mix(in srgb, var(--ft-negative) 35%, var(--ft-border));
}
.ts__danger-row {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  .col {
    display: flex;
    flex-direction: column;
    font-size: 13px;
    color: var(--ft-muted);
    min-width: 240px;
  }
  b {
    color: var(--ft-text);
    font-size: 14px;
  }
  & + & {
    padding-top: 14px;
    border-top: 1px solid var(--ft-border);
  }
}
@media (max-width: 900px) {
  .ts__layout {
    grid-template-columns: 1fr;
  }
  .ts__nav {
    display: none;
  }
  .ts__roles {
    grid-template-columns: 1fr;
  }
}
</style>
