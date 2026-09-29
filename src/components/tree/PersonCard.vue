<script setup>
import { computed } from 'vue'
import PersonAvatar from '@/components/common/PersonAvatar.vue'
import { lifeSpan, shortName } from '@/utils/person'
import { useTreeStore } from '@/stores/tree'

const props = defineProps({
  person: { type: Object, required: true },
  selected: Boolean,
  focus: Boolean,
  home: Boolean,
  moreUp: Boolean,
  moreDown: Boolean,
  dup: Boolean,
})
const emit = defineEmits(['select', 'open', 'edit', 'add', 'camera', 'expand'])
const store = useTreeStore()

const span = computed(() => lifeSpan(props.person))
const relation = computed(() => (store.ui.showRelation ? store.relationToHome(props.person.id) : ''))
</script>

<template>
  <div
    class="pc"
    :class="[
      `gender-${person.gender}`,
      { 'pc--selected': selected, 'pc--focus': focus, 'pc--dead': !person.living, 'pc--dup': dup },
    ]"
    role="button"
    tabindex="0"
    :aria-label="shortName(person)"
    @click.stop="emit('select')"
    @dblclick.stop="emit('open')"
    @keydown.enter.prevent="emit('select')"
  >
    <button v-if="moreUp" class="pc__more pc__more--up" title="Показать предков" @click.stop="emit('expand')">
      <q-icon name="sym_r_keyboard_arrow_up" size="16px" />
    </button>

    <PersonAvatar :person="person" :size="44" camera :photos="store.ui.showPhotos" @camera="emit('camera')" />

    <div class="pc__body">
      <div class="pc__name" :title="shortName(person)">
        <span v-if="home" class="pc__home" title="Это Вы">
          <q-icon name="sym_r_home" size="13px" />
        </span>
        {{ person.firstName || 'Без имени' }} <b>{{ person.lastName }}</b>
      </div>
      <div class="pc__meta">
        <span v-if="store.ui.showYears && span">{{ span }}</span>
        <span v-if="relation" class="pc__rel">{{ relation }}</span>
      </div>
    </div>

    <button class="pc__edit" title="Изменить" @click.stop="emit('edit')">
      <q-icon name="sym_r_edit" size="15px" />
    </button>

    <button class="pc__add" title="Добавить родственника" @click.stop="emit('add')">
      <q-icon name="sym_r_add" size="16px" />
    </button>
    <button v-if="moreDown" class="pc__more pc__more--down" title="Показать потомков" @click.stop="emit('expand')">
      <q-icon name="sym_r_keyboard_arrow_down" size="16px" />
    </button>
  </div>
</template>

<style scoped lang="scss">
.pc {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 30px 0 10px;
  border-radius: 14px;
  background: var(--ft-surface);
  border: 1.5px solid color-mix(in srgb, var(--g) 55%, transparent);
  box-shadow: var(--ft-shadow);
  cursor: pointer;
  user-select: none;
  outline: none;
  transition:
    box-shadow 0.18s,
    border-color 0.18s,
    transform 0.18s;

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: linear-gradient(135deg, var(--g-soft), transparent 60%);
    opacity: 0;
    transition: opacity 0.2s;
    pointer-events: none;
  }

  &:hover {
    box-shadow: var(--ft-shadow-lg);
    border-color: var(--g);
    .pc__edit {
      opacity: 1;
    }
  }
  &:focus-visible {
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--ft-primary) 40%, transparent);
  }
}

.pc--focus::before {
  opacity: 1;
}
.pc--selected {
  border: 2px solid var(--g);
  box-shadow:
    0 0 0 4px color-mix(in srgb, var(--g) 22%, transparent),
    var(--ft-shadow-lg);
}
.pc--dead {
  .pc__name {
    color: color-mix(in srgb, var(--ft-text) 80%, var(--ft-muted));
  }
}
.pc--dup {
  border-style: dashed;
}

.pc__body {
  position: relative;
  min-width: 0;
  flex: 1;
  line-height: 1.2;
}
.pc__name {
  font-size: 13.5px;
  font-weight: 500;
  color: var(--ft-text);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
  b {
    font-weight: 700;
  }
}
.pc__home {
  display: inline-grid;
  place-items: center;
  width: 17px;
  height: 17px;
  border-radius: 5px;
  background: var(--ft-primary);
  color: #fff;
  vertical-align: -3px;
  margin-right: 2px;
}
.pc__meta {
  margin-top: 3px;
  font-size: 12px;
  color: var(--ft-muted);
  display: flex;
  gap: 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.pc__rel {
  color: var(--g);
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
}

button {
  border: 0;
  padding: 0;
  cursor: pointer;
  font: inherit;
}

.pc__edit {
  position: absolute;
  right: 6px;
  bottom: 6px;
  width: 24px;
  height: 24px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  background: transparent;
  color: var(--ft-muted);
  opacity: 0.55;
  transition: 0.15s;
  &:hover {
    background: var(--g-soft);
    color: var(--g);
  }
}

.pc__add {
  position: absolute;
  left: 50%;
  bottom: -13px;
  transform: translateX(-50%);
  width: 34px;
  height: 18px;
  border-radius: 0 0 12px 12px;
  display: grid;
  place-items: center;
  background: var(--ft-surface);
  color: var(--ft-muted);
  border: 1.5px solid color-mix(in srgb, var(--g) 55%, transparent);
  border-top: 0;
  clip-path: inset(1px -4px -4px -4px);
  transition: 0.15s;
  &:hover {
    background: var(--ft-primary);
    border-color: var(--ft-primary);
    color: #fff;
  }
}

.pc__more {
  position: absolute;
  left: 50%;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: var(--g);
  color: #fff;
  box-shadow: var(--ft-shadow);
  transition: transform 0.15s;
  &:hover {
    transform: translateX(-50%) scale(1.15);
  }
}
.pc__more--up {
  top: -12px;
  transform: translateX(-50%);
}
.pc__more--down {
  bottom: -24px;
  left: calc(50% + 30px);
  transform: translateX(-50%);
}
</style>
