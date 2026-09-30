<script setup>
defineProps({
  icon: { type: String, default: 'sym_r_inbox' },
  title: { type: String, required: true },
  text: { type: String, default: '' },
  compact: Boolean,
})
</script>

<template>
  <div class="es" :class="{ 'es--compact': compact }">
    <div class="es__icon"><q-icon :name="icon" :size="compact ? '26px' : '34px'" /></div>
    <div class="es__title">{{ title }}</div>
    <div v-if="text || $slots.default" class="es__text"><slot>{{ text }}</slot></div>
    <div v-if="$slots.actions" class="es__actions"><slot name="actions" /></div>
  </div>
</template>

<style scoped lang="scss">
.es {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 48px 20px;
  gap: 6px;
}
.es--compact {
  padding: 24px 12px;
}
.es__icon {
  width: 68px;
  height: 68px;
  border-radius: 20px;
  display: grid;
  place-items: center;
  background: var(--ft-surface-3);
  color: var(--ft-muted);
  margin-bottom: 8px;
}
.es--compact .es__icon {
  width: 52px;
  height: 52px;
  border-radius: 16px;
}
.es__title {
  font-size: 16px;
  font-weight: 700;
}
.es__text {
  color: var(--ft-muted);
  max-width: 440px;
}
.es__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  margin-top: 12px;
}
</style>
