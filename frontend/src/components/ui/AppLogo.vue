<script setup>
/** Знак «Прапра»: крона — предки, зеркальные корни — потомки, в центре — «Вы». Тот же рисунок — public/favicon.svg. */
defineProps({
  size: { type: Number, default: 30 },
  text: { type: Boolean, default: true },
  to: { type: [String, Object], default: null },
})
</script>

<template>
  <component :is="to ? 'router-link' : 'div'" :to="to ?? undefined" class="logo" aria-label="Прапра">
    <svg :width="size" :height="size" viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="logo-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#EF7B4F" />
          <stop offset="1" stop-color="#C4401D" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill="url(#logo-g)" />
      <g fill="none" stroke="#fff" stroke-width="3.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M32 32V12M32 23.5l-9.5-7.5M32 23.5l9.5-7.5M32 17.5l-4.5-5.5M32 17.5l4.5-5.5"/>
        <path d="M32 32v20M32 40.5l-9.5 7.5M32 40.5l9.5 7.5M32 46.5l-4.5 5.5M32 46.5l4.5 5.5"/>
      </g>
      <circle cx="32" cy="32" r="5.6" fill="#FFE1BF" stroke="#fff" stroke-width="1.6"/>
    </svg>
    <span v-if="text" class="logo__text">Прапра</span>
  </component>
</template>

<style scoped lang="scss">
.logo {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: var(--ft-text);
  text-decoration: none !important;
  flex: none;
}
.logo__text {
  font-family: var(--ft-font-display);
  font-size: 19px;
  font-weight: 650;
  letter-spacing: -0.01em;
}
</style>
