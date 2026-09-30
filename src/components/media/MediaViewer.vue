<script setup>
/** Просмотр фото и документов на весь экран: листание, сведения, отмеченные люди. */
import { computed, onBeforeUnmount, onMounted } from 'vue'
import PersonChip from '@/components/person/PersonChip.vue'
import { useTreeStore } from '@/stores/tree'
import { useUiStore } from '@/stores/ui'
import { useMediaUrl } from '@/composables/useMediaUrl'
import { formatDate } from '@/domain/dates'
import { mediaKindInfo } from '@/domain/model'
import { placeFullName } from '@/domain/places'
import { formatBytes } from '@/utils/files'

const tree = useTreeStore()
const ui = useUiStore()
const open = computed({
  get: () => ui.mediaViewer.open,
  set: (v) => (ui.mediaViewer.open = v),
})
const ids = computed(() => ui.mediaViewer.ids.filter((id) => tree.tree?.media[id]))
const index = computed({
  get: () => Math.min(ui.mediaViewer.index, Math.max(0, ids.value.length - 1)),
  set: (v) => (ui.mediaViewer.index = v),
})
const m = computed(() => tree.tree?.media[ids.value[index.value]])
const { url, loading } = useMediaUrl(m)
const isImage = computed(() => m.value?.kind === 'photo' || /^image\//.test(m.value?.mime ?? ''))
const isPdf = computed(() => /pdf/.test(m.value?.mime ?? '') || /\.pdf$/i.test(m.value?.src ?? ''))

const go = (d) => {
  const n = ids.value.length
  if (n > 1) index.value = (index.value + d + n) % n
}
function onKey(e) {
  if (!open.value) return
  if (e.key === 'ArrowLeft') go(-1)
  else if (e.key === 'ArrowRight') go(1)
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

function download() {
  if (!url.value) return
  const a = document.createElement('a')
  a.href = url.value
  a.download = (m.value.title || 'file') + (isImage.value ? '.jpg' : '')
  a.click()
}
</script>

<template>
  <q-dialog v-model="open" maximized transition-show="fade" transition-hide="fade">
    <div v-if="m" class="mv">
      <div class="mv__stage" @click.self="open = false">
        <q-spinner v-if="loading && !url" color="white" size="40px" />
        <img v-else-if="isImage && url" :src="url" :alt="m.title" class="mv__img" />
        <iframe v-else-if="isPdf && url" :src="url" class="mv__pdf" :title="m.title" />
        <div v-else class="mv__file">
          <q-icon :name="mediaKindInfo(m.kind).icon" size="64px" />
          <div class="q-mt-sm">{{ m.title || 'Файл' }}</div>
          <q-btn v-if="url" unelevated no-caps color="white" text-color="dark" label="Скачать" class="q-mt-md" @click="download" />
        </div>
        <q-btn v-if="ids.length > 1" round flat icon="sym_r_chevron_left" color="white" size="lg" class="mv__nav mv__nav--l" aria-label="Предыдущее" @click="go(-1)" />
        <q-btn v-if="ids.length > 1" round flat icon="sym_r_chevron_right" color="white" size="lg" class="mv__nav mv__nav--r" aria-label="Следующее" @click="go(1)" />
      </div>
      <aside class="mv__side ft-scroll">
        <div class="mv__top">
          <span class="text-muted">{{ index + 1 }} из {{ ids.length }}</span>
          <q-space />
          <q-btn flat round dense icon="sym_r_download" :disable="!url" aria-label="Скачать" @click="download"><q-tooltip>Скачать</q-tooltip></q-btn>
          <q-btn v-if="!tree.readonly" flat round dense icon="sym_r_edit" aria-label="Изменить" @click="ui.editMedia(m.id)"><q-tooltip>Изменить</q-tooltip></q-btn>
          <q-btn v-close-popup flat round dense icon="sym_r_close" aria-label="Закрыть" />
        </div>
        <div class="ft-h3 q-mt-sm">{{ m.title || 'Без названия' }}</div>
        <div class="mv__meta">
          <span class="ft-chip">{{ mediaKindInfo(m.kind).label }}</span>
          <span v-if="formatDate(m.date)">{{ formatDate(m.date) }}</span>
          <span v-if="m.placeId">{{ placeFullName(tree.tree, m.placeId) }}</span>
          <span v-if="m.size" class="text-faint">{{ formatBytes(m.size) }}</span>
        </div>
        <div v-if="m.description" class="mv__desc pre-line">{{ m.description }}</div>
        <div class="ft-label q-mt-lg q-mb-sm">На фото / в документе</div>
        <div class="mv__people">
          <PersonChip v-for="pid in m.personIds" :key="pid" :person-id="pid" :size="32" @click="open = false">
            <q-btn
              v-if="!tree.readonly && tree.person(pid)?.avatarId !== m.id && isImage"
              flat
              round
              dense
              size="sm"
              icon="sym_r_account_circle"
              class="text-muted"
              @click.prevent.stop="tree.setAvatar(pid, m.id)"
            >
              <q-tooltip>Сделать главным фото</q-tooltip>
            </q-btn>
          </PersonChip>
          <div v-if="!m.personIds.length" class="text-muted" style="font-size: 13px">Никто не отмечен</div>
        </div>
        <div v-if="m.sourceId && tree.tree.sources[m.sourceId]" class="q-mt-md">
          <div class="ft-label q-mb-xs">Источник</div>
          {{ tree.tree.sources[m.sourceId].title }}
        </div>
      </aside>
    </div>
  </q-dialog>
</template>

<style scoped lang="scss">
.mv {
  display: grid;
  grid-template-columns: 1fr 340px;
  background: rgba(10, 12, 16, 0.96);
  height: 100vh;
}
.mv__stage {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  padding: 24px 64px;
}
.mv__img {
  max-width: 100%;
  max-height: 92vh;
  object-fit: contain;
  border-radius: 6px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
}
.mv__pdf {
  width: 100%;
  height: 92vh;
  border: 0;
  border-radius: 6px;
  background: #fff;
}
.mv__file {
  color: #fff;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.mv__nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
}
.mv__nav--l {
  left: 10px;
}
.mv__nav--r {
  right: 10px;
}
.mv__side {
  background: var(--ft-surface);
  padding: 14px 18px 24px;
  overflow-y: auto;
}
.mv__top {
  display: flex;
  align-items: center;
  gap: 2px;
  font-size: 13px;
}
.mv__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-top: 8px;
  font-size: 13px;
  color: var(--ft-text-2);
}
.mv__desc {
  margin-top: 12px;
  font-size: 13.5px;
  color: var(--ft-text-2);
}
.mv__people {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
@media (max-width: 800px) {
  .mv {
    grid-template-columns: 1fr;
    grid-template-rows: 1fr auto;
  }
  .mv__stage {
    padding: 12px;
  }
  .mv__side {
    max-height: 40vh;
  }
}
</style>
