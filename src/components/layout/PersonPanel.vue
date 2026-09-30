<script setup>
import { computed, ref } from 'vue'
import PersonAvatar from '@/components/common/PersonAvatar.vue'
import RelativeMenu from '@/components/common/RelativeMenu.vue'
import { useTreeStore } from '@/stores/tree'
import { useUiStore } from '@/stores/ui'
import { usePhotoUpload } from '@/composables/usePhoto'
import { usePersonActions } from '@/composables/usePersonActions'
import { usePersonTimeline } from '@/composables/useTimeline'
import { ageOf, formatDate, fullName, lifeSpan, FAMILY_STATUSES } from '@/utils/person'

const store = useTreeStore()
const ui = useUiStore()
const { upload } = usePhotoUpload()
const actions = usePersonActions()

const p = computed(() => store.selected)
const relation = computed(() => (p.value ? store.relationToHome(p.value.id) : ''))
const isHome = computed(() => p.value && store.homeId === p.value.id)

const relatives = computed(() => {
  const id = p.value?.id
  if (!id) return []
  const par = store.parentsOf(id)
  const sib = store.siblingsOf(id)
  const groups = [
    { title: 'Родители', items: [par.father, par.mother].filter(Boolean).map((x) => ({ id: x })) },
    {
      title: 'Партнёры',
      items: store.partnersOf(id).map((x) => ({
        id: x.id,
        note: FAMILY_STATUSES.find((s) => s.value === x.family.status)?.label,
      })),
    },
    {
      title: 'Братья и сёстры',
      items: [...sib.full.map((x) => ({ id: x })), ...sib.half.map((x) => ({ id: x, note: 'сводный(ая)' }))],
    },
    { title: 'Дети', items: store.childrenOf(id).map((x) => ({ id: x })) },
  ]
  return groups.filter((g) => g.items.length)
})
const relCount = computed(() => relatives.value.reduce((s, g) => s + g.items.length, 0))

const timeline = usePersonTimeline(p)
const showRelatives = ref(true)
const showFacts = ref(true)

function goTo(id) {
  store.select(id)
}

function birthLine() {
  const x = p.value
  const d = formatDate(x.birth.date)
  const age = x.living ? ageOf(x) : ''
  return [d, age && `(${age})`, x.birth.place && `· ${x.birth.place}`].filter(Boolean).join(' ')
}
function deathLine() {
  const x = p.value
  if (x.living) return ''
  const d = formatDate(x.death.date)
  const age = ageOf(x)
  return [d || 'дата неизвестна', age && `(в возрасте ${age})`, x.death.place && `· ${x.death.place}`].filter(Boolean).join(' ')
}
</script>

<template>
  <div v-if="p" class="pp ft-scroll" :class="`gender-${p.gender}`">
    <div class="pp__head">
      <q-btn class="pp__collapse" flat round dense size="sm" icon="sym_r_left_panel_close" @click="store.ui.panelOpen = false">
        <q-tooltip>Скрыть панель</q-tooltip>
      </q-btn>
      <div class="row no-wrap items-start q-gutter-x-md">
        <PersonAvatar :person="p" :size="76" camera ring @camera="upload(p.id, { avatar: true })" />
        <div class="col" style="min-width: 0">
          <div class="pp__name">{{ fullName(p, { middle: true }) }}</div>
          <div v-if="p.birthName" class="text-caption text-muted">урожд. {{ p.birthName }}</div>
          <div class="pp__rel" :class="{ 'pp__rel--me': isHome }">
            <q-icon v-if="isHome" name="sym_r_home" size="14px" />
            {{ isHome ? 'Это Вы' : relation }}
          </div>
          <div v-if="birthLine()" class="pp__life">
            <span class="pp__sym">✱</span> {{ birthLine() }}
          </div>
          <div v-if="!p.living" class="pp__life"><span class="pp__sym">✝</span> {{ deathLine() }}</div>
          <button v-if="store.focusId !== p.id" class="pp__link" @click="store.buildFrom(p.id)">
            Построить дерево от него <q-icon name="sym_r_chevron_right" size="16px" />
          </button>
          <button v-else class="pp__link" @click="ui.openProfile(p.id)">
            Открыть профиль <q-icon name="sym_r_chevron_right" size="16px" />
          </button>
        </div>
      </div>

      <div class="pp__actions">
        <button @click="ui.openProfile(p.id)">
          <span><q-icon name="sym_r_badge" size="20px" /></span>Профиль
        </button>
        <button @click="ui.editPerson(p.id)">
          <span><q-icon name="sym_r_edit" size="20px" /></span>Изменить
        </button>
        <button>
          <span><q-icon name="sym_r_person_add" size="20px" /></span>Добавить
          <RelativeMenu :person-id="p.id" />
        </button>
        <button>
          <span><q-icon name="sym_r_more_horiz" size="20px" /></span>Больше
          <q-menu anchor="bottom middle" self="top middle">
            <q-list style="min-width: 250px">
              <q-item v-close-popup clickable :disable="store.focusId === p.id" @click="store.buildFrom(p.id)">
                <q-item-section avatar><q-icon name="sym_r_account_tree" /></q-item-section>
                <q-item-section>Построить дерево от этого человека</q-item-section>
              </q-item>
              <q-item v-close-popup clickable :disable="!!isHome" @click="actions.setHome(p.id)">
                <q-item-section avatar><q-icon name="sym_r_home" /></q-item-section>
                <q-item-section>Это я (домашняя персона)</q-item-section>
              </q-item>
              <q-item v-close-popup clickable @click="ui.openProfile(p.id, 'photos')">
                <q-item-section avatar><q-icon name="sym_r_photo_library" /></q-item-section>
                <q-item-section>Фото и документы</q-item-section>
              </q-item>
              <q-item v-close-popup clickable :disable="!store.parentsOf(p.id).family" @click="actions.detachFromParents(p.id)">
                <q-item-section avatar><q-icon name="sym_r_link_off" /></q-item-section>
                <q-item-section>Отвязать от родителей</q-item-section>
              </q-item>
              <q-separator />
              <q-item v-close-popup clickable class="text-negative" @click="actions.remove(p.id)">
                <q-item-section avatar><q-icon name="sym_r_delete" color="negative" /></q-item-section>
                <q-item-section>Удалить персону</q-item-section>
              </q-item>
            </q-list>
          </q-menu>
        </button>
      </div>
    </div>

    <!-- Фото -->
    <section class="pp__sec">
      <div class="pp__sec-head">
        <span class="ft-section-title">Фото и видео</span>
        <q-btn flat dense no-caps size="sm" color="primary" icon="sym_r_add" label="Добавить" @click="upload(p.id, { multiple: true })" />
      </div>
      <div v-if="p.photos.length" class="pp__photos">
        <button v-for="ph in p.photos.slice(0, 7)" :key="ph.id" @click="ui.openProfile(p.id, 'photos')">
          <img :src="ph.src" :alt="ph.caption" />
        </button>
        <button v-if="p.photos.length > 7" class="pp__more" @click="ui.openProfile(p.id, 'photos')">
          +{{ p.photos.length - 7 }}
        </button>
      </div>
    </section>

    <!-- Биография -->
    <section class="pp__sec">
      <div class="pp__sec-head">
        <span class="ft-section-title">Биография</span>
        <q-btn
          flat
          dense
          no-caps
          size="sm"
          color="primary"
          :icon="p.biography ? 'sym_r_edit' : 'sym_r_add'"
          :label="p.biography ? 'Изменить' : 'Добавить'"
          @click="ui.openProfile(p.id, 'bio')"
        />
      </div>
      <div v-if="p.biography" class="pp__bio" @click="ui.openProfile(p.id, 'bio')">{{ p.biography }}</div>
    </section>

    <!-- Родственники -->
    <section class="pp__sec">
      <div class="pp__sec-head">
        <button class="pp__toggle" @click="showRelatives = !showRelatives">
          <span class="ft-section-title">Близкие родственники</span>
          <q-badge v-if="relCount" rounded color="grey-5" text-color="dark" :label="relCount" class="q-ml-xs" />
          <q-icon :name="showRelatives ? 'sym_r_keyboard_arrow_up' : 'sym_r_keyboard_arrow_down'" size="18px" class="text-muted" />
        </button>
        <q-btn flat dense no-caps size="sm" color="primary" icon="sym_r_add" label="Добавить">
          <RelativeMenu :person-id="p.id" />
        </q-btn>
      </div>
      <q-slide-transition>
        <div v-show="showRelatives">
          <div v-for="g in relatives" :key="g.title" class="q-mb-sm">
            <div class="pp__group">{{ g.title }}</div>
            <q-item
              v-for="r in g.items"
              :key="r.id"
              clickable
              dense
              class="pp__relitem"
              @click="goTo(r.id)"
            >
              <q-item-section avatar>
                <PersonAvatar :person="store.person(r.id)" :size="34" />
              </q-item-section>
              <q-item-section>
                <q-item-label class="text-weight-medium">{{ fullName(store.person(r.id)) }}</q-item-label>
                <q-item-label caption>
                  {{ [lifeSpan(store.person(r.id)), r.note].filter(Boolean).join(' · ') }}
                </q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-btn flat round dense size="sm" icon="sym_r_center_focus_strong" @click.stop="store.buildFrom(r.id)">
                  <q-tooltip>Построить дерево от него</q-tooltip>
                </q-btn>
              </q-item-section>
            </q-item>
          </div>
          <div v-if="!relatives.length" class="text-caption text-muted q-py-xs">Родственники пока не добавлены</div>
        </div>
      </q-slide-transition>
    </section>

    <!-- Факты -->
    <section class="pp__sec">
      <div class="pp__sec-head">
        <button class="pp__toggle" @click="showFacts = !showFacts">
          <span class="ft-section-title">Факты</span>
          <q-icon :name="showFacts ? 'sym_r_keyboard_arrow_up' : 'sym_r_keyboard_arrow_down'" size="18px" class="text-muted" />
        </button>
        <q-btn flat dense no-caps size="sm" color="primary" icon="sym_r_add" label="Добавить" @click="ui.editFact(p.id)" />
      </div>
      <q-slide-transition>
        <div v-show="showFacts" class="pp__timeline">
          <div v-for="ev in timeline" :key="ev.key" class="pp__ev" @click="ev.onClick()">
            <div class="pp__ev-year">{{ ev.year ?? '—' }}</div>
            <div class="pp__ev-dot"><q-icon :name="ev.icon" size="14px" /></div>
            <div class="col">
              <div class="text-weight-semibold">{{ ev.title }}</div>
              <div class="text-caption text-muted">{{ ev.subtitle }}</div>
            </div>
          </div>
          <div v-if="!timeline.length" class="text-caption text-muted">Нет фактов</div>
        </div>
      </q-slide-transition>
    </section>

    <div class="pp__foot text-caption text-muted">
      Изменено {{ new Date(p.updatedAt).toLocaleString('ru-RU', { dateStyle: 'medium', timeStyle: 'short' }) }}
    </div>
  </div>
  <div v-else class="absolute-center text-muted text-center">
    <q-icon name="sym_r_person_search" size="48px" />
    <div>Выберите персону в древе</div>
  </div>
</template>

<style scoped lang="scss">
.pp {
  height: 100%;
  overflow-y: auto;
  padding-bottom: 24px;
}
.pp__head {
  position: relative;
  padding: 20px 18px 14px;
  background: linear-gradient(180deg, var(--g-soft), transparent 140px);
  border-bottom: 1px solid var(--ft-border);
}
.pp__collapse {
  position: absolute;
  top: 8px;
  right: 8px;
  color: var(--ft-muted);
}
.pp__name {
  font-size: 18px;
  font-weight: 700;
  line-height: 1.2;
  padding-right: 22px;
  word-break: break-word;
}
.pp__rel {
  margin-top: 4px;
  font-size: 13px;
  color: var(--g);
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 4px;
}
.pp__rel--me {
  color: var(--ft-primary);
}
.pp__life {
  margin-top: 4px;
  font-size: 13px;
  color: var(--ft-muted);
}
.pp__sym {
  display: inline-block;
  width: 14px;
  color: var(--ft-text);
}
.pp__link {
  margin-top: 8px;
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  color: var(--ft-primary);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  &:hover {
    text-decoration: underline;
  }
}
.pp__actions {
  margin-top: 18px;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 4px;
  button {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    border: 0;
    background: none;
    font: inherit;
    font-size: 12.5px;
    color: var(--ft-text);
    cursor: pointer;
    padding: 4px 0;
    border-radius: 10px;
    span {
      width: 42px;
      height: 42px;
      display: grid;
      place-items: center;
      border-radius: 50%;
      background: var(--ft-surface);
      border: 1px solid var(--ft-border);
      color: var(--ft-muted);
      transition: 0.15s;
    }
    &:hover span {
      background: var(--ft-primary);
      border-color: var(--ft-primary);
      color: #fff;
    }
  }
}
.pp__sec {
  padding: 12px 18px;
  border-bottom: 1px solid var(--ft-border);
}
.pp__sec-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 30px;
}
.pp__toggle {
  display: flex;
  align-items: center;
  gap: 4px;
  border: 0;
  background: none;
  padding: 0;
  cursor: pointer;
  font: inherit;
}
.pp__photos {
  margin-top: 8px;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
  button {
    position: relative;
    aspect-ratio: 1;
    border: 0;
    padding: 0;
    border-radius: 10px;
    overflow: hidden;
    cursor: pointer;
    background: var(--ft-surface-2);
  }
  img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.2s;
  }
  button:hover img {
    transform: scale(1.06);
  }
}
.pp__more {
  font-weight: 700;
  color: var(--ft-muted);
}
.pp__bio {
  margin-top: 6px;
  font-size: 13.5px;
  line-height: 1.5;
  white-space: pre-line;
  display: -webkit-box;
  -webkit-line-clamp: 5;
  -webkit-box-orient: vertical;
  overflow: hidden;
  cursor: pointer;
}
.pp__group {
  font-size: 12px;
  color: var(--ft-muted);
  margin: 8px 0 2px;
}
.pp__relitem {
  border-radius: 10px;
  padding: 4px 6px;
  margin: 0 -6px;
}
.pp__timeline {
  margin-top: 6px;
}
.pp__ev {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 7px 6px;
  margin: 0 -6px;
  border-radius: 10px;
  cursor: pointer;
  font-size: 13.5px;
  &:hover {
    background: var(--ft-surface-2);
  }
}
.pp__ev-year {
  width: 40px;
  font-size: 15px;
  font-weight: 700;
  color: var(--ft-text);
  flex: none;
}
.pp__ev-dot {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: var(--g-soft);
  color: var(--g);
  flex: none;
}
.text-weight-semibold {
  font-weight: 600;
}
.pp__foot {
  padding: 14px 18px 0;
}
</style>
