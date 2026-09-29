<script setup>
import { computed } from 'vue'
import { useUiStore } from '@/stores/ui'

const ui = useUiStore()
const open = computed({
  get: () => ui.helpOpen,
  set: (v) => (ui.helpOpen = v),
})

const tips = [
  {
    icon: 'sym_r_add_circle',
    text: 'Нажмите «+» под карточкой, чтобы добавить отца, мать, брата, сестру, партнёра или ребёнка.',
  },
  { icon: 'sym_r_edit', text: 'Карандаш на карточке — быстрое редактирование. Двойной клик — сделать персону центральной.' },
  { icon: 'sym_r_favorite', text: 'Значок на линии между партнёрами открывает отношения: брак, развод, даты и общие дети.' },
  {
    icon: 'sym_r_keyboard_arrow_up',
    text: 'Цветные стрелки над/под карточкой — есть скрытые предки или потомки, нажмите, чтобы перейти.',
  },
  { icon: 'sym_r_link', text: 'При добавлении можно выбрать «Из древа», чтобы связать уже существующих людей.' },
  { icon: 'sym_r_cloud_sync', text: 'Данные сохраняются в браузере автоматически. Для переноса используйте JSON или GEDCOM.' },
]
const keys = [
  ['Колесо мыши / щипок', 'масштаб'],
  ['Перетаскивание', 'перемещение по древу'],
  ['+ / −', 'увеличить / уменьшить'],
  ['F', 'показать всё древо'],
  ['0', 'к центральной персоне, 100%'],
  ['← ↑ → ↓', 'сдвинуть холст'],
  ['Ctrl + Z / Ctrl + Shift + Z', 'отменить / повторить'],
  ['Esc', 'закрыть окно'],
]
</script>

<template>
  <q-dialog v-model="open">
    <q-card style="width: 600px; max-width: 96vw">
      <q-card-section class="row items-center no-wrap">
        <div class="col text-h6 text-weight-bold">Как пользоваться</div>
        <q-btn flat round dense icon="sym_r_close" v-close-popup />
      </q-card-section>
      <q-card-section class="q-pt-none">
        <q-list dense>
          <q-item v-for="t in tips" :key="t.text" class="q-px-none">
            <q-item-section avatar><q-icon :name="t.icon" color="primary" /></q-item-section>
            <q-item-section>{{ t.text }}</q-item-section>
          </q-item>
        </q-list>
        <div class="ft-section-title q-mt-md q-mb-sm">Клавиши</div>
        <div v-for="k in keys" :key="k[0]" class="row items-center q-py-xs">
          <div class="col-6"><span class="kbd">{{ k[0] }}</span></div>
          <div class="col-6 text-muted">{{ k[1] }}</div>
        </div>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>
