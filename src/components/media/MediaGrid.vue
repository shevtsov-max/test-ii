<script setup>
/** Сетка фото и документов: просмотр, главное фото, изменение; можно перетащить файлы. */
import { ref } from 'vue'
import { useTreeStore } from '@/stores/tree'
import { useUiStore } from '@/stores/ui'
import { formatDate } from '@/domain/dates'
import { mediaKindInfo } from '@/domain/model'

const props = defineProps({
  items: { type: Array, required: true },
  personId: { type: String, default: null },
  small: Boolean,
  droppable: Boolean,
  selectable: Boolean,
})
const emit = defineEmits(['drop-files'])
const tree = useTreeStore()
const ui = useUiStore()
const over = ref(false)

const open = (i) => ui.viewMedia(props.items.map((m) => m.id), i)
function onDrop(e) {
  over.value = false
  const files = [...(e.dataTransfer?.files ?? [])]
  if (files.length) emit('drop-files', files)
}
</script>

<template>
  <div
    class="mg"
    :class="{ 'mg--small': small, 'mg--over': over }"
    @dragover.prevent="droppable && (over = true)"
    @dragleave="over = false"
    @drop.prevent="droppable && onDrop($event)"
  >
    <div v-for="(m, i) in items" :key="m.id" class="mg__item" @click="open(i)">
      <img v-if="m.thumb" :src="m.thumb" :alt="m.title" loading="lazy" />
      <div v-else class="mg__doc"><q-icon :name="mediaKindInfo(m.kind).icon" size="34px" /></div>
      <div v-if="personId && tree.person(personId)?.avatarId === m.id" class="mg__badge"><q-icon name="sym_r_account_circle" size="13px" /> Главное</div>
      <div v-if="!small" class="mg__bar">
        <div class="min-w-0 col">
          <div class="ellipsis-1 fw-600">{{ m.title || 'Без названия' }}</div>
          <div class="ellipsis-1 mg__sub">{{ [formatDate(m.date), m.personIds.length > 1 ? `${m.personIds.length} чел.` : ''].filter(Boolean).join(' · ') }}</div>
        </div>
        <q-btn v-if="!tree.readonly" flat round dense size="sm" icon="sym_r_more_vert" color="white" @click.stop>
          <q-menu>
            <q-list dense style="min-width: 210px">
              <q-item v-if="personId && m.kind === 'photo'" v-close-popup clickable @click="tree.setAvatar(personId, m.id)">
                <q-item-section avatar><q-icon name="sym_r_account_circle" /></q-item-section>
                <q-item-section>Сделать главным фото</q-item-section>
              </q-item>
              <q-item v-close-popup clickable @click="ui.editMedia(m.id)">
                <q-item-section avatar><q-icon name="sym_r_edit" /></q-item-section>
                <q-item-section>Изменить сведения</q-item-section>
              </q-item>
              <q-item v-if="personId" v-close-popup clickable @click="tree.linkMedia(m.id, personId, false)">
                <q-item-section avatar><q-icon name="sym_r_link_off" /></q-item-section>
                <q-item-section>Убрать у этой персоны</q-item-section>
              </q-item>
            </q-list>
          </q-menu>
        </q-btn>
      </div>
    </div>
    <div v-if="over" class="mg__drop"><q-icon name="sym_r_upload" size="28px" />Отпустите, чтобы загрузить</div>
  </div>
</template>

<style scoped lang="scss">
.mg {
  position: relative;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
  gap: 12px;
  border-radius: 14px;
}
.mg--small {
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
.mg__item {
  position: relative;
  aspect-ratio: 1;
  border-radius: 14px;
  overflow: hidden;
  background: var(--ft-surface-3);
  cursor: zoom-in;
  img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.25s;
  }
  &:hover img {
    transform: scale(1.04);
  }
}
.mg--small .mg__item {
  border-radius: 10px;
}
.mg__doc {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: var(--ft-muted);
}
.mg__badge {
  position: absolute;
  left: 8px;
  top: 8px;
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--ft-primary);
  color: #fff;
  font-size: 11px;
  font-weight: 650;
}
.mg__bar {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: flex-end;
  gap: 4px;
  padding: 22px 4px 6px 10px;
  color: #fff;
  font-size: 12.5px;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.65));
}
.mg__sub {
  font-size: 11.5px;
  opacity: 0.8;
}
.mg--over {
  outline: 2px dashed var(--ft-primary);
  outline-offset: 6px;
}
.mg__drop {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  background: color-mix(in srgb, var(--ft-primary-soft) 85%, transparent);
  color: var(--ft-primary-text);
  font-weight: 700;
  border-radius: 14px;
  pointer-events: none;
}
</style>
