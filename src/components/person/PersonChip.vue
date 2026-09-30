<script setup>
import { computed } from 'vue'
import PersonAvatar from './PersonAvatar.vue'
import { useTreeStore } from '@/stores/tree'
import { useTreeNav } from '@/composables/useTreeNav'
import { shortName, fullName } from '@/domain/names'
import { lifeSpan } from '@/domain/person'

const props = defineProps({
  personId: { type: String, required: true },
  caption: { type: String, default: null },
  size: { type: Number, default: 34 },
  full: Boolean,
  link: { type: Boolean, default: true },
  relation: Boolean,
})
const emit = defineEmits(['click'])
const tree = useTreeStore()
const nav = useTreeNav()
const p = computed(() => tree.person(props.personId))
const sub = computed(() => {
  if (props.caption !== null) return props.caption
  const parts = [lifeSpan(p.value)]
  if (props.relation) parts.push(tree.relationToHome(props.personId))
  return parts.filter(Boolean).join(' · ')
})
</script>

<template>
  <component
    :is="link ? 'router-link' : 'div'"
    v-if="p"
    :to="link ? nav.personRoute(personId) : undefined"
    class="pch"
    :class="`gender-${p.gender}`"
    @click="emit('click', $event)"
  >
    <PersonAvatar :person="p" :size="size" />
    <div class="pch__text">
      <div class="pch__name">{{ full ? fullName(p) : shortName(p) }}</div>
      <div v-if="sub" class="pch__sub">{{ sub }}</div>
    </div>
    <slot />
  </component>
</template>

<style scoped lang="scss">
.pch {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  color: var(--ft-text);
  text-decoration: none !important;
  border-radius: 10px;
}
a.pch:hover .pch__name {
  color: var(--ft-primary-text);
}
.pch__text {
  min-width: 0;
  flex: 1;
  line-height: 1.3;
}
.pch__name {
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color 0.12s;
}
.pch__sub {
  font-size: 12.5px;
  color: var(--ft-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
