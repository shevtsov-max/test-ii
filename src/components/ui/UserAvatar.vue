<script setup>
import { computed } from 'vue'

const props = defineProps({
  name: { type: String, default: '' },
  src: { type: String, default: null },
  size: { type: Number, default: 32 },
  guest: Boolean,
})
const initials = computed(() =>
  props.guest
    ? ''
    : props.name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0])
        .join('')
        .toUpperCase(),
)
const hue = computed(() => [...props.name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 20))
</script>

<template>
  <span class="ua" :style="{ width: size + 'px', height: size + 'px', fontSize: size * 0.4 + 'px', '--h': hue }">
    <img v-if="src" :src="src" alt="" />
    <q-icon v-else-if="guest || !initials" name="sym_r_person" :size="size * 0.6 + 'px'" />
    <template v-else>{{ initials }}</template>
  </span>
</template>

<style scoped lang="scss">
.ua {
  position: relative;
  display: inline-grid;
  place-items: center;
  flex: none;
  border-radius: 50%;
  overflow: hidden;
  font-weight: 700;
  color: hsl(var(--h) 45% 32%);
  background: hsl(var(--h) 55% 88%);
  img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}
.ua:is(.body--dark *) {
  color: hsl(var(--h) 60% 80%);
  background: hsl(var(--h) 30% 24%);
}
</style>
