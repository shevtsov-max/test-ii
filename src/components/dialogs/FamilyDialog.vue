<script setup>
import { computed, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import DateInput from '@/components/common/DateInput.vue'
import PlaceInput from '@/components/common/PlaceInput.vue'
import PersonAvatar from '@/components/common/PersonAvatar.vue'
import { useTreeStore } from '@/stores/tree'
import { useUiStore } from '@/stores/ui'
import { emptyEvent, FAMILY_STATUSES, fullName, lifeSpan, shortName } from '@/utils/person'

const $q = useQuasar()
const store = useTreeStore()
const ui = useUiStore()

const open = computed({
  get: () => ui.familyDialog.open,
  set: (v) => (ui.familyDialog.open = v),
})
const fam = computed(() => (ui.familyDialog.familyId ? store.tree.families[ui.familyDialog.familyId] : undefined))
const partners = computed(() => (fam.value?.partners ?? []).map((id) => store.person(id)).filter(Boolean))

const status = ref('married')
const marriage = ref(emptyEvent())
const divorce = ref(emptyEvent())

watch(
  () => ui.familyDialog.open,
  (o) => {
    if (!o || !fam.value) return
    status.value = fam.value.status
    marriage.value = JSON.parse(JSON.stringify(fam.value.marriage))
    divorce.value = JSON.parse(JSON.stringify(fam.value.divorce ?? emptyEvent()))
  },
)

function save() {
  if (!fam.value) return
  store.updateFamily(fam.value.id, {
    status: status.value,
    marriage: marriage.value,
    divorce: status.value === 'divorced' ? divorce.value : emptyEvent(),
  })
  open.value = false
  $q.notify({ type: 'positive', message: 'Отношения обновлены', timeout: 1500 })
}

function addChild(kind) {
  if (!fam.value) return
  const parent = fam.value.partners[0]
  open.value = false
  ui.addRelative(parent, kind, fam.value.id)
}

function removeLink() {
  const f = fam.value
  if (!f || partners.value.length < 2) return
  const [a, b] = partners.value
  $q.dialog({
    title: 'Удалить связь между партнёрами?',
    message: f.children.length
      ? `Общие дети останутся детьми ${shortName(a)}.`
      : `${shortName(a)} и ${shortName(b)} больше не будут связаны.`,
    cancel: { flat: true, label: 'Отмена' },
    ok: { unelevated: true, label: 'Удалить связь', color: 'negative' },
  }).onOk(() => {
    store.removePartnership(f.id, a.id)
    open.value = false
  })
}
</script>

<template>
  <q-dialog v-model="open" transition-show="jump-up">
    <q-card v-if="fam" class="fd">
      <q-card-section class="row items-center no-wrap q-pb-sm">
        <div class="col text-h6 text-weight-bold">Отношения</div>
        <q-btn flat round dense icon="sym_r_close" v-close-popup />
      </q-card-section>

      <q-card-section class="q-pt-none">
        <div class="fd__couple">
          <template v-for="(p, i) in partners" :key="p.id">
            <div class="fd__person" :class="`gender-${p.gender}`">
              <PersonAvatar :person="p" :size="52" />
              <div class="text-weight-bold q-mt-xs text-center ellipsis-2-lines">{{ fullName(p) }}</div>
              <div class="text-caption text-muted">{{ lifeSpan(p) }}</div>
            </div>
            <div v-if="i === 0 && partners.length > 1" class="fd__heart">
              <q-icon :name="FAMILY_STATUSES.find((s) => s.value === status)?.icon" size="22px" />
            </div>
          </template>
        </div>

        <div class="fd__statuses">
          <button
            v-for="s in FAMILY_STATUSES"
            :key="s.value"
            :class="{ active: status === s.value }"
            type="button"
            @click="status = s.value"
          >
            <q-icon :name="s.icon" size="18px" />
            {{ s.label }}
          </button>
        </div>

        <div class="q-mt-md">
          <DateInput v-model="marriage.date" :label="status === 'partners' ? 'Начало отношений' : 'Дата брака'" />
          <div class="q-mt-sm"><PlaceInput v-model="marriage.place" label="Место" /></div>
        </div>
        <q-slide-transition>
          <div v-if="status === 'divorced'" class="q-mt-md">
            <DateInput v-model="divorce.date" label="Дата развода" />
            <div class="q-mt-sm"><PlaceInput v-model="divorce.place" label="Место развода" /></div>
          </div>
        </q-slide-transition>

        <div class="q-mt-lg">
          <div class="ft-section-title q-mb-xs">Общие дети · {{ fam.children.length }}</div>
          <div class="row q-gutter-xs items-center">
            <q-chip
              v-for="c in fam.children"
              :key="c"
              clickable
              @click="store.select(c); open = false"
            >
              <q-avatar><PersonAvatar :person="store.person(c)" :size="28" /></q-avatar>
              {{ shortName(store.person(c)) }}
            </q-chip>
            <template v-if="partners.length">
              <q-btn flat dense no-caps size="sm" color="primary" icon="sym_r_add" label="Сын" @click="addChild('son')" />
              <q-btn flat dense no-caps size="sm" color="primary" icon="sym_r_add" label="Дочь" @click="addChild('daughter')" />
            </template>
          </div>
        </div>
      </q-card-section>

      <q-card-actions class="q-px-md q-pb-md">
        <q-btn
          v-if="partners.length > 1"
          flat
          no-caps
          color="negative"
          icon="sym_r_link_off"
          label="Удалить связь"
          class="q-mr-auto"
          @click="removeLink"
        />
        <q-btn flat no-caps label="Отмена" color="grey-8" v-close-popup />
        <q-btn unelevated no-caps color="primary" label="Сохранить" class="q-px-lg" @click="save" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<style scoped lang="scss">
.fd {
  width: 560px;
  max-width: 96vw;
}
.fd__couple {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 12px 0 16px;
}
.fd__person {
  width: 160px;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.fd__heart {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: var(--ft-primary-soft);
  color: var(--ft-primary);
}
.fd__statuses {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 999px;
    border: 1px solid var(--ft-border);
    background: var(--ft-surface);
    color: var(--ft-text);
    font: inherit;
    font-size: 13px;
    cursor: pointer;
    transition: 0.15s;
    &:hover {
      border-color: var(--ft-primary);
    }
    &.active {
      background: var(--ft-primary);
      border-color: var(--ft-primary);
      color: #fff;
    }
  }
}
</style>
