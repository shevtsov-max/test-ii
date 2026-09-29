<script setup lang="ts">
import { computed } from 'vue'
import type { RelativeKind } from '@/types'
import PersonAvatar from './PersonAvatar.vue'
import { useTreeStore } from '@/stores/tree'
import { useUiStore } from '@/stores/ui'

const props = defineProps<{ personId: string }>()
const store = useTreeStore()
const ui = useUiStore()
const can = computed(() => store.canAdd(props.personId))

const items: { kind: RelativeKind; label: string; g: 'M' | 'F' | 'U' }[] = [
  { kind: 'father', label: 'Отца', g: 'M' },
  { kind: 'mother', label: 'Мать', g: 'F' },
  { kind: 'brother', label: 'Брата', g: 'M' },
  { kind: 'sister', label: 'Сестру', g: 'F' },
  { kind: 'partner', label: 'Партнёра / супруга', g: 'U' },
  { kind: 'son', label: 'Сына', g: 'M' },
  { kind: 'daughter', label: 'Дочь', g: 'F' },
]
</script>

<template>
  <q-menu anchor="bottom middle" self="top middle">
    <q-list style="min-width: 220px" class="q-py-xs">
      <q-item-label header class="q-py-sm">Добавить родственника</q-item-label>
      <q-item
        v-for="it in items"
        :key="it.kind"
        v-close-popup
        clickable
        dense
        :disable="!can[it.kind]"
        @click="ui.addRelative(personId, it.kind)"
      >
        <q-item-section avatar style="min-width: 40px">
          <PersonAvatar :gender="it.g" :size="28" />
        </q-item-section>
        <q-item-section>{{ it.label }}</q-item-section>
      </q-item>
    </q-list>
  </q-menu>
</template>
