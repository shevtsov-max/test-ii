<script setup lang="ts">
import { computed } from 'vue'
import type { Gender, Person } from '@/types'
import { useTreeStore } from '@/stores/tree'

const props = withDefaults(
  defineProps<{
    person?: Person | null
    gender?: Gender
    size?: number
    camera?: boolean
    ring?: boolean
    photos?: boolean
  }>(),
  { size: 44, camera: false, ring: false, photos: true },
)
const emit = defineEmits<{ camera: [] }>()
const store = useTreeStore()

const g = computed<Gender>(() => props.person?.gender ?? props.gender ?? 'U')
const src = computed(() => (props.photos ? store.avatarOf(props.person) : undefined))
</script>

<template>
  <div
    class="pa"
    :class="[`gender-${g}`, { 'pa--ring': ring }]"
    :style="{ width: size + 'px', height: size + 'px' }"
  >
    <img v-if="src" :src="src" alt="" class="pa__img" draggable="false" />
    <svg v-else viewBox="0 0 64 64" class="pa__svg" aria-hidden="true">
      <template v-if="g === 'F'">
        <path d="M32 11c-10 0-15.5 7.5-15.5 17 0 7 1.5 13 -2.5 18 4 1.5 8 1.8 11 1.2L32 50l7-2.8c3 .6 7 .3 11-1.2-4-5-2.5-11-2.5-18 0-9.5-5.5-17-15.5-17z" class="hair" />
        <circle cx="32" cy="29" r="10.5" class="skin" />
        <path d="M12 64c1.5-11 9.5-16 20-16s18.5 5 20 16z" class="body" />
      </template>
      <template v-else>
        <circle cx="32" cy="26" r="11.5" class="skin" />
        <path d="M20.5 24c0-8 5-12.5 11.5-12.5S43.5 16 43.5 24c-2-4-6-6-11.5-6s-9.5 2-11.5 6z" class="hair" />
        <path d="M11 64c1.5-12 10-17.5 21-17.5S51.5 52 53 64z" class="body" />
      </template>
    </svg>
    <button v-if="camera" class="pa__cam" type="button" title="Добавить фото" @click.stop="emit('camera')">
      <q-icon name="sym_r_photo_camera" size="12px" />
    </button>
  </div>
</template>

<style scoped lang="scss">
.pa {
  position: relative;
  flex: none;
  border-radius: 50%;
  background: var(--g-soft);
  display: grid;
  place-items: center;
}
.pa--ring {
  box-shadow: 0 0 0 2px var(--ft-surface), 0 0 0 4px var(--g);
}
.pa__img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
}
.pa__svg {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  overflow: hidden;
  .skin {
    fill: color-mix(in srgb, var(--g) 30%, var(--ft-surface));
  }
  .hair {
    fill: color-mix(in srgb, var(--g) 55%, var(--ft-surface));
  }
  .body {
    fill: color-mix(in srgb, var(--g) 45%, var(--ft-surface));
  }
}
.pa__cam {
  position: absolute;
  right: -3px;
  bottom: -3px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid var(--ft-surface);
  background: var(--ft-surface-2);
  color: var(--ft-muted);
  display: grid;
  place-items: center;
  padding: 0;
  cursor: pointer;
  transition: 0.15s;
  &:hover {
    background: var(--ft-primary);
    color: #fff;
  }
}
</style>
