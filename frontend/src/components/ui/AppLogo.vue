<script setup>
defineProps({
  size: { type: Number, default: 30 },
  text: { type: Boolean, default: true },
  to: { type: [String, Object], default: null },
})
</script>

<template>
  <component :is="to ? 'router-link' : 'div'" :to="to ?? undefined" class="logo" aria-label="Родословная">
    <svg :width="size" :height="size" viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="logo-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#EF7B4F" />
          <stop offset="1" stop-color="#C4401D" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill="url(#logo-g)" />
      <g fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round">
        <path d="M32 21.5v8.5M17.5 39v-4.5a4.5 4.5 0 0 1 4.5-4.5h20a4.5 4.5 0 0 1 4.5 4.5V39" />
      </g>
      <g fill="#fff">
        <circle cx="32" cy="15.5" r="6.5" />
        <circle cx="17.5" cy="45.5" r="6.5" />
        <circle cx="46.5" cy="45.5" r="6.5" />
      </g>
    </svg>
    <span v-if="text" class="logo__text">Родословная</span>
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
