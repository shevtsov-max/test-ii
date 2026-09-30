<script setup>
defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  icon: { type: String, default: '' },
  back: { type: [String, Object], default: null },
})
</script>

<template>
  <header class="ph">
    <router-link v-if="back" :to="back" class="ph__back" aria-label="Назад">
      <q-icon name="sym_r_arrow_back" size="20px" />
    </router-link>
    <div v-if="icon" class="ph__icon"><q-icon :name="icon" size="22px" /></div>
    <div class="ph__text">
      <h1 class="ft-h1">{{ title }}</h1>
      <div v-if="subtitle || $slots.subtitle" class="ph__sub"><slot name="subtitle">{{ subtitle }}</slot></div>
    </div>
    <div v-if="$slots.default" class="ph__actions"><slot /></div>
  </header>
</template>

<style scoped lang="scss">
.ph {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 22px;
  flex-wrap: wrap;
}
.ph__back {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  color: var(--ft-muted);
  border: 1px solid var(--ft-border);
  background: var(--ft-surface);
  &:hover {
    color: var(--ft-text);
    border-color: var(--ft-border-strong);
  }
}
.ph__icon {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  background: var(--ft-primary-soft);
  color: var(--ft-primary-text);
  flex: none;
}
.ph__text {
  flex: 1;
  min-width: 200px;
}
.ph__sub {
  color: var(--ft-muted);
  margin-top: 2px;
}
.ph__actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
}
@media (max-width: 600px) {
  .ph__icon {
    display: none;
  }
}
</style>
