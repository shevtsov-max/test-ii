<script setup>
defineProps({
  zoom: { type: Number, required: true },
  fullscreen: { type: Boolean, required: true },
})
const emit = defineEmits(['zoom-in', 'zoom-out', 'fit', 'home', 'center', 'fullscreen'])
</script>

<template>
  <div class="cc" @pointerdown.stop @wheel.stop>
    <div class="cc__group">
      <q-btn flat dense icon="sym_r_center_focus_strong" @click="emit('center')">
        <q-tooltip anchor="center left" self="center right">К центральной персоне</q-tooltip>
      </q-btn>
      <q-btn flat dense icon="sym_r_fit_screen" @click="emit('fit')">
        <q-tooltip anchor="center left" self="center right">Показать всё древо (F)</q-tooltip>
      </q-btn>
      <q-btn flat dense icon="sym_r_home" @click="emit('home')">
        <q-tooltip anchor="center left" self="center right">Домашняя персона</q-tooltip>
      </q-btn>
      <q-btn flat dense :icon="fullscreen ? 'sym_r_fullscreen_exit' : 'sym_r_fullscreen'" @click="emit('fullscreen')">
        <q-tooltip anchor="center left" self="center right">Полный экран</q-tooltip>
      </q-btn>
    </div>
    <div class="cc__group">
      <q-btn flat dense icon="sym_r_add" @click="emit('zoom-in')">
        <q-tooltip anchor="center left" self="center right">Увеличить (+)</q-tooltip>
      </q-btn>
      <div class="cc__zoom">{{ zoom }}%</div>
      <q-btn flat dense icon="sym_r_remove" @click="emit('zoom-out')">
        <q-tooltip anchor="center left" self="center right">Уменьшить (−)</q-tooltip>
      </q-btn>
    </div>
  </div>
</template>

<style scoped lang="scss">
.cc {
  position: absolute;
  right: 16px;
  bottom: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  z-index: 5;
}
.cc__group {
  display: flex;
  flex-direction: column;
  background: var(--ft-surface);
  border: 1px solid var(--ft-border);
  border-radius: 12px;
  box-shadow: var(--ft-shadow);
  padding: 3px;
  .q-btn {
    width: 36px;
    height: 36px;
    border-radius: 9px;
    color: var(--ft-muted);
    &:hover {
      color: var(--ft-text);
    }
  }
}
.cc__zoom {
  font-size: 10.5px;
  font-weight: 600;
  text-align: center;
  color: var(--ft-muted);
  padding: 2px 0;
}
</style>
