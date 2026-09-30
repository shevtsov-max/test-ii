<script setup>
/** Места — справочник с иерархией (страна → регион → город), кто родился, жил и умер в каждом месте. */
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import PageHeader from '@/components/ui/PageHeader.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import PersonChip from '@/components/person/PersonChip.vue'
import { useTreeStore } from '@/stores/tree'
import { useUiStore } from '@/stores/ui'
import { placeTypeInfo } from '@/domain/model'
import { placeFullName, placeMapUrl, placeUsage } from '@/domain/places'
import { normalize } from '@/domain/search'
import { residenceId } from '@/domain/person'

const $q = useQuasar()
const route = useRoute()
const router = useRouter()
const tree = useTreeStore()
const ui = useUiStore()

const filter = ref('')
const selected = ref(typeof route.query.place === 'string' ? route.query.place : null)
const expanded = ref([])
watch(selected, (id) => router.replace({ query: { ...route.query, place: id || undefined } }))

const usage = computed(() => placeUsage(tree.tree))
const places = computed(() => Object.values(tree.tree.places))

const nodes = computed(() => {
  const byParent = new Map()
  for (const p of places.value) {
    const k = p.parentId && tree.tree.places[p.parentId] ? p.parentId : null
    const arr = byParent.get(k) ?? []
    arr.push(p)
    byParent.set(k, arr)
  }
  const total = (id) => {
    let n = usage.value.get(id)?.persons.size ?? 0
    for (const c of byParent.get(id) ?? []) n += total(c.id)
    return n
  }
  const build = (pid) =>
    (byParent.get(pid) ?? [])
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
      .map((p) => ({ id: p.id, label: p.name, icon: placeTypeInfo(p.type).icon, count: total(p.id), children: build(p.id) }))
  return build(null)
})
const filterFn = (node, f) => normalize(node.label + ' ' + (tree.tree.places[node.id]?.altNames ?? '')).includes(normalize(f))
const unused = computed(() => places.value.filter((p) => !usage.value.get(p.id) && !places.value.some((c) => c.parentId === p.id)))

const pl = computed(() => (selected.value ? tree.tree.places[selected.value] : null))
const u = computed(() => (pl.value ? usage.value.get(pl.value.id) : null))
const groups = computed(() => {
  if (!pl.value) return []
  const id = pl.value.id
  const ps = tree.persons
  return [
    { title: 'Родились здесь', ids: ps.filter((p) => p.birth.placeId === id).map((p) => p.id) },
    { title: 'Жили здесь', ids: ps.filter((p) => residenceId(p) === id || p.events.some((e) => e.type === 'residence' && e.placeId === id)).map((p) => p.id) },
    { title: 'Умерли здесь', ids: ps.filter((p) => !p.living && p.death.placeId === id).map((p) => p.id) },
    { title: 'События жизни', ids: ps.filter((p) => p.events.some((e) => e.type !== 'residence' && e.placeId === id)).map((p) => p.id) },
    {
      title: 'Браки',
      ids: [...new Set(Object.values(tree.tree.families).filter((f) => f.marriage.placeId === id).flatMap((f) => f.partners))],
    },
  ].filter((g) => g.ids.length)
})

function remove() {
  const p = pl.value
  const n = u.value?.total ?? 0
  $q.dialog({
    title: `Удалить «${p.name}»?`,
    message: n ? `Место указано в ${n} записях — они останутся без места (или выберите «Объединить», чтобы перенести).` : 'Место нигде не используется.',
    cancel: { flat: true, label: 'Отмена', noCaps: true },
    ok: { unelevated: true, label: 'Удалить', color: 'negative', noCaps: true },
  }).onOk(() => {
    tree.removePlace(p.id, p.parentId)
    selected.value = p.parentId
  })
}
const mergeTarget = ref(null)
const mergeOptions = computed(() =>
  places.value
    .filter((x) => x.id !== selected.value)
    .map((x) => ({ value: x.id, label: placeFullName(tree.tree, x.id) }))
    .sort((a, b) => a.label.localeCompare(b.label, 'ru')),
)
function merge() {
  if (!mergeTarget.value) return
  const keep = mergeTarget.value
  tree.mergePlaces(keep, selected.value)
  selected.value = keep
  mergeTarget.value = null
  $q.notify({ type: 'positive', message: 'Места объединены', actions: [{ label: 'Отменить', color: 'white', handler: () => tree.undo() }] })
}
function removeUnused() {
  const ids = unused.value.map((p) => p.id)
  tree.commit('Удаление неиспользуемых мест', (d) => {
    for (const id of ids) delete d.places[id]
  })
  $q.notify({ message: `Удалено мест: ${ids.length}`, actions: [{ label: 'Отменить', color: 'primary', handler: () => tree.undo() }] })
}
</script>

<template>
  <div class="ft-page plp">
    <PageHeader title="Места" icon="sym_r_location_on" :subtitle="`${places.length} мест · города, сёла, храмы, кладбища`">
      <q-btn v-if="unused.length && !tree.readonly" flat no-caps color="primary" :label="`Удалить неиспользуемые (${unused.length})`" @click="removeUnused" />
      <q-btn v-if="!tree.readonly" unelevated no-caps color="primary" icon="sym_r_add_location_alt" label="Добавить место" @click="ui.editPlace()" />
    </PageHeader>

    <div v-if="places.length" class="plp__layout">
      <aside class="plp__tree ft-card">
        <q-input v-model="filter" dense outlined clearable placeholder="Найти место" class="q-mb-sm">
          <template #prepend><q-icon name="sym_r_search" size="19px" /></template>
        </q-input>
        <q-tree
          v-model:selected="selected"
          v-model:expanded="expanded"
          :nodes="nodes"
          node-key="id"
          :filter="filter"
          :filter-method="filterFn"
          no-connectors
          selected-color="primary"
          no-results-label="Ничего не найдено"
          class="plp__qtree"
        >
          <template #default-header="prop">
            <div class="plp__node">
              <q-icon :name="prop.node.icon" size="18px" class="text-muted" />
              <span class="ellipsis-1">{{ prop.node.label }}</span>
              <span v-if="prop.node.count" class="plp__count tabular">{{ prop.node.count }}</span>
            </div>
          </template>
        </q-tree>
      </aside>

      <section class="plp__detail">
        <div v-if="pl" class="ft-card ft-card--pad">
          <div class="plp__head">
            <span class="plp__icon"><q-icon :name="placeTypeInfo(pl.type).icon" size="24px" /></span>
            <div class="col min-w-0">
              <div class="ft-label">{{ placeTypeInfo(pl.type).label }}</div>
              <h2 class="ft-h2">{{ pl.name }}</h2>
              <div class="text-muted">{{ placeFullName(tree.tree, pl.id) }}</div>
            </div>
            <div class="plp__actions">
              <q-btn flat round dense icon="sym_r_map" :href="placeMapUrl(tree.tree, pl.id)" target="_blank" aria-label="На карте"><q-tooltip>Открыть на карте</q-tooltip></q-btn>
              <template v-if="!tree.readonly">
                <q-btn flat round dense icon="sym_r_add" aria-label="Вложенное место" @click="ui.editPlace(null, pl.id)"><q-tooltip>Добавить вложенное место</q-tooltip></q-btn>
                <q-btn flat round dense icon="sym_r_edit" aria-label="Изменить" @click="ui.editPlace(pl.id)"><q-tooltip>Изменить</q-tooltip></q-btn>
                <q-btn flat round dense icon="sym_r_delete" aria-label="Удалить" @click="remove"><q-tooltip>Удалить</q-tooltip></q-btn>
              </template>
            </div>
          </div>
          <div v-if="pl.altNames || pl.note || pl.lat != null" class="plp__meta">
            <div v-if="pl.altNames"><span class="text-muted">Другие названия:</span> {{ pl.altNames }}</div>
            <div v-if="pl.lat != null"><span class="text-muted">Координаты:</span> {{ pl.lat }}, {{ pl.lng }}</div>
            <div v-if="pl.note" class="pre-line">{{ pl.note }}</div>
          </div>
          <div class="plp__stats">
            <div><b>{{ u?.births ?? 0 }}</b><span>рождений</span></div>
            <div><b>{{ u?.deaths ?? 0 }}</b><span>смертей</span></div>
            <div><b>{{ u?.residence ?? 0 }}</b><span>жителей</span></div>
            <div><b>{{ u?.marriages ?? 0 }}</b><span>браков</span></div>
            <div><b>{{ u?.events ?? 0 }}</b><span>событий</span></div>
          </div>
          <div v-for="g in groups" :key="g.title" class="plp__group">
            <div class="ft-label q-mb-sm">{{ g.title }} · {{ g.ids.length }}</div>
            <div class="plp__people">
              <PersonChip v-for="id in g.ids" :key="id" :person-id="id" relation :size="30" class="plp__chip" />
            </div>
          </div>
          <div v-if="!tree.readonly" class="plp__merge">
            <div class="ft-label q-mb-sm">Это то же место, что и…</div>
            <div class="row q-gutter-sm items-center no-wrap">
              <q-select v-model="mergeTarget" :options="mergeOptions" emit-value map-options outlined dense use-input fill-input hide-selected input-debounce="0" label="Выберите место" class="col" />
              <q-btn outline no-caps color="primary" icon="sym_r_merge" label="Объединить" :disable="!mergeTarget" @click="merge" />
            </div>
          </div>
        </div>
        <EmptyState v-else compact icon="sym_r_travel_explore" title="Выберите место слева" text="Увидите, кто здесь родился, жил и умер. Места можно вкладывать друг в друга и объединять дубликаты." />
      </section>
    </div>
    <EmptyState v-else icon="sym_r_location_on" title="Мест пока нет" text="Места появляются, когда вы указываете, где человек родился, жил или умер.">
      <template #actions><q-btn v-if="!tree.readonly" unelevated no-caps color="primary" label="Добавить место" @click="ui.editPlace()" /></template>
    </EmptyState>
  </div>
</template>

<style scoped lang="scss">
.plp__layout {
  display: grid;
  grid-template-columns: 330px minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}
.plp__tree {
  padding: 12px;
  position: sticky;
  top: 12px;
  max-height: calc(100vh - 170px);
  overflow-y: auto;
}
.plp__node {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-width: 0;
}
.plp__count {
  margin-left: auto;
  font-size: 11.5px;
  color: var(--ft-faint);
  font-weight: 600;
}
.plp__head {
  display: flex;
  align-items: flex-start;
  gap: 14px;
}
.plp__icon {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  background: var(--ft-accent-soft);
  color: var(--ft-accent);
  flex: none;
}
.plp__actions {
  display: flex;
  color: var(--ft-muted);
}
.plp__meta {
  margin-top: 14px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 13.5px;
}
.plp__stats {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
  margin: 18px 0 8px;
  > div {
    padding: 10px 12px;
    border-radius: 12px;
    background: var(--ft-surface-2);
    display: flex;
    flex-direction: column;
    b {
      font-size: 20px;
    }
    span {
      font-size: 12px;
      color: var(--ft-muted);
    }
  }
}
.plp__group {
  margin-top: 16px;
}
.plp__people {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 8px;
}
.plp__chip {
  padding: 6px 8px;
  border: 1px solid var(--ft-border);
  border-radius: 10px;
}
.plp__merge {
  margin-top: 22px;
  padding-top: 16px;
  border-top: 1px solid var(--ft-border);
}
@media (max-width: 900px) {
  .plp__layout {
    grid-template-columns: 1fr;
  }
  .plp__tree {
    position: static;
    max-height: 360px;
  }
  .plp__stats {
    grid-template-columns: repeat(3, 1fr);
  }
}
</style>
