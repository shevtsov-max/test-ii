<script setup>
defineProps({ zoom: { type: Number, required: true } })
const emit = defineEmits(['zoom-in', 'zoom-out', 'fit', 'home', 'center', 'fullscreen', 'reset'])
</script>

<template>
  <div class="cc" @pointerdown.stop @wheel.stop>
    <div class="cc__group">
      <q-btn flat dense icon="sym_r_restart_alt" aria-label="Сбросить вид" @click="emit('reset')">
        <q-tooltip anchor="center left" self="center right">Сбросить: «Это Вы» в центре, обычный масштаб (R)</q-tooltip>
      </q-btn>
      <q-btn flat dense icon="sym_r_center_focus_strong" aria-label="К центральной персоне" @click="emit('center')">
        <q-tooltip anchor="center left" self="center right">К центральной персоне (0)</q-tooltip>
      </q-btn>
      <q-btn flat dense icon="sym_r_fit_screen" aria-label="Показать всё" @click="emit('fit')">
        <q-tooltip anchor="center left" self="center right">Показать всё древо (F)</q-tooltip>
      </q-btn>
      <q-btn flat dense icon="sym_r_home" aria-label="Это Вы" @click="emit('home')">
        <q-tooltip anchor="center left" self="center right">К «Это Вы» (H)</q-tooltip>
      </q-btn>
      <q-btn flat dense icon="sym_r_fullscreen" aria-label="Во весь экран" @click="emit('fullscreen')">
        <q-tooltip anchor="center left" self="center right">Во весь экран</q-tooltip>
      </q-btn>
    </div>
    <div class="cc__group">
      <q-btn flat dense icon="sym_r_add" aria-label="Увеличить" @click="emit('zoom-in')">
        <q-tooltip anchor="center left" self="center right">Увеличить (+)</q-tooltip>
      </q-btn>
      <div class="cc__zoom tabular">{{ zoom }}%</div>
      <q-btn flat dense icon="sym_r_remove" aria-label="Уменьшить" @click="emit('zoom-out')">
        <q-tooltip anchor="center left" self="center right">Уменьшить (−)</q-tooltip>
      </q-btn>
    </div>
  </div>
</template>

<style scoped lang="scss">
.cc {
  position: absolute;
  right: 14px;
  bottom: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 5;
}
.cc__group {
  display: flex;
  flex-direction: column;
  background: color-mix(in srgb, var(--ft-surface) 94%, transparent);
  border: 1px solid var(--ft-border);
  border-radius: 12px;
  box-shadow: var(--ft-shadow);
  padding: 3px;
  backdrop-filter: blur(8px);
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
  font-weight: 650;
  text-align: center;
  color: var(--ft-muted);
  padding: 2px 0;
}
</style>
