<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import PersonAvatar from '@/components/person/PersonAvatar.vue'
import PersonMenuList from '@/components/person/PersonMenuList.vue'
import PersonFamily from '@/components/person/PersonFamily.vue'
import PersonMiniTree from '@/components/person/PersonMiniTree.vue'
import BranchNotice from '@/components/person/BranchNotice.vue'
import MediaGrid from '@/components/media/MediaGrid.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { useTreeStore } from '@/stores/tree'
import { useUiStore } from '@/stores/ui'
import { useTreeNav } from '@/composables/useTreeNav'
import { usePersonTimeline } from '@/composables/usePersonTimeline'
import { usePersonActions } from '@/composables/usePersonActions'
import { useMediaUpload } from '@/composables/useMediaUpload'
import { fullName, shortName } from '@/domain/names'
import { ageLabel, birthLine, bornWord, completeness, deathLine, diedWord, mainOccupation, residenceId } from '@/domain/person'
import { placeFullName } from '@/domain/places'
import { CITATION_QUALITY, genderLabel, PRIVACY_LEVELS, eventTitle, sourceTypeInfo } from '@/domain/model'

const props = defineProps({ personId: { type: String, required: true } })
const $q = useQuasar()
const route = useRoute()
const router = useRouter()
const tree = useTreeStore()
const ui = useUiStore()
const nav = useTreeNav()
const actions = usePersonActions()
const { uploadFor } = useMediaUpload()

const p = computed(() => tree.person(props.personId))
const tab = ref(typeof route.query.tab === 'string' ? route.query.tab : 'overview')
const menuOpen = ref(false)
watch(tab, (t) => router.replace({ query: { ...route.query, tab: t === 'overview' ? undefined : t } }))
watch(
  () => props.personId,
  (id) => {
    if (tree.person(id)) tree.selectPerson(id)
  },
  { immediate: true },
)

const isHome = computed(() => tree.homeId === props.personId)
const relation = computed(() => (isHome.value ? 'Это Вы' : tree.relationToHome(props.personId)))
const clan = computed(() => (p.value?.clanId ? tree.tree.clans[p.value.clanId] : null))
const quality = computed(() => completeness(tree.graph, p.value))
const timeline = usePersonTimeline(p, { relatives: true })
const media = computed(() => tree.graph.mediaOf(props.personId))

const facts = computed(() => {
  const x = p.value
  const t = tree.tree
  const rows = [
    ['Фамилия', x.lastName],
    ['Имя', x.firstName],
    ['Отчество', x.middleName],
    ['Фамилия при рождении', x.birthName !== x.lastName ? x.birthName : ''],
    ['Пол', genderLabel[x.gender]],
    ['Род', clan.value?.name],
    [bornWord(x).replace(/^./, (c) => c.toUpperCase()), birthLine(t, x)],
    ...(x.living ? [] : [[diedWord(x).replace(/^./, (c) => c.toUpperCase()), [deathLine(t, x), x.death.cause].filter(Boolean).join(' — ')]]),
    ['Возраст', ageLabel(x)],
    [x.living ? 'Место жительства' : 'Жил(а)', placeFullName(t, residenceId(x))],
    ['Основное занятие', mainOccupation(x)],
    ['Прозвище', x.nickname],
    ['Титул, звание', x.title],
    ...t.customFields.map((f) => [f.label, x.custom?.[f.id]]),
    ['Почта', x.email],
    ['Телефон', x.phone],
  ]
  return rows.filter((r) => r[1])
})

const citations = computed(() => {
  const x = p.value
  const out = []
  const add = (list, where) => (list ?? []).forEach((c) => out.push({ ...c, where }))
  add(x.citations, 'О персоне')
  add(x.birth.citations, 'Рождение')
  add(x.death.citations, 'Смерть')
  for (const e of x.events) add(e.citations, eventTitle(e))
  for (const f of tree.graph.spouseFamilies(x.id)) add(f.citations, 'Семья')
  return out
})
const quality3 = (q) => CITATION_QUALITY.find((c) => c.value === q)?.short ?? ''

// Заметки — редактирование на месте
const note = ref('')
const bio = ref('')
watch(
  () => [p.value?.note, p.value?.biography],
  () => {
    note.value = p.value?.note ?? ''
    bio.value = p.value?.biography ?? ''
  },
  { immediate: true },
)
const notesDirty = computed(() => note.value !== (p.value?.note ?? '') || bio.value !== (p.value?.biography ?? ''))
function saveNotes() {
  tree.updatePerson(p.value.id, { note: note.value, biography: bio.value }, 'Заметки')
  $q.notify({ type: 'positive', message: 'Сохранено', timeout: 1200 })
}

const privacy = computed(() => PRIVACY_LEVELS.find((x) => x.value === p.value?.privacy))
const counts = computed(() => ({
  family: tree.graph.partners(props.personId).length + tree.graph.children(props.personId).length,
  events: timeline.value.length,
  media: media.value.length,
  sources: citations.value.length,
}))
</script>

<template>
  <div v-if="p" class="ft-page pgp" :class="`gender-${p.gender}`">
    <!-- Шапка -->
    <section class="pgp__hero ft-card">
      <div class="pgp__hero-bg" />
      <div class="pgp__nav no-print">
        <q-btn flat round dense icon="sym_r_arrow_back" aria-label="Назад" @click="router.back()"><q-tooltip>Назад</q-tooltip></q-btn>
      </div>
      <PersonAvatar :person="p" :size="$q.screen.gt.sm ? 124 : 88" ring :camera="tree.canEdit(p.id)" class="pgp__avatar" @camera="uploadFor([p.id], { avatar: true })" />
      <div class="pgp__head">
        <div class="pgp__badges">
          <span class="ft-chip" :class="isHome ? 'ft-chip--primary' : ''">
            <q-icon v-if="isHome" name="sym_r_home" size="14px" />{{ relation || 'Не связан(а) с «Это Вы»' }}
          </span>
          <span v-if="clan" class="ft-chip"><i class="pgp__clan" :style="{ background: clan.color }" />{{ clan.name }}</span>
          <span v-if="p.privacy !== 'public'" class="ft-chip ft-chip--warning"><q-icon :name="privacy.icon" size="14px" />{{ p.privacy === 'private' ? 'Скрыто' : 'Для участников' }}</span>
          <button v-if="tree.canEdit(p.id)" type="button" class="pgp__fav" :class="{ on: p.favorite }" :aria-label="p.favorite ? 'Убрать из избранного' : 'В избранное'" @click="actions.toggleFavorite(p.id)">
            <q-icon name="sym_r_star" size="18px" />
          </button>
        </div>
        <h1 class="pgp__name">{{ fullName(p, { title: true }) }}</h1>
        <div v-if="p.birthName && p.birthName !== p.lastName" class="text-muted">урождённая {{ p.birthName }}</div>
        <div class="pgp__life">
          <span v-if="birthLine(tree.tree, p)"><b>✱</b> {{ birthLine(tree.tree, p) }}</span>
          <span v-if="!p.living"><b>✝</b> {{ deathLine(tree.tree, p) }}</span>
          <span v-if="ageLabel(p)">{{ p.living ? '' : 'прожил(а) ' }}{{ ageLabel(p) }}</span>
        </div>
        <div class="pgp__actions no-print">
          <q-btn v-if="tree.canEdit(p.id)" unelevated no-caps color="primary" icon="sym_r_edit" label="Изменить" @click="ui.editPerson(p.id)" />
          <q-btn v-if="tree.canEdit(p.id)" outline no-caps color="primary" icon="sym_r_person_add" label="Добавить родственника" @click="ui.addRelative(p.id, null)" />
          <q-btn outline no-caps color="primary" icon="sym_r_account_tree" label="В древе" @click="nav.showInChart(p.id)" />
          <q-btn outline round dense color="primary" icon="sym_r_more_horiz" aria-label="Ещё">
            <q-menu v-model="menuOpen" anchor="bottom right" self="top right"><PersonMenuList :person-id="p.id" hide-open @done="menuOpen = false" /></q-menu>
          </q-btn>
        </div>
      </div>
      <div class="pgp__quality gt-sm">
        <q-circular-progress :value="quality.score" size="64px" :thickness="0.14" :color="quality.score > 75 ? 'positive' : quality.score > 45 ? 'warning' : 'negative'" track-color="grey-3" show-value class="text-weight-bold">
          {{ quality.score }}%
        </q-circular-progress>
        <div class="text-muted" style="font-size: 12px">заполнено</div>
        <q-tooltip v-if="quality.missing.length" max-width="260px">Не хватает: {{ quality.missing.join(', ') }}</q-tooltip>
      </div>
    </section>
    <BranchNotice :person-id="p.id" class="q-mt-md" />

    <q-tabs v-model="tab" dense no-caps align="left" active-color="primary" indicator-color="primary" class="pgp__tabs no-print" outside-arrows mobile-arrows>
      <q-tab name="overview" label="Обзор" />
      <q-tab name="family"><span>Семья <small v-if="counts.family">{{ counts.family }}</small></span></q-tab>
      <q-tab name="events"><span>События <small>{{ counts.events }}</small></span></q-tab>
      <q-tab name="media"><span>Фото и документы <small v-if="counts.media">{{ counts.media }}</small></span></q-tab>
      <q-tab name="sources"><span>Источники <small v-if="counts.sources">{{ counts.sources }}</small></span></q-tab>
      <q-tab name="notes" label="Заметки" />
    </q-tabs>

    <!-- Обзор -->
    <div v-if="tab === 'overview'" class="pgp__grid">
      <div class="pgp__col">
        <section class="ft-card ft-card--pad">
          <div class="pgp__sec-head">
            <h2 class="ft-h3">Основные сведения</h2>
            <q-btn v-if="tree.canEdit(p.id)" flat dense no-caps size="sm" color="primary" icon="sym_r_edit" label="Изменить" @click="ui.editPerson(p.id)" />
          </div>
          <dl class="pgp__dl">
            <template v-for="r in facts" :key="r[0]">
              <dt>{{ r[0] }}</dt>
              <dd>{{ r[1] }}</dd>
            </template>
          </dl>
        </section>
        <section v-if="p.note || p.biography" class="ft-card ft-card--pad">
          <div class="pgp__sec-head">
            <h2 class="ft-h3">Биография</h2>
            <q-btn flat dense no-caps size="sm" color="primary" label="Все заметки" @click="tab = 'notes'" />
          </div>
          <p v-if="p.note" class="pgp__note pre-line">{{ p.note }}</p>
          <p v-if="p.biography" class="pgp__bio pre-line">{{ p.biography }}</p>
        </section>
        <section class="ft-card ft-card--pad">
          <div class="pgp__sec-head">
            <h2 class="ft-h3">Ближайшая семья</h2>
            <q-btn flat dense no-caps size="sm" color="primary" label="Подробнее" @click="tab = 'family'" />
          </div>
          <PersonMiniTree :person-id="p.id" />
        </section>
      </div>
      <div class="pgp__col">
        <section class="ft-card ft-card--pad">
          <div class="pgp__sec-head">
            <h2 class="ft-h3">Жизнь по годам</h2>
            <q-btn v-if="tree.canEdit(p.id)" flat dense no-caps size="sm" color="primary" icon="sym_r_add" label="Событие" @click="ui.editEvent(p.id)" />
          </div>
          <div class="pgp__tl">
            <button v-for="ev in timeline" :key="ev.key" type="button" class="pgp__ev" :class="{ muted: ev.muted }" @click="ev.onClick()">
              <span class="pgp__ev-year tabular">{{ ev.year ?? '—' }}</span>
              <span class="pgp__ev-dot"><q-icon :name="ev.icon" size="14px" /></span>
              <span class="min-w-0">
                <span class="pgp__ev-title">{{ ev.title }}</span>
                <span v-if="ev.subtitle" class="pgp__ev-sub">{{ ev.subtitle }}</span>
              </span>
            </button>
          </div>
        </section>
        <section v-if="media.length" class="ft-card ft-card--pad">
          <div class="pgp__sec-head">
            <h2 class="ft-h3">Фото и документы</h2>
            <q-btn flat dense no-caps size="sm" color="primary" label="Все" @click="tab = 'media'" />
          </div>
          <MediaGrid :items="media.slice(0, 6)" :person-id="p.id" small />
        </section>
      </div>
    </div>

    <!-- Семья -->
    <PersonFamily v-else-if="tab === 'family'" :person-id="p.id" />

    <!-- События -->
    <section v-else-if="tab === 'events'" class="ft-card ft-card--pad">
      <div class="pgp__sec-head">
        <h2 class="ft-h3">События жизни</h2>
        <q-btn v-if="tree.canEdit(p.id)" unelevated no-caps color="primary" icon="sym_r_add" label="Добавить событие" @click="ui.editEvent(p.id)" />
      </div>
      <div class="pgp__events">
        <div v-for="ev in timeline" :key="ev.key" class="pgp__event" :class="{ muted: ev.muted }">
          <span class="pgp__ev-dot pgp__ev-dot--lg"><q-icon :name="ev.icon" size="18px" /></span>
          <div class="col min-w-0">
            <div class="fw-600">{{ ev.title }}</div>
            <div class="text-muted" style="font-size: 13px">{{ ev.subtitle || 'дата неизвестна' }}</div>
          </div>
          <span v-if="ev.citations" class="ft-chip"><q-icon name="sym_r_menu_book" size="13px" />{{ ev.citations }}</span>
          <q-btn v-if="ev.eventId && tree.canEdit(p.id)" flat round dense size="sm" icon="sym_r_edit" class="text-muted" @click="ev.onClick()" />
          <q-btn v-if="ev.eventId && tree.canEdit(p.id)" flat round dense size="sm" icon="sym_r_delete" class="text-muted" @click="tree.removeEvent(p.id, ev.eventId)" />
          <q-btn v-if="!ev.eventId" flat round dense size="sm" icon="sym_r_chevron_right" class="text-muted" @click="ev.onClick()" />
        </div>
      </div>
      <div class="text-faint q-mt-md" style="font-size: 12.5px">Рождение, смерть и браки редактируются в карточке персоны и в отношениях; события жизни — здесь.</div>
    </section>

    <!-- Медиа -->
    <section v-else-if="tab === 'media'" class="ft-card ft-card--pad">
      <div class="pgp__sec-head">
        <h2 class="ft-h3">Фото и документы</h2>
        <q-btn v-if="tree.canEdit(p.id)" unelevated no-caps color="primary" icon="sym_r_upload" label="Загрузить" @click="uploadFor([p.id])" />
      </div>
      <MediaGrid v-if="media.length" :items="media" :person-id="p.id" droppable @drop-files="(files) => uploadFor([p.id], { files })" />
      <EmptyState v-else compact icon="sym_r_photo_library" title="Пока ничего нет" text="Добавьте фотографии, сканы документов, письма. Можно перетащить файлы сюда.">
        <template #actions><q-btn v-if="tree.canEdit(p.id)" unelevated no-caps color="primary" icon="sym_r_upload" label="Загрузить файлы" @click="uploadFor([p.id])" /></template>
      </EmptyState>
    </section>

    <!-- Источники -->
    <section v-else-if="tab === 'sources'" class="ft-card ft-card--pad">
      <div class="pgp__sec-head">
        <h2 class="ft-h3">Ссылки на источники</h2>
        <q-btn v-if="tree.canEdit(p.id)" unelevated no-caps color="primary" icon="sym_r_add" label="Добавить ссылку" @click="ui.editPerson(p.id, 'sources')" />
      </div>
      <div v-if="citations.length" class="pgp__cites">
        <div v-for="c in citations" :key="c.id" class="pgp__cite">
          <span class="pgp__cite-icon"><q-icon :name="sourceTypeInfo(tree.tree.sources[c.sourceId]?.type).icon" size="18px" /></span>
          <div class="col min-w-0">
            <div class="fw-600">{{ tree.tree.sources[c.sourceId]?.title ?? 'Источник удалён' }}</div>
            <div class="text-muted" style="font-size: 13px">
              {{ [c.where, c.page, tree.tree.sources[c.sourceId]?.callNumber].filter(Boolean).join(' · ') }}
            </div>
            <div v-if="c.note" class="pgp__cite-note">«{{ c.note }}»</div>
          </div>
          <span class="ft-chip" :class="c.quality >= 3 ? 'ft-chip--accent' : c.quality <= 1 ? 'ft-chip--warning' : ''">{{ quality3(c.quality) }}</span>
        </div>
      </div>
      <EmptyState v-else compact icon="sym_r_menu_book" title="Источники не указаны" text="Сошлитесь на метрическую книгу, перепись, документ или рассказ — так данные можно будет проверить." />
    </section>

    <!-- Заметки -->
    <section v-else-if="tab === 'notes'" class="ft-card ft-card--pad pgp__notes">
      <q-input v-model="note" outlined autogrow label="Комментарий" :readonly="!tree.canEdit(p.id)" hint="Коротко: видно в таблице и на панели" />
      <q-input
        v-model="bio"
        outlined
        autogrow
        type="textarea"
        label="Биография"
        :readonly="!tree.canEdit(p.id)"
        placeholder="Где родился и рос, чем занимался, важные события, семейные легенды…"
        input-style="min-height: 280px; line-height: 1.65"
      />
      <div v-if="tree.canEdit(p.id)" class="row justify-end q-gutter-sm">
        <q-btn flat no-caps label="Отменить правки" :disable="!notesDirty" @click="(note = p.note), (bio = p.biography)" />
        <q-btn unelevated no-caps color="primary" label="Сохранить" :disable="!notesDirty" @click="saveNotes" />
      </div>
    </section>
  </div>
  <EmptyState v-else icon="sym_r_person_off" title="Персона не найдена" text="Возможно, она была удалена.">
    <template #actions><q-btn unelevated no-caps color="primary" label="К списку персон" :to="nav.to('tree-people')" /></template>
  </EmptyState>
</template>

<style scoped lang="scss">
.pgp {
  max-width: 1180px;
}
.pgp__hero {
  position: relative;
  overflow: hidden;
  display: flex;
  gap: 24px;
  align-items: center;
  padding: 26px 28px;
}
.pgp__hero-bg {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(90% 140% at 0% 0%, var(--g-soft), transparent 60%),
    radial-gradient(60% 120% at 100% 0%, color-mix(in srgb, var(--ft-primary-soft) 70%, transparent), transparent 60%);
  pointer-events: none;
}
.pgp__nav {
  position: absolute;
  left: 10px;
  top: 10px;
  z-index: 1;
}
.pgp__avatar {
  z-index: 1;
  margin-left: 18px;
}
.pgp__head {
  position: relative;
  flex: 1;
  min-width: 0;
}
.pgp__badges {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}
.pgp__clan {
  width: 9px;
  height: 9px;
  border-radius: 3px;
  display: inline-block;
}
.pgp__fav {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: 0;
  background: transparent;
  color: var(--ft-faint);
  cursor: pointer;
  display: grid;
  place-items: center;
  &.on {
    color: #e0a526;
    background: #fdf3d8;
  }
  &:hover {
    color: #e0a526;
  }
}
.pgp__name {
  font-size: 28px;
  font-weight: 780;
  letter-spacing: -0.02em;
  line-height: 1.15;
  margin: 8px 0 2px;
}
.pgp__life {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  margin-top: 6px;
  color: var(--ft-text-2);
  b {
    color: var(--ft-muted);
    font-weight: 500;
    margin-right: 2px;
  }
}
.pgp__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 16px;
}
.pgp__quality {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  cursor: default;
}
.pgp__tabs {
  margin: 18px 0 16px;
  border-bottom: 1px solid var(--ft-border);
  small {
    font-size: 11.5px;
    color: var(--ft-faint);
    margin-left: 3px;
  }
}
.pgp__grid {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}
.pgp__col {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.pgp__sec-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 12px;
}
.pgp__dl {
  display: grid;
  grid-template-columns: 170px 1fr;
  gap: 8px 14px;
  margin: 0;
  dt {
    color: var(--ft-muted);
  }
  dd {
    margin: 0;
    font-weight: 500;
    word-break: break-word;
  }
}
.pgp__note {
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--ft-surface-2);
  margin: 0 0 10px;
}
.pgp__bio {
  margin: 0;
  line-height: 1.65;
  max-height: 260px;
  overflow: auto;
}
.pgp__tl {
  display: flex;
  flex-direction: column;
}
.pgp__ev {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 7px 8px;
  margin: 0 -8px;
  border: 0;
  background: none;
  border-radius: 10px;
  font: inherit;
  color: var(--ft-text);
  text-align: left;
  cursor: pointer;
  &:hover {
    background: var(--ft-surface-2);
  }
  &.muted {
    opacity: 0.7;
  }
}
.pgp__ev-year {
  width: 42px;
  flex: none;
  font-weight: 700;
  padding-top: 2px;
}
.pgp__ev-dot {
  width: 26px;
  height: 26px;
  flex: none;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: var(--g-soft);
  color: var(--g);
}
.pgp__ev-dot--lg {
  width: 38px;
  height: 38px;
  border-radius: 12px;
}
.pgp__ev-title {
  display: block;
  font-weight: 600;
}
.pgp__ev-sub {
  display: block;
  font-size: 12.5px;
  color: var(--ft-muted);
}
.pgp__events {
  display: flex;
  flex-direction: column;
}
.pgp__event {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid var(--ft-border);
  &.muted {
    opacity: 0.65;
  }
}
.pgp__cites {
  display: flex;
  flex-direction: column;
}
.pgp__cite {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid var(--ft-border);
}
.pgp__cite-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  background: var(--ft-info-soft);
  color: var(--ft-info);
  flex: none;
}
.pgp__cite-note {
  margin-top: 4px;
  font-size: 13px;
  font-style: italic;
  color: var(--ft-text-2);
}
.pgp__notes {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
@media (max-width: 900px) {
  .pgp__grid {
    grid-template-columns: 1fr;
  }
  .pgp__hero {
    flex-direction: column;
    align-items: flex-start;
    padding: 44px 18px 20px;
  }
  .pgp__avatar {
    margin-left: 0;
  }
  .pgp__name {
    font-size: 23px;
  }
  .pgp__dl {
    grid-template-columns: 130px 1fr;
  }
}
</style>
