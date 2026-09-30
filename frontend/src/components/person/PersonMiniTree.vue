<script setup>
/** Мини-древо: родители, персона с супругами, дети — для профиля. */
import { computed } from 'vue'
import PersonAvatar from './PersonAvatar.vue'
import { useTreeStore } from '@/stores/tree'
import { useTreeNav } from '@/composables/useTreeNav'
import { useUiStore } from '@/stores/ui'
import { shortName } from '@/domain/names'
import { lifeSpan } from '@/domain/person'

const props = defineProps({ personId: { type: String, required: true } })
const tree = useTreeStore()
const nav = useTreeNav()
const ui = useUiStore()
const G = computed(() => tree.graph)
const parents = computed(() => {
  const { father, mother } = G.value.parents(props.personId)
  return [
    { id: father, role: 'father', label: 'Отец' },
    { id: mother, role: 'mother', label: 'Мать' },
  ]
})
const partners = computed(() => G.value.partners(props.personId))
const children = computed(() => G.value.children(props.personId))
const me = computed(() => tree.person(props.personId))
</script>

<template>
  <div class="mt">
    <div class="mt__row">
      <template v-for="r in parents" :key="r.role">
        <router-link v-if="r.id" :to="nav.personRoute(r.id)" class="mt__card" :class="`gender-${tree.person(r.id).gender}`">
          <PersonAvatar :person="tree.person(r.id)" :size="30" />
          <span class="min-w-0"><b class="ellipsis-1">{{ shortName(tree.person(r.id)) }}</b><small>{{ r.label }} · {{ lifeSpan(tree.person(r.id)) }}</small></span>
        </router-link>
        <button v-else-if="tree.canEdit(personId)" type="button" class="mt__card mt__card--empty" @click="ui.addRelative(personId, r.role)">
          <q-icon name="sym_r_add" size="18px" />
          <span>{{ r.role === 'father' ? 'Добавить отца' : 'Добавить мать' }}</span>
        </button>
      </template>
    </div>
    <div class="mt__link" />
    <div class="mt__row">
      <div class="mt__card mt__card--me" :class="`gender-${me.gender}`">
        <PersonAvatar :person="me" :size="34" />
        <span class="min-w-0"><b class="ellipsis-1">{{ shortName(me) }}</b><small>{{ lifeSpan(me) }}</small></span>
      </div>
      <router-link v-for="x in partners" :key="x.id" :to="nav.personRoute(x.id)" class="mt__card" :class="`gender-${tree.person(x.id).gender}`">
        <PersonAvatar :person="tree.person(x.id)" :size="30" />
        <span class="min-w-0"><b class="ellipsis-1">{{ shortName(tree.person(x.id)) }}</b><small>{{ tree.relationToHome(x.id) || 'партнёр' }}</small></span>
      </router-link>
    </div>
    <template v-if="children.length">
      <div class="mt__link" />
      <div class="mt__row mt__row--wrap">
        <router-link v-for="c in children" :key="c" :to="nav.personRoute(c)" class="mt__card mt__card--sm" :class="`gender-${tree.person(c).gender}`">
          <PersonAvatar :person="tree.person(c)" :size="26" />
          <span class="min-w-0"><b class="ellipsis-1">{{ tree.person(c).firstName || shortName(tree.person(c)) }}</b><small>{{ lifeSpan(tree.person(c)) }}</small></span>
        </router-link>
      </div>
    </template>
  </div>
</template>

<style scoped lang="scss">
.mt {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.mt__row {
  display: flex;
  gap: 8px;
  justify-content: center;
  width: 100%;
}
.mt__row--wrap {
  flex-wrap: wrap;
}
.mt__link {
  width: 2px;
  height: 16px;
  background: var(--ft-line);
}
.mt__card {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px 7px 8px;
  border-radius: 12px;
  background: var(--ft-surface);
  border: 1px solid color-mix(in srgb, var(--g) 40%, var(--ft-border));
  border-left: 3px solid var(--g);
  color: var(--ft-text);
  text-decoration: none !important;
  min-width: 0;
  flex: 1;
  max-width: 230px;
  font: inherit;
  line-height: 1.25;
  transition: 0.15s;
  b {
    display: block;
    font-size: 13px;
  }
  small {
    display: block;
    font-size: 11.5px;
    color: var(--ft-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}
a.mt__card:hover {
  box-shadow: var(--ft-shadow);
}
.mt__card--me {
  background: var(--g-soft);
  border-width: 1.5px;
}
.mt__card--sm {
  flex: 0 1 auto;
  max-width: 180px;
}
.mt__card--empty {
  border: 1.5px dashed var(--ft-border-strong);
  color: var(--ft-muted);
  justify-content: center;
  cursor: pointer;
  --g: var(--ft-border-strong);
  &:hover {
    color: var(--ft-primary-text);
    border-color: var(--ft-primary);
  }
}
</style>
