<script setup>
defineProps({
  label: { type: String, required: true },
  value: { type: [String, Number], required: true },
  hint: { type: String, default: '' },
  icon: { type: String, default: '' },
  tone: { type: String, default: 'neutral' },
  to: { type: [String, Object], default: null },
})
</script>

<template>
  <component :is="to ? 'router-link' : 'div'" :to="to ?? undefined" class="sc ft-card" :class="[`sc--${tone}`, { 'ft-card--hover': to }]">
    <div class="sc__top">
      <span class="sc__label">{{ label }}</span>
      <span v-if="icon" class="sc__icon"><q-icon :name="icon" size="18px" /></span>
    </div>
    <div class="sc__value tabular">{{ value }}</div>
    <div v-if="hint" class="sc__hint">{{ hint }}</div>
  </component>
</template>

<style scoped lang="scss">
.sc {
  display: flex;
  flex-direction: column;
  padding: 14px 16px;
  min-width: 0;
  color: var(--ft-text);
  text-decoration: none !important;
}
.sc__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.sc__label {
  font-size: 12.5px;
  color: var(--ft-muted);
  font-weight: 550;
}
.sc__icon {
  width: 30px;
  height: 30px;
  border-radius: 9px;
  display: grid;
  place-items: center;
  background: var(--ft-surface-3);
  color: var(--ft-muted);
}
.sc--primary .sc__icon {
  background: var(--ft-primary-soft);
  color: var(--ft-primary-text);
}
.sc--accent .sc__icon {
  background: var(--ft-accent-soft);
  color: var(--ft-accent);
}
.sc--info .sc__icon {
  background: var(--ft-info-soft);
  color: var(--ft-info);
}
.sc--warning .sc__icon {
  background: var(--ft-warning-soft);
  color: var(--ft-warning);
}
.sc__value {
  font-size: 26px;
  font-weight: 750;
  letter-spacing: -0.02em;
  line-height: 1.2;
  margin-top: 4px;
}
.sc__hint {
  font-size: 12.5px;
  color: var(--ft-muted);
  margin-top: 2px;
}
</style>
