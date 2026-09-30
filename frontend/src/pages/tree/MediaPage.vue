<script setup>
/** Медиа и документы — все фото, сканы и файлы древа. */
import { computed, ref } from 'vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import MediaGrid from '@/components/media/MediaGrid.vue'
import { useTreeStore } from '@/stores/tree'
import { useMediaUpload } from '@/composables/useMediaUpload'
import { MEDIA_KINDS } from '@/domain/model'
import { sortKey } from '@/domain/dates'
import { normalize } from '@/domain/search'
import { shortName } from '@/domain/names'
import { formatBytes } from '@/utils/files'

const tree = useTreeStore()
const { uploadFor } = useMediaUpload()
const kind = ref('all')
const q = ref('')
const sort = ref('added')
const onlyUntagged = ref(false)

const all = computed(() => Object.values(tree.tree.media))
const items = computed(() => {
  const n = normalize(q.value)
  const list = all.value.filter((m) => {
    if (kind.value !== 'all' && m.kind !== kind.value) return false
    if (onlyUntagged.value && m.personIds.length) return false
    if (n) {
      const hay = normalize([m.title, m.description, ...m.personIds.map((id) => shortName(tree.person(id)))].join(' '))
      if (!hay.includes(n)) return false
    }
    return true
  })
  if (sort.value === 'date') return list.sort((a, b) => sortKey(a.date) - sortKey(b.date))
  if (sort.value === 'title') return list.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'ru'))
  return list.sort((a, b) => b.createdAt - a.createdAt)
})
const size = computed(() => all.value.reduce((s, m) => s + (m.size || 0), 0))
const counts = computed(() => Object.fromEntries(MEDIA_KINDS.map((k) => [k.value, all.value.filter((m) => m.kind === k.value).length])))
</script>

<template>
  <div class="ft-page mdp">
    <PageHeader title="Медиа и документы" icon="sym_r_photo_library" :subtitle="`${all.length} файлов${size ? ' · ' + formatBytes(size) : ''} · фото, сканы документов, письма, записи`">
      <q-btn v-if="!tree.readonly" unelevated no-caps color="primary" icon="sym_r_upload" label="Загрузить" @click="uploadFor([])" />
    </PageHeader>
    <div class="mdp__bar">
      <div class="mdp__kinds">
        <button type="button" :class="{ active: kind === 'all' }" @click="kind = 'all'">Все <small>{{ all.length }}</small></button>
        <template v-for="k in MEDIA_KINDS" :key="k.value">
          <button v-if="counts[k.value]" type="button" :class="{ active: kind === k.value }" @click="kind = k.value">
            <q-icon :name="k.icon" size="16px" />{{ k.label }} <small>{{ counts[k.value] }}</small>
          </button>
        </template>
      </div>
      <q-space />
      <q-toggle v-model="onlyUntagged" label="Никто не отмечен" dense />
      <q-input v-model="q" dense outlined clearable placeholder="Название или человек" class="mdp__search" debounce="150">
        <template #prepend><q-icon name="sym_r_search" size="19px" /></template>
      </q-input>
      <q-select v-model="sort" dense outlined emit-value map-options :options="[{ value: 'added', label: 'Сначала новые' }, { value: 'date', label: 'По дате снимка' }, { value: 'title', label: 'По названию' }]" class="mdp__sort" />
    </div>
    <MediaGrid v-if="items.length" :items="items" :droppable="!tree.readonly" @drop-files="(files) => uploadFor([], { files })" />
    <EmptyState v-else icon="sym_r_add_photo_alternate" title="Файлов пока нет" text="Загрузите фотографии и документы семьи, затем отметьте на них людей. Можно перетащить файлы в окно.">
      <template #actions><q-btn v-if="!tree.readonly" unelevated no-caps color="primary" icon="sym_r_upload" label="Загрузить файлы" @click="uploadFor([])" /></template>
    </EmptyState>
  </div>
</template>

<style scoped lang="scss">
.mdp__bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 16px;
}
.mdp__kinds {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
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
    font-weight: 600;
    cursor: pointer;
    small {
      color: var(--ft-faint);
    }
    &.active {
      background: var(--ft-primary-soft);
      border-color: var(--ft-primary);
      color: var(--ft-primary-text);
    }
  }
}
.mdp__search {
  width: 240px;
}
.mdp__sort {
  width: 180px;
}
</style>
