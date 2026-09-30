<script setup>
/** Источники — архивные документы, метрические книги, переписи; где на них ссылаются. */
import { computed, ref } from 'vue'
import { useQuasar } from 'quasar'
import PageHeader from '@/components/ui/PageHeader.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import PersonChip from '@/components/person/PersonChip.vue'
import { useTreeStore } from '@/stores/tree'
import { useUiStore } from '@/stores/ui'
import { SOURCE_TYPES, sourceTypeInfo } from '@/domain/model'
import { formatDate } from '@/domain/dates'
import { normalize } from '@/domain/search'

const $q = useQuasar()
const tree = useTreeStore()
const ui = useUiStore()
const q = ref('')
const type = ref(null)
const open = ref(null)

// Кто ссылается на каждый источник
const usage = computed(() => {
  const map = new Map()
  const add = (list, pid) => {
    for (const c of list ?? []) {
      const u = map.get(c.sourceId) ?? { count: 0, persons: new Set() }
      u.count++
      if (pid) u.persons.add(pid)
      map.set(c.sourceId, u)
    }
  }
  for (const p of tree.persons) {
    add(p.citations, p.id)
    add(p.birth.citations, p.id)
    add(p.death.citations, p.id)
    for (const e of p.events) add(e.citations, p.id)
  }
  for (const f of Object.values(tree.tree.families)) {
    add(f.citations, f.partners[0])
    add(f.marriage.citations, f.partners[0])
  }
  return map
})
const list = computed(() => {
  const n = normalize(q.value)
  return Object.values(tree.tree.sources)
    .filter((s) => (!type.value || s.type === type.value) && (!n || normalize([s.title, s.repository, s.callNumber, s.author, s.note].join(' ')).includes(n)))
    .sort((a, b) => a.title.localeCompare(b.title, 'ru'))
})
function remove(s) {
  const n = usage.value.get(s.id)?.count ?? 0
  $q.dialog({
    title: `Удалить источник «${s.title}»?`,
    message: n ? `Будут удалены ${n} ссылок на него.` : 'Ссылок на источник нет.',
    cancel: { flat: true, label: 'Отмена', noCaps: true },
    ok: { unelevated: true, label: 'Удалить', color: 'negative', noCaps: true },
  }).onOk(() => tree.removeSource(s.id))
}
</script>

<template>
  <div class="ft-page srp">
    <PageHeader title="Источники" icon="sym_r_menu_book" subtitle="Откуда известны сведения: метрические книги, ревизские сказки, переписи, документы, рассказы родных">
      <q-btn v-if="!tree.readonly" unelevated no-caps color="primary" icon="sym_r_add" label="Добавить источник" @click="ui.editSource()" />
    </PageHeader>
    <div class="srp__bar">
      <q-input v-model="q" dense outlined clearable placeholder="Название, архив, шифр" class="srp__search" debounce="150">
        <template #prepend><q-icon name="sym_r_search" size="19px" /></template>
      </q-input>
      <q-select v-model="type" :options="SOURCE_TYPES" option-value="value" option-label="label" emit-value map-options dense outlined clearable label="Тип" class="srp__type" />
    </div>
    <div v-if="list.length" class="srp__list">
      <article v-for="s in list" :key="s.id" class="srp__item ft-card">
        <div class="srp__row" @click="open = open === s.id ? null : s.id">
          <span class="srp__icon"><q-icon :name="sourceTypeInfo(s.type).icon" size="20px" /></span>
          <div class="col min-w-0">
            <div class="fw-600">{{ s.title }}</div>
            <div class="text-muted" style="font-size: 13px">
              {{ [sourceTypeInfo(s.type).label, s.repository, s.callNumber, formatDate(s.date)].filter(Boolean).join(' · ') }}
            </div>
          </div>
          <span class="ft-chip">{{ usage.get(s.id)?.count ?? 0 }} ссыл.</span>
          <q-btn v-if="s.url" flat round dense icon="sym_r_open_in_new" :href="s.url" target="_blank" @click.stop />
          <template v-if="!tree.readonly">
            <q-btn flat round dense icon="sym_r_edit" class="text-muted" @click.stop="ui.editSource(s.id)" />
            <q-btn flat round dense icon="sym_r_delete" class="text-muted" @click.stop="remove(s)" />
          </template>
        </div>
        <q-slide-transition>
          <div v-if="open === s.id" class="srp__more">
            <div v-if="s.note" class="pre-line q-mb-md">{{ s.note }}</div>
            <div class="ft-label q-mb-sm">Ссылаются</div>
            <div v-if="usage.get(s.id)?.persons.size" class="srp__people">
              <PersonChip v-for="id in usage.get(s.id).persons" :key="id" :person-id="id" :size="28" />
            </div>
            <div v-else class="text-muted">Пока никто — сошлитесь на источник в карточке персоны, события или семьи.</div>
          </div>
        </q-slide-transition>
      </article>
    </div>
    <EmptyState v-else icon="sym_r_menu_book" title="Источников пока нет" text="Добавляйте источники сведений — так родословную можно будет проверить и дополнить.">
      <template #actions><q-btn v-if="!tree.readonly" unelevated no-caps color="primary" label="Добавить источник" @click="ui.editSource()" /></template>
    </EmptyState>
  </div>
</template>

<style scoped lang="scss">
.srp__bar {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}
.srp__search {
  width: 320px;
}
.srp__type {
  width: 220px;
}
.srp__list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.srp__row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  cursor: pointer;
}
.srp__icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  background: var(--ft-info-soft);
  color: var(--ft-info);
  flex: none;
}
.srp__more {
  padding: 4px 16px 16px 66px;
}
.srp__people {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
  gap: 8px;
}
</style>
