<script setup>
/**
 * Отношения пары: статус (брак, помолвка, развод…), даты, общие дети и тип их родства, источники.
 */
import { computed, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import DateInput from '@/components/inputs/DateInput.vue'
import PlaceInput from '@/components/inputs/PlaceInput.vue'
import CitationsEditor from '@/components/inputs/CitationsEditor.vue'
import PersonAvatar from '@/components/person/PersonAvatar.vue'
import { useTreeStore } from '@/stores/tree'
import { useUiStore } from '@/stores/ui'
import { usePersonActions } from '@/composables/usePersonActions'
import { CHILD_LINKS, FAMILY_STATUSES, emptyPoint, statusInfo } from '@/domain/model'
import { fullName, shortName } from '@/domain/names'
import { lifeSpan } from '@/domain/person'

const $q = useQuasar()
const tree = useTreeStore()
const ui = useUiStore()
const actions = usePersonActions()

const open = computed({
  get: () => ui.familyDialog.open,
  set: (v) => (ui.familyDialog.open = v),
})
const fam = computed(() => tree.family(ui.familyDialog.familyId))
const partners = computed(() => (fam.value?.partners ?? []).map((id) => tree.person(id)).filter(Boolean))
const form = ref(null)

watch(open, (o) => {
  if (!o || !fam.value) return
  const f = fam.value
  form.value = JSON.parse(
    JSON.stringify({
      status: f.status,
      marriage: { ...emptyPoint(), ...f.marriage },
      divorce: { ...emptyPoint(), ...f.divorce },
      childLinks: f.childLinks ?? {},
      note: f.note ?? '',
      citations: f.citations ?? [],
      children: f.children,
    }),
  )
})
const kids = computed(() => (form.value?.children ?? []).map((id) => tree.person(id)).filter(Boolean))

function save() {
  const f = form.value
  tree.updateFamily(fam.value.id, {
    status: f.status,
    marriage: f.marriage,
    divorce: f.status === 'divorced' ? f.divorce : emptyPoint(),
    childLinks: Object.fromEntries(Object.entries(f.childLinks).filter(([c, l]) => l && l !== 'birth' && f.children.includes(c))),
    note: f.note,
    citations: f.citations,
    children: f.children,
  })
  open.value = false
  $q.notify({ type: 'positive', message: 'Отношения сохранены', timeout: 1400 })
}

function move(i, dir) {
  const arr = [...form.value.children]
  const j = i + dir
  if (j < 0 || j >= arr.length) return
  ;[arr[i], arr[j]] = [arr[j], arr[i]]
  form.value.children = arr
}

function addChild(kind) {
  const parent = fam.value.partners[0]
  open.value = false
  ui.addRelative(parent, kind, fam.value.id)
}
function removeLink() {
  const [a] = partners.value
  open.value = false
  actions.removePartnership(fam.value.id, a.id)
}
</script>

<template>
  <q-dialog v-model="open" transition-show="jump-up">
    <q-card v-if="fam && form" class="fd">
      <header class="fd__head">
        <div class="ft-h2 col">Отношения</div>
        <q-btn v-close-popup flat round dense icon="sym_r_close" aria-label="Закрыть" />
      </header>
      <div class="fd__body ft-scroll">
        <div class="fd__couple">
          <template v-for="(p, i) in partners" :key="p.id">
            <div class="fd__person" :class="`gender-${p.gender}`">
              <PersonAvatar :person="p" :size="56" ring />
              <div class="fw-700 q-mt-xs text-center lh-tight">{{ fullName(p) }}</div>
              <div class="text-muted" style="font-size: 12.5px">{{ lifeSpan(p) }}</div>
            </div>
            <div v-if="i === 0 && partners.length > 1" class="fd__heart">
              <q-icon :name="statusInfo(form.status).icon" size="22px" />
            </div>
          </template>
          <div v-if="partners.length < 2" class="fd__person fd__person--empty">
            <div class="fd__empty-av"><q-icon name="sym_r_question_mark" size="22px" /></div>
            <div class="text-muted q-mt-xs">Второй родитель неизвестен</div>
          </div>
        </div>

        <div class="fd__statuses">
          <button v-for="s in FAMILY_STATUSES" :key="s.value" type="button" :class="{ active: form.status === s.value }" @click="form.status = s.value">
            <q-icon :name="s.icon" size="16px" />
            {{ s.label }}
          </button>
        </div>

        <div class="fd__grid">
          <DateInput v-model="form.marriage.date" :label="form.status === 'engaged' ? 'Дата помолвки' : form.status === 'partners' ? 'Начало отношений' : 'Дата брака'" />
          <PlaceInput v-model="form.marriage.placeId" label="Место" />
        </div>
        <q-slide-transition>
          <div v-if="form.status === 'divorced'" class="fd__grid">
            <DateInput v-model="form.divorce.date" label="Дата развода" />
            <PlaceInput v-model="form.divorce.placeId" label="Место развода" />
          </div>
        </q-slide-transition>

        <section class="fd__sec">
          <div class="fd__sec-head">
            <span class="ft-label">Общие дети · {{ kids.length }}</span>
            <span>
              <q-btn flat dense no-caps size="sm" color="primary" icon="sym_r_add" label="Сын" @click="addChild('son')" />
              <q-btn flat dense no-caps size="sm" color="primary" icon="sym_r_add" label="Дочь" @click="addChild('daughter')" />
            </span>
          </div>
          <div v-for="(c, i) in kids" :key="c.id" class="fd__kid" :class="`gender-${c.gender}`">
            <PersonAvatar :person="c" :size="32" />
            <div class="col min-w-0">
              <div class="fw-600 ellipsis-1">{{ shortName(c) }}</div>
              <div class="text-muted" style="font-size: 12px">{{ lifeSpan(c) }}</div>
            </div>
            <q-select
              :model-value="form.childLinks[c.id] ?? 'birth'"
              :options="CHILD_LINKS"
              option-value="value"
              option-label="label"
              emit-value
              map-options
              outlined
              dense
              options-dense
              class="fd__link"
              @update:model-value="(v) => (form.childLinks[c.id] = v)"
            />
            <div class="fd__order">
              <q-btn flat round dense size="xs" icon="sym_r_keyboard_arrow_up" :disable="i === 0" aria-label="Выше" @click="move(i, -1)" />
              <q-btn flat round dense size="xs" icon="sym_r_keyboard_arrow_down" :disable="i === kids.length - 1" aria-label="Ниже" @click="move(i, 1)" />
            </div>
          </div>
          <div v-if="!kids.length" class="text-muted" style="font-size: 13px">Детей в этой семье пока нет</div>
          <div v-else class="text-faint q-mt-xs" style="font-size: 12px">Порядок важен для детей без дат рождения. Приёмные и неродные дети показаны на древе пунктиром.</div>
        </section>

        <section class="fd__sec">
          <q-input v-model="form.note" outlined dense autogrow label="Заметка о семье" />
          <CitationsEditor v-model="form.citations" title="Источники" class="q-mt-md" />
        </section>
      </div>
      <footer class="fd__foot">
        <q-btn v-if="partners.length > 1" flat no-caps color="negative" icon="sym_r_link_off" label="Удалить связь" @click="removeLink" />
        <q-space />
        <q-btn v-close-popup flat no-caps label="Отмена" />
        <q-btn unelevated no-caps color="primary" label="Сохранить" class="q-px-lg" @click="save" />
      </footer>
    </q-card>
  </q-dialog>
</template>

<style scoped lang="scss">
.fd {
  width: 600px;
  max-width: 96vw;
  max-height: 92vh;
  display: flex;
  flex-direction: column;
}
.fd__head {
  display: flex;
  align-items: center;
  padding: 18px 18px 6px 22px;
}
.fd__body {
  flex: 1;
  overflow-y: auto;
  padding: 6px 22px 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.fd__couple {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 10px 0 4px;
}
.fd__person {
  width: 170px;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.fd__empty-av {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: 1.5px dashed var(--ft-border-strong);
  display: grid;
  place-items: center;
  color: var(--ft-faint);
}
.fd__heart {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: var(--ft-primary-soft);
  color: var(--ft-primary);
  flex: none;
}
.fd__statuses {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: center;
  button {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 6px 12px;
    border-radius: 999px;
    border: 1px solid var(--ft-border);
    background: var(--ft-surface);
    color: var(--ft-text-2);
    font: inherit;
    font-size: 13px;
    cursor: pointer;
    &:hover {
      border-color: var(--ft-border-strong);
    }
    &.active {
      background: var(--ft-primary);
      border-color: var(--ft-primary);
      color: #fff;
    }
  }
}
.fd__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.fd__sec {
  padding-top: 14px;
  border-top: 1px solid var(--ft-border);
}
.fd__sec-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.fd__kid {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 0;
}
.fd__link {
  width: 190px;
}
.fd__order {
  display: flex;
  flex-direction: column;
}
.fd__foot {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 12px 18px 16px;
  border-top: 1px solid var(--ft-border);
}
@media (max-width: 600px) {
  .fd__grid {
    grid-template-columns: 1fr;
  }
  .fd__link {
    width: 130px;
  }
}
</style>
