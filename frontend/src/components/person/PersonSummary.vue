<script setup>
/**
 * Краткая карточка выбранной персоны: для боковой панели древа и таблицы персон.
 * Показывает главное (годы, родство, место, занятие), семью, события и чего не хватает.
 */
import { computed, ref } from 'vue'
import PersonAvatar from './PersonAvatar.vue'
import PersonMenuList from './PersonMenuList.vue'
import BranchNotice from './BranchNotice.vue'
import { useTreeStore } from '@/stores/tree'
import { useUiStore } from '@/stores/ui'
import { useTreeNav } from '@/composables/useTreeNav'
import { usePersonTimeline } from '@/composables/usePersonTimeline'
import { useMediaUpload } from '@/composables/useMediaUpload'
import { fullName, shortName } from '@/domain/names'
import { ageLabel, completeness, deathLine, birthLine, lifeSpan, mainOccupation, residenceId } from '@/domain/person'
import { placeFullName } from '@/domain/places'
import { childLinkInfo, statusInfo } from '@/domain/model'

const props = defineProps({
  personId: { type: String, required: true },
  closable: Boolean,
  compactHeader: Boolean,
})
const emit = defineEmits(['close'])
const tree = useTreeStore()
const ui = useUiStore()
const nav = useTreeNav()
const { uploadFor } = useMediaUpload()

const p = computed(() => tree.person(props.personId))
const menuOpen = ref(false)
const G = computed(() => tree.graph)
const isHome = computed(() => tree.homeId === props.personId)
const relation = computed(() => (isHome.value ? 'Это Вы' : tree.relationToHome(props.personId)))
const clan = computed(() => (p.value?.clanId ? tree.tree.clans[p.value.clanId] : null))
const residence = computed(() => placeFullName(tree.tree, residenceId(p.value)))
const occupation = computed(() => mainOccupation(p.value))
const quality = computed(() => completeness(G.value, p.value))

const family = computed(() => {
  const id = props.personId
  const g = G.value
  const { father, mother, family: pf } = g.parents(id)
  const sib = g.siblings(id)
  const link = pf?.childLinks?.[id]
  return [
    {
      title: 'Родители',
      note: link && link !== 'birth' ? childLinkInfo(link).label : '',
      items: [father, mother].filter(Boolean).map((x) => ({ id: x })),
      add: !father || !mother ? (!father ? 'father' : 'mother') : null,
    },
    {
      title: 'Супруги и партнёры',
      items: g.partners(id).map((x) => ({ id: x.id, note: statusInfo(x.family.status).label, familyId: x.family.id })),
      add: 'partner',
    },
    { title: 'Дети', items: g.children(id).map((x) => ({ id: x })), add: 'son' },
    {
      title: 'Братья и сёстры',
      items: [...sib.full.map((x) => ({ id: x })), ...sib.half.map((x) => ({ id: x, note: 'сводн.' }))],
      add: 'brother',
    },
  ]
})

const timeline = usePersonTimeline(p)
const media = computed(() => G.value.mediaOf(props.personId).filter((m) => m.thumb).slice(0, 6))
</script>

<template>
  <div v-if="p" class="psum" :class="`gender-${p.gender}`">
    <div class="psum__hero">
      <q-btn v-if="closable" flat round dense icon="sym_r_close" class="psum__close" aria-label="Закрыть" @click="emit('close')" />
      <PersonAvatar :person="p" :size="compactHeader ? 56 : 72" ring :camera="tree.canEdit(p.id)" @camera="uploadFor([p.id], { avatar: true })" />
      <div class="psum__title">
        <div class="psum__rel" :class="{ 'psum__rel--me': isHome }">
          <q-icon v-if="isHome" name="sym_r_home" size="14px" />
          {{ relation || 'Не связан(а) с «Это Вы»' }}
        </div>
        <div class="psum__name">
          {{ fullName(p) }}
          <q-icon v-if="p.favorite" name="sym_r_star" size="16px" class="psum__star" />
        </div>
        <div v-if="p.birthName && p.birthName !== p.lastName" class="text-muted psum__small">урожд. {{ p.birthName }}</div>
        <div class="psum__life">{{ lifeSpan(p) }}<template v-if="ageLabel(p)"> · {{ p.living ? '' : 'прожил(а) ' }}{{ ageLabel(p) }}</template></div>
      </div>
    </div>

    <div class="psum__actions">
      <q-btn unelevated no-caps no-wrap color="primary" icon="sym_r_badge" label="Профиль" :to="nav.personRoute(p.id)" class="col" />
      <q-btn v-if="tree.canEdit(p.id)" outline no-caps no-wrap color="primary" icon="sym_r_edit" label="Изменить" class="col" @click="ui.editPerson(p.id)" />
      <q-btn outline round dense color="primary" icon="sym_r_more_horiz" aria-label="Ещё">
        <q-menu v-model="menuOpen" anchor="bottom right" self="top right">
          <PersonMenuList :person-id="p.id" hide-open @done="menuOpen = false" />
        </q-menu>
      </q-btn>
    </div>
    <BranchNotice :person-id="p.id" compact />
    <q-btn
      v-if="tree.focusId !== p.id"
      flat
      no-caps
      dense
      color="primary"
      icon="sym_r_center_focus_strong"
      label="Построить древо от этого человека"
      class="psum__center"
      @click="nav.showInChart(p.id)"
    />

    <!-- Основное -->
    <dl class="psum__facts">
      <template v-if="birthLine(tree.tree, p)">
        <dt>Рождение</dt>
        <dd>{{ birthLine(tree.tree, p) }}</dd>
      </template>
      <template v-if="!p.living">
        <dt>Смерть</dt>
        <dd>{{ deathLine(tree.tree, p) }}<span v-if="p.death.cause" class="text-muted"> — {{ p.death.cause }}</span></dd>
      </template>
      <template v-if="residence">
        <dt>Живёт</dt>
        <dd>{{ residence }}</dd>
      </template>
      <template v-if="occupation">
        <dt>Занятие</dt>
        <dd>{{ occupation }}</dd>
      </template>
      <template v-if="clan">
        <dt>Род</dt>
        <dd><span class="psum__clan" :style="{ background: clan.color }" />{{ clan.name }}</dd>
      </template>
      <template v-for="f in tree.tree.customFields" :key="f.id">
        <template v-if="p.custom?.[f.id]">
          <dt>{{ f.label }}</dt>
          <dd>{{ p.custom[f.id] }}</dd>
        </template>
      </template>
    </dl>
    <div v-if="p.note" class="psum__note pre-line">{{ p.note }}</div>

    <!-- Семья -->
    <section class="psum__sec">
      <div class="psum__sec-title">Семья</div>
      <div v-for="g in family" :key="g.title" class="psum__fam">
        <div class="psum__fam-title">
          {{ g.title }}
          <span v-if="g.note" class="ft-chip ft-chip--info">{{ g.note }}</span>
          <button v-if="g.add && tree.canEdit(p.id)" type="button" class="psum__add" :title="`Добавить: ${g.title.toLowerCase()}`" @click="ui.addRelative(p.id, g.add)">
            <q-icon name="sym_r_add" size="16px" />
          </button>
        </div>
        <button v-for="r in g.items" :key="r.id" type="button" class="psum__rel-item" @click="tree.selectPerson(r.id)" @dblclick="nav.showInChart(r.id)">
          <PersonAvatar :person="tree.person(r.id)" :size="30" />
          <span class="min-w-0 col">
            <span class="psum__rel-name ellipsis-1">{{ shortName(tree.person(r.id)) }}</span>
            <span class="psum__rel-sub ellipsis-1">{{ [lifeSpan(tree.person(r.id)), r.note].filter(Boolean).join(' · ') }}</span>
          </span>
          <q-btn v-if="r.familyId" flat round dense size="sm" icon="sym_r_favorite" class="psum__fam-btn" @click.stop="ui.editFamily(r.familyId)">
            <q-tooltip>Отношения: брак, развод, даты</q-tooltip>
          </q-btn>
        </button>
        <div v-if="!g.items.length" class="psum__empty">—</div>
      </div>
    </section>

    <!-- Хронология -->
    <section v-if="timeline.length" class="psum__sec">
      <div class="psum__sec-title">
        События
        <button v-if="tree.canEdit(p.id)" type="button" class="psum__add" title="Добавить событие" @click="ui.editEvent(p.id)"><q-icon name="sym_r_add" size="16px" /></button>
      </div>
      <div class="psum__tl">
        <button v-for="ev in timeline.slice(0, 8)" :key="ev.key" type="button" class="psum__ev" @click="ev.onClick()">
          <span class="psum__ev-year tabular">{{ ev.year ?? '—' }}</span>
          <span class="psum__ev-dot"><q-icon :name="ev.icon" size="13px" /></span>
          <span class="min-w-0 col">
            <span class="psum__ev-title">{{ ev.title }}</span>
            <span v-if="ev.subtitle" class="psum__rel-sub">{{ ev.subtitle }}</span>
          </span>
        </button>
        <router-link v-if="timeline.length > 8" :to="nav.personRoute(p.id)" class="psum__more">Все события ({{ timeline.length }})</router-link>
      </div>
    </section>

    <!-- Фото -->
    <section v-if="media.length" class="psum__sec">
      <div class="psum__sec-title">Фото и документы</div>
      <div class="psum__media">
        <button v-for="(m, i) in media" :key="m.id" type="button" @click="ui.viewMedia(media.map((x) => x.id), i)">
          <img :src="m.thumb" :alt="m.title" loading="lazy" />
        </button>
      </div>
    </section>

    <!-- Полнота -->
    <section class="psum__sec">
      <div class="psum__sec-title">Заполненность · {{ quality.score }}%</div>
      <q-linear-progress :value="quality.score / 100" rounded size="6px" :color="quality.score > 75 ? 'positive' : quality.score > 45 ? 'warning' : 'negative'" track-color="grey-3" />
      <div v-if="quality.missing.length" class="psum__missing">Не хватает: {{ quality.missing.join(', ') }}</div>
    </section>
  </div>
</template>

<style scoped lang="scss">
.psum {
  padding: 18px 18px 28px;
  overflow-x: hidden;
}
.psum__hero {
  position: relative;
  display: flex;
  gap: 14px;
  align-items: flex-start;
}
.psum__close {
  position: absolute;
  right: -6px;
  top: -8px;
  color: var(--ft-muted);
}
.psum__title {
  min-width: 0;
  flex: 1;
  padding-right: 20px;
}
.psum__rel {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12.5px;
  font-weight: 650;
  color: var(--g);
}
.psum__rel--me {
  color: var(--ft-primary-text);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.psum__name {
  font-size: 18px;
  font-weight: 750;
  line-height: 1.25;
  letter-spacing: -0.01em;
  word-break: break-word;
}
.psum__star {
  color: #e0a526;
  vertical-align: -2px;
}
.psum__small {
  font-size: 12.5px;
}
.psum__life {
  margin-top: 2px;
  color: var(--ft-muted);
  font-size: 13px;
}
.psum__actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
  min-width: 0;
  > .col {
    flex: 1 1 0;
    min-width: 0;
    padding-inline: 10px;
  }
  :deep(.q-btn__content) {
    flex-wrap: nowrap;
    min-width: 0;
  }
  :deep(.q-btn__content .block) {
    overflow: hidden;
    text-overflow: ellipsis;
  }
  > .q-btn--round {
    flex: none;
  }
}
.psum__center {
  margin-top: 6px;
  width: 100%;
  justify-content: flex-start;
}
.psum__facts {
  display: grid;
  grid-template-columns: 90px 1fr;
  gap: 6px 10px;
  margin: 14px 0 0;
  font-size: 13px;
  dt {
    color: var(--ft-muted);
  }
  dd {
    margin: 0;
    min-width: 0;
    word-break: break-word;
  }
}
.psum__clan {
  display: inline-block;
  width: 9px;
  height: 9px;
  border-radius: 3px;
  margin-right: 6px;
}
.psum__note {
  margin-top: 12px;
  padding: 10px 12px;
  border-radius: 12px;
  background: var(--ft-surface-2);
  border: 1px solid var(--ft-border);
  font-size: 13px;
  color: var(--ft-text-2);
  max-height: 140px;
  overflow: auto;
}
.psum__sec {
  margin-top: 18px;
  padding-top: 14px;
  border-top: 1px solid var(--ft-border);
}
.psum__sec-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11.5px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ft-muted);
  margin-bottom: 8px;
}
.psum__fam + .psum__fam {
  margin-top: 8px;
}
.psum__fam-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--ft-faint);
  margin-bottom: 2px;
}
.psum__add {
  margin-left: auto;
  width: 22px;
  height: 22px;
  border-radius: 7px;
  border: 0;
  display: grid;
  place-items: center;
  background: transparent;
  color: var(--ft-muted);
  cursor: pointer;
  &:hover {
    background: var(--ft-primary-soft);
    color: var(--ft-primary-text);
  }
}
.psum__rel-item {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  padding: 4px 6px;
  margin: 0 -6px;
  border-radius: 9px;
  border: 0;
  background: none;
  font: inherit;
  color: var(--ft-text);
  text-align: left;
  cursor: pointer;
  &:hover {
    background: var(--ft-surface-3);
  }
}
.psum__rel-name {
  display: block;
  font-size: 13px;
  font-weight: 600;
}
.psum__rel-sub {
  display: block;
  font-size: 12px;
  color: var(--ft-muted);
}
.psum__fam-btn {
  color: var(--ft-primary);
  opacity: 0.7;
}
.psum__empty {
  font-size: 12.5px;
  color: var(--ft-faint);
  padding-left: 2px;
}
.psum__tl {
  display: flex;
  flex-direction: column;
}
.psum__ev {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 5px 6px;
  margin: 0 -6px;
  border: 0;
  border-radius: 9px;
  background: none;
  font: inherit;
  text-align: left;
  color: var(--ft-text);
  cursor: pointer;
  &:hover {
    background: var(--ft-surface-3);
  }
}
.psum__ev-year {
  width: 38px;
  flex: none;
  font-weight: 700;
  font-size: 13px;
  padding-top: 2px;
}
.psum__ev-dot {
  width: 22px;
  height: 22px;
  flex: none;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: var(--g-soft);
  color: var(--g);
}
.psum__ev-title {
  display: block;
  font-size: 13px;
  font-weight: 600;
}
.psum__more {
  font-size: 12.5px;
  font-weight: 600;
  padding: 6px 0 0 46px;
}
.psum__media {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  button {
    aspect-ratio: 1;
    border: 0;
    padding: 0;
    border-radius: 10px;
    overflow: hidden;
    cursor: zoom-in;
    background: var(--ft-surface-3);
  }
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
}
.psum__missing {
  margin-top: 6px;
  font-size: 12px;
  color: var(--ft-muted);
}
</style>
