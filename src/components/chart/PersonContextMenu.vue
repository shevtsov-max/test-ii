<script setup>
/**
 * Меню по правому клику (или долгому нажатию) на персону — как в «Древе Жизни»:
 * профиль, изменение, добавление родственников, построение древа и росписи.
 */
import { computed, ref } from 'vue'
import PersonMenuList from '@/components/person/PersonMenuList.vue'
import { useTreeStore } from '@/stores/tree'
import { shortName } from '@/domain/names'

const props = defineProps({
  personId: { type: String, required: true },
  x: { type: Number, required: true },
  y: { type: Number, required: true },
  bounds: { type: Object, required: true },
})
const emit = defineEmits(['close'])
const tree = useTreeStore()
const open = ref(true)
const anchor = ref()
const p = computed(() => tree.person(props.personId))
</script>

<template>
  <div ref="anchor" class="pcm__anchor" :style="{ left: x + 'px', top: y + 'px' }">
    <q-menu v-model="open" :target="anchor" no-parent-event touch-position anchor="bottom left" self="top left" @hide="emit('close')">
      <div v-if="p" class="pcm__head">{{ shortName(p) }}</div>
      <PersonMenuList :person-id="personId" @done="open = false" />
    </q-menu>
  </div>
</template>

<style scoped lang="scss">
.pcm__anchor {
  position: absolute;
  width: 1px;
  height: 1px;
  pointer-events: none;
}
.pcm__head {
  padding: 10px 16px 6px;
  font-weight: 700;
  font-size: 13px;
  color: var(--ft-muted);
  max-width: 280px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
