<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import PersonAvatar from '@/components/common/PersonAvatar.vue'
import RelativeMenu from '@/components/common/RelativeMenu.vue'
import { useTreeStore } from '@/stores/tree'
import { useUiStore } from '@/stores/ui'
import { usePhotoUpload } from '@/composables/usePhoto'
import { usePersonActions } from '@/composables/usePersonActions'
import { usePersonTimeline } from '@/composables/useTimeline'
import { ageOf, FACT_TYPES, FAMILY_STATUSES, formatDate, fullName, genderLabel, lifeSpan, shortName } from '@/utils/person'

const $q = useQuasar()
const store = useTreeStore()
const ui = useUiStore()
const { upload } = usePhotoUpload()
const actions = usePersonActions()

const open = computed({
  get: () => ui.profile.open,
  set: (v) => (ui.profile.open = v),
})
const tab = computed({
  get: () => ui.profile.tab,
  set: (v) => (ui.profile.tab = v),
})
const p = computed(() => store.person(ui.profile.personId))
const timeline = usePersonTimeline(p)

// Биография
const bio = ref('')
const nickname = ref('')
const phone = ref('')
watch(
  () => [ui.profile.open, ui.profile.personId],
  () => {
    bio.value = p.value?.biography ?? ''
    nickname.value = p.value?.nickname ?? ''
    phone.value = p.value?.phone ?? ''
  },
  { immediate: true },
)
const bioDirty = computed(() => (p.value?.biography ?? '') !== bio.value)
function saveBio() {
  if (!p.value) return
  store.updatePerson(p.value.id, { biography: bio.value })
  $q.notify({ type: 'positive', message: 'Биография сохранена', timeout: 1500 })
}
function saveExtra() {
  if (!p.value) return
  if (p.value.nickname === nickname.value && p.value.phone === phone.value) return
  store.updatePerson(p.value.id, { nickname: nickname.value, phone: phone.value })
}

// Фото
const viewer = ref<{ open: boolean; index: number }>({ open: false, index: 0 })
function openViewer(i: number) {
  viewer.value = { open: true, index: i }
}
function editCaption(photoId: string, caption: string) {
  $q.dialog({
    title: 'Подпись к фото',
    prompt: { model: caption, type: 'text', outlined: true },
    cancel: { flat: true, label: 'Отмена' },
    ok: { unelevated: true, label: 'Сохранить', color: 'primary' },
  }).onOk((v: string) => store.updatePhoto(p.value!.id, photoId, v))
}
function removePhoto(photoId: string) {
  $q.dialog({
    title: 'Удалить фото?',
    cancel: { flat: true, label: 'Отмена' },
    ok: { unelevated: true, label: 'Удалить', color: 'negative' },
  }).onOk(() => store.removePhoto(p.value!.id, photoId))
}

// Родственники
const relGroups = computed(() => {
  const x = p.value
  if (!x) return []
  const par = store.parentsOf(x.id)
  const sib = store.siblingsOf(x.id)
  return [
    {
      title: 'Родители',
      icon: 'sym_r_supervisor_account',
      items: [par.father, par.mother].filter(Boolean).map((id) => ({ id: id!, familyId: par.family?.id })),
      empty: 'Родители не указаны',
    },
    {
      title: 'Партнёры и супруги',
      icon: 'sym_r_favorite',
      items: store.partnersOf(x.id).map((r) => ({ id: r.id, familyId: r.family.id, status: r.family.status })),
      empty: 'Нет партнёров',
    },
    {
      title: 'Братья и сёстры',
      icon: 'sym_r_diversity_3',
      items: [...sib.full.map((id) => ({ id })), ...sib.half.map((id) => ({ id, half: true }))],
      empty: 'Нет братьев и сестёр',
    },
    {
      title: 'Дети',
      icon: 'sym_r_child_care',
      items: store.childrenOf(x.id).map((id) => ({ id })),
      empty: 'Нет детей',
    },
  ] as {
    title: string
    icon: string
    items: { id: string; familyId?: string; status?: string; half?: boolean }[]
    empty: string
  }[]
})

function goTo(id: string) {
  store.select(id)
  ui.profile.personId = id
}
function statusLabel(s?: string) {
  return FAMILY_STATUSES.find((x) => x.value === s)?.label
}
function removePartnership(familyId: string, partnerId: string) {
  $q.dialog({
    title: 'Удалить связь?',
    message: `Связь «партнёры» с ${shortName(store.person(partnerId))} будет удалена. Общие дети останутся с ${shortName(p.value)}.`,
    cancel: { flat: true, label: 'Отмена' },
    ok: { unelevated: true, label: 'Удалить связь', color: 'negative' },
  }).onOk(() => store.removePartnership(familyId, p.value!.id))
}
function removeChild(childId: string) {
  $q.dialog({
    title: 'Отвязать ребёнка?',
    message: `${shortName(store.person(childId))} больше не будет связан(а) с родителями.`,
    cancel: { flat: true, label: 'Отмена' },
    ok: { unelevated: true, label: 'Отвязать', color: 'negative' },
  }).onOk(() => store.detachChild(childId))
}

const factLabel = (type: string, title?: string) =>
  type === 'custom' ? title || 'Событие' : (FACT_TYPES.find((f) => f.value === type)?.label ?? type)
const factIcon = (type: string) => FACT_TYPES.find((f) => f.value === type)?.icon ?? 'sym_r_event'
</script>

<template>
  <q-dialog v-model="open" :maximized="$q.screen.lt.md" transition-show="jump-up" @hide="saveExtra">
    <q-card v-if="p" class="prof" :class="`gender-${p.gender}`">
      <div class="prof__hero">
        <q-btn flat round dense icon="sym_r_close" class="prof__close" v-close-popup />
        <PersonAvatar :person="p" :size="96" camera ring @camera="upload(p.id, { avatar: true })" />
        <div class="col" style="min-width: 0">
          <div class="prof__name">{{ fullName(p, { middle: true }) }}</div>
          <div class="prof__meta">
            <span class="prof__chip">{{ genderLabel[p.gender] }}</span>
            <span v-if="store.homeId === p.id" class="prof__chip prof__chip--home">Это Вы</span>
            <span v-else-if="store.relationToHome(p.id)" class="prof__chip prof__chip--rel">{{ store.relationToHome(p.id) }}</span>
            <span>{{ lifeSpan(p) }}</span>
            <span v-if="ageOf(p)">· {{ p.living ? '' : 'прожил(а) ' }}{{ ageOf(p) }}</span>
          </div>
          <div class="row q-gutter-sm q-mt-sm">
            <q-btn unelevated no-caps dense class="q-px-md" color="primary" icon="sym_r_edit" label="Изменить" @click="ui.editPerson(p.id)" />
            <q-btn outline no-caps dense class="q-px-md" color="primary" icon="sym_r_person_add" label="Добавить">
              <RelativeMenu :person-id="p.id" />
            </q-btn>
            <q-btn
              flat
              no-caps
              size="sm"
              icon="sym_r_center_focus_strong"
              label="В центр древа"
              @click="store.setFocus(p.id); open = false"
            />
            <q-btn flat round size="sm" icon="sym_r_delete" color="negative" @click="actions.remove(p.id, () => (open = false))">
              <q-tooltip>Удалить персону</q-tooltip>
            </q-btn>
          </div>
        </div>
      </div>

      <q-tabs v-model="tab" dense no-caps align="left" active-color="primary" indicator-color="primary" class="prof__tabs" outside-arrows mobile-arrows>
        <q-tab name="info" label="Обзор" icon="sym_r_person" />
        <q-tab name="facts" label="Факты и события" icon="sym_r_event_note" />
        <q-tab name="bio" label="Биография" icon="sym_r_history_edu" />
        <q-tab name="photos" icon="sym_r_photo_library">
          <span>Фото <q-badge v-if="p.photos.length" color="grey-5" text-color="dark" rounded>{{ p.photos.length }}</q-badge></span>
        </q-tab>
        <q-tab name="relatives" label="Родственники" icon="sym_r_groups" />
      </q-tabs>

      <q-tab-panels v-model="tab" animated class="prof__panels ft-scroll">
        <!-- Обзор -->
        <q-tab-panel name="info">
          <div class="prof__cols">
            <div>
              <div class="ft-section-title q-mb-sm">Основные данные</div>
              <dl class="prof__dl">
                <dt>Имя</dt>
                <dd>{{ p.firstName || '—' }}</dd>
                <dt>Отчество</dt>
                <dd>{{ p.middleName || '—' }}</dd>
                <dt>Фамилия</dt>
                <dd>{{ p.lastName || '—' }}</dd>
                <template v-if="p.birthName">
                  <dt>При рождении</dt>
                  <dd>{{ p.birthName }}</dd>
                </template>
                <template v-if="p.title || p.suffix">
                  <dt>Звание / статус</dt>
                  <dd>{{ [p.title, p.suffix].filter(Boolean).join(', ') }}</dd>
                </template>
                <dt>Рождение</dt>
                <dd>{{ [formatDate(p.birth.date), p.birth.place].filter(Boolean).join(', ') || '—' }}</dd>
                <template v-if="!p.living">
                  <dt>Смерть</dt>
                  <dd>{{ [formatDate(p.death.date), p.death.place].filter(Boolean).join(', ') || 'дата неизвестна' }}</dd>
                </template>
                <template v-if="p.email">
                  <dt>E-mail</dt>
                  <dd><a :href="`mailto:${p.email}`">{{ p.email }}</a></dd>
                </template>
              </dl>
              <div class="q-mt-md q-gutter-y-sm" style="max-width: 360px">
                <q-input v-model="nickname" outlined dense label="Прозвище / как называли в семье" @blur="saveExtra" />
                <q-input v-if="p.living" v-model="phone" outlined dense label="Телефон" type="tel" @blur="saveExtra" />
              </div>
            </div>
            <div>
              <div class="ft-section-title q-mb-sm">Хронология</div>
              <div class="prof__tl">
                <div v-for="ev in timeline" :key="ev.key" class="prof__tl-item" @click="ev.onClick()">
                  <div class="prof__tl-dot"><q-icon :name="ev.icon" size="15px" /></div>
                  <div>
                    <div class="text-weight-medium">
                      <b v-if="ev.year" class="q-mr-xs">{{ ev.year }}</b>{{ ev.title }}
                    </div>
                    <div class="text-caption text-muted">{{ ev.subtitle }}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </q-tab-panel>

        <!-- Факты -->
        <q-tab-panel name="facts">
          <div class="row items-center q-mb-md">
            <div class="col text-muted">Образование, профессия, места жительства, награды и другие события жизни.</div>
            <q-btn unelevated no-caps color="primary" icon="sym_r_add" label="Добавить факт" @click="ui.editFact(p.id)" />
          </div>
          <q-list separator bordered class="rounded-borders">
            <q-item clickable @click="ui.editPerson(p.id)">
              <q-item-section avatar><q-icon name="sym_r_child_friendly" color="primary" /></q-item-section>
              <q-item-section>
                <q-item-label>Рождение</q-item-label>
                <q-item-label caption>{{ [formatDate(p.birth.date), p.birth.place].filter(Boolean).join(' · ') || 'не указано' }}</q-item-label>
              </q-item-section>
              <q-item-section side><q-icon name="sym_r_edit" size="18px" /></q-item-section>
            </q-item>
            <q-item v-for="f in p.facts" :key="f.id" clickable @click="ui.editFact(p.id, f.id)">
              <q-item-section avatar><q-icon :name="factIcon(f.type)" color="primary" /></q-item-section>
              <q-item-section>
                <q-item-label>{{ factLabel(f.type, f.title) }}<span v-if="f.description" class="text-muted"> — {{ f.description }}</span></q-item-label>
                <q-item-label caption>{{ [formatDate(f.date), f.place].filter(Boolean).join(' · ') }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <div class="row no-wrap">
                  <q-btn flat round dense size="sm" icon="sym_r_edit" />
                  <q-btn flat round dense size="sm" icon="sym_r_delete" color="negative" @click.stop="store.removeFact(p.id, f.id)" />
                </div>
              </q-item-section>
            </q-item>
            <q-item v-if="!p.living" clickable @click="ui.editPerson(p.id)">
              <q-item-section avatar><q-icon name="sym_r_local_florist" color="grey-7" /></q-item-section>
              <q-item-section>
                <q-item-label>Смерть</q-item-label>
                <q-item-label caption>{{ [formatDate(p.death.date), p.death.place].filter(Boolean).join(' · ') || 'не указано' }}</q-item-label>
              </q-item-section>
              <q-item-section side><q-icon name="sym_r_edit" size="18px" /></q-item-section>
            </q-item>
          </q-list>
        </q-tab-panel>

        <!-- Биография -->
        <q-tab-panel name="bio">
          <q-input
            v-model="bio"
            type="textarea"
            outlined
            autogrow
            placeholder="Расскажите историю жизни: где родился и рос, чем занимался, какие события были важными, семейные легенды…"
            input-style="min-height: 240px; line-height: 1.6"
          />
          <div class="row justify-end q-gutter-sm q-mt-md">
            <q-btn flat no-caps label="Сбросить" :disable="!bioDirty" @click="bio = p.biography" />
            <q-btn unelevated no-caps color="primary" label="Сохранить биографию" :disable="!bioDirty" @click="saveBio" />
          </div>
        </q-tab-panel>

        <!-- Фото -->
        <q-tab-panel name="photos">
          <div class="prof__gallery">
            <button class="prof__upload" @click="upload(p.id, { multiple: true })">
              <q-icon name="sym_r_add_photo_alternate" size="32px" />
              <span>Загрузить фото</span>
            </button>
            <div v-for="(ph, i) in p.photos" :key="ph.id" class="prof__photo">
              <img :src="ph.src" :alt="ph.caption" @click="openViewer(i)" />
              <div v-if="p.avatarId === ph.id" class="prof__avatar-badge">
                <q-icon name="sym_r_account_circle" size="14px" /> Главное
              </div>
              <div class="prof__photo-bar">
                <span class="ellipsis">{{ ph.caption || 'Без подписи' }}</span>
                <q-btn flat round dense size="sm" icon="sym_r_more_vert" color="white">
                  <q-menu>
                    <q-list dense style="min-width: 190px">
                      <q-item v-close-popup clickable @click="store.setAvatar(p.id, ph.id)">
                        <q-item-section avatar><q-icon name="sym_r_account_circle" /></q-item-section>
                        <q-item-section>Сделать главным</q-item-section>
                      </q-item>
                      <q-item v-close-popup clickable @click="editCaption(ph.id, ph.caption)">
                        <q-item-section avatar><q-icon name="sym_r_edit_note" /></q-item-section>
                        <q-item-section>Подпись</q-item-section>
                      </q-item>
                      <q-item v-close-popup clickable class="text-negative" @click="removePhoto(ph.id)">
                        <q-item-section avatar><q-icon name="sym_r_delete" color="negative" /></q-item-section>
                        <q-item-section>Удалить</q-item-section>
                      </q-item>
                    </q-list>
                  </q-menu>
                </q-btn>
              </div>
            </div>
          </div>
          <div class="text-caption text-muted q-mt-md">
            Фото хранятся в браузере (уменьшенные копии). Для надёжности регулярно делайте резервную копию через «Импорт / экспорт».
          </div>
        </q-tab-panel>

        <!-- Родственники -->
        <q-tab-panel name="relatives">
          <div class="prof__rel-grid">
            <div v-for="g in relGroups" :key="g.title" class="prof__rel-card">
              <div class="row items-center q-mb-sm">
                <q-icon :name="g.icon" size="20px" class="q-mr-sm text-primary" />
                <div class="text-weight-bold col">{{ g.title }}</div>
              </div>
              <q-list dense>
                <q-item v-for="r in g.items" :key="r.id" clickable class="rounded-borders" @click="goTo(r.id)">
                  <q-item-section avatar><PersonAvatar :person="store.person(r.id)" :size="32" /></q-item-section>
                  <q-item-section>
                    <q-item-label>{{ fullName(store.person(r.id)) }}</q-item-label>
                    <q-item-label caption>
                      {{ [lifeSpan(store.person(r.id)!), r.status && statusLabel(r.status), r.half && 'сводный(ая)'].filter(Boolean).join(' · ') }}
                    </q-item-label>
                  </q-item-section>
                  <q-item-section side>
                    <q-btn flat round dense size="sm" icon="sym_r_more_vert" @click.stop>
                      <q-menu>
                        <q-list dense style="min-width: 220px">
                          <q-item v-close-popup clickable @click="store.setFocus(r.id); open = false">
                            <q-item-section avatar><q-icon name="sym_r_center_focus_strong" /></q-item-section>
                            <q-item-section>В центр древа</q-item-section>
                          </q-item>
                          <q-item v-if="r.familyId" v-close-popup clickable @click="ui.editFamily(r.familyId)">
                            <q-item-section avatar><q-icon name="sym_r_favorite" /></q-item-section>
                            <q-item-section>Изменить отношения</q-item-section>
                          </q-item>
                          <q-item
                            v-if="g.title === 'Партнёры и супруги' && r.familyId"
                            v-close-popup
                            clickable
                            class="text-negative"
                            @click="removePartnership(r.familyId, r.id)"
                          >
                            <q-item-section avatar><q-icon name="sym_r_link_off" color="negative" /></q-item-section>
                            <q-item-section>Удалить связь</q-item-section>
                          </q-item>
                          <q-item v-if="g.title === 'Дети'" v-close-popup clickable class="text-negative" @click="removeChild(r.id)">
                            <q-item-section avatar><q-icon name="sym_r_link_off" color="negative" /></q-item-section>
                            <q-item-section>Отвязать от родителей</q-item-section>
                          </q-item>
                          <q-item
                            v-if="g.title === 'Родители'"
                            v-close-popup
                            clickable
                            class="text-negative"
                            @click="actions.detachFromParents(p.id)"
                          >
                            <q-item-section avatar><q-icon name="sym_r_link_off" color="negative" /></q-item-section>
                            <q-item-section>Отвязать от родителей</q-item-section>
                          </q-item>
                        </q-list>
                      </q-menu>
                    </q-btn>
                  </q-item-section>
                </q-item>
                <div v-if="!g.items.length" class="text-caption text-muted q-px-sm q-py-xs">{{ g.empty }}</div>
              </q-list>
            </div>
          </div>
        </q-tab-panel>
      </q-tab-panels>

      <q-dialog v-model="viewer.open" maximized transition-show="fade" transition-hide="fade">
        <div class="prof__viewer" @click.self="viewer.open = false">
          <q-btn flat round icon="sym_r_close" color="white" class="absolute-top-right q-ma-md" v-close-popup />
          <q-carousel
            v-model="viewer.index"
            animated
            swipeable
            arrows
            infinite
            control-color="white"
            class="bg-transparent full-width"
            style="height: 86vh"
          >
            <q-carousel-slide v-for="(ph, i) in p.photos" :key="ph.id" :name="i" class="column flex-center no-wrap">
              <img :src="ph.src" class="prof__viewer-img" />
              <div class="text-white q-mt-md text-subtitle1">{{ ph.caption }}</div>
            </q-carousel-slide>
          </q-carousel>
        </div>
      </q-dialog>
    </q-card>
  </q-dialog>
</template>

<style scoped lang="scss">
.prof {
  width: 920px;
  max-width: 96vw;
  height: min(820px, 92vh);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.prof__hero {
  position: relative;
  display: flex;
  gap: 20px;
  align-items: center;
  padding: 26px 28px 20px;
  background: linear-gradient(120deg, var(--g-soft), transparent 70%);
}
.prof__close {
  position: absolute;
  right: 12px;
  top: 12px;
}
.prof__name {
  font-size: 24px;
  font-weight: 800;
  letter-spacing: -0.01em;
  line-height: 1.15;
  padding-right: 30px;
}
.prof__meta {
  margin-top: 6px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  color: var(--ft-muted);
  font-size: 13.5px;
}
.prof__chip {
  padding: 2px 10px;
  border-radius: 999px;
  background: var(--ft-surface);
  border: 1px solid var(--ft-border);
  font-size: 12px;
  font-weight: 600;
}
.prof__chip--home {
  background: var(--ft-primary);
  border-color: var(--ft-primary);
  color: #fff;
}
.prof__chip--rel {
  color: var(--g);
  border-color: color-mix(in srgb, var(--g) 40%, transparent);
}
.prof__tabs {
  border-bottom: 1px solid var(--ft-border);
  padding: 0 16px;
}
.prof__panels {
  flex: 1;
  overflow-y: auto;
  background: transparent;
}
.prof__cols {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 32px;
}
.prof__dl {
  display: grid;
  grid-template-columns: 130px 1fr;
  gap: 8px 12px;
  margin: 0;
  font-size: 14px;
  dt {
    color: var(--ft-muted);
  }
  dd {
    margin: 0;
    font-weight: 500;
  }
}
.prof__tl {
  position: relative;
  &::before {
    content: '';
    position: absolute;
    left: 13px;
    top: 8px;
    bottom: 8px;
    width: 2px;
    background: var(--ft-border);
  }
}
.prof__tl-item {
  position: relative;
  display: flex;
  gap: 12px;
  padding: 6px 8px 6px 0;
  border-radius: 10px;
  cursor: pointer;
  &:hover {
    background: var(--ft-surface-2);
  }
}
.prof__tl-dot {
  width: 28px;
  height: 28px;
  flex: none;
  border-radius: 50%;
  background: var(--ft-surface);
  border: 2px solid var(--g);
  color: var(--g);
  display: grid;
  place-items: center;
  z-index: 1;
}
.prof__gallery {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 12px;
}
.prof__upload {
  aspect-ratio: 1;
  border: 2px dashed var(--ft-border);
  border-radius: 14px;
  background: var(--ft-surface-2);
  color: var(--ft-muted);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  cursor: pointer;
  font: inherit;
  transition: 0.15s;
  &:hover {
    border-color: var(--ft-primary);
    color: var(--ft-primary);
  }
}
.prof__photo {
  position: relative;
  aspect-ratio: 1;
  border-radius: 14px;
  overflow: hidden;
  background: var(--ft-surface-2);
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    cursor: zoom-in;
  }
}
.prof__avatar-badge {
  position: absolute;
  left: 8px;
  top: 8px;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--ft-primary);
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 3px;
}
.prof__photo-bar {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 18px 4px 4px 10px;
  color: #fff;
  font-size: 12px;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.65));
  span {
    flex: 1;
  }
}
.prof__rel-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
.prof__rel-card {
  border: 1px solid var(--ft-border);
  border-radius: 14px;
  padding: 14px;
}
.prof__viewer {
  background: rgba(8, 10, 14, 0.94);
  display: flex;
  align-items: center;
  justify-content: center;
}
.prof__viewer-img {
  max-width: 90vw;
  max-height: 76vh;
  border-radius: 8px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
}
@media (max-width: 800px) {
  .prof {
    height: 100vh;
  }
  .prof__cols,
  .prof__rel-grid {
    grid-template-columns: 1fr;
  }
  .prof__hero {
    flex-direction: column;
    align-items: flex-start;
    padding: 20px;
  }
}
</style>
