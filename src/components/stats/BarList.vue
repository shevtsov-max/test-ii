<script setup>
/**
 * Горизонтальные полосы с подписью и значением (частые фамилии, имена, места).
 * Один ряд — один цвет; значение всегда выводится текстом, поэтому подсказка не нужна.
 */
import { computed } from 'vue'

const props = defineProps({
  /** @type {{ label: string, value: number, key?: string }[]} */
  items: { type: Array, required: true },
  /** Строки кликабельны (emit('pick', item)) */
  clickable: Boolean,
  format: { type: Function, default: (v) => v.toLocaleString('ru-RU') },
})
defineEmits(['pick'])
const max = computed(() => Math.max(1, ...props.items.map((i) => i.value)))
</script>

<template>
  <ol class="bl">
    <li v-for="it in items" :key="it.key ?? it.label">
      <component
        :is="clickable ? 'button' : 'div'"
        :type="clickable ? 'button' : undefined"
        class="bl__row"
        :class="{ 'bl__row--click': clickable }"
        @click="clickable && $emit('pick', it)"
      >
        <span class="bl__label ellipsis-1">{{ it.label }}</span>
        <span class="bl__track">
          <span class="bl__bar" :style="{ width: `${Math.max(2, (it.value / max) * 100)}%` }" />
        </span>
        <span class="bl__value tabular">{{ format(it.value) }}</span>
      </component>
    </li>
  </ol>
</template>

<style scoped lang="scss">
.bl {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.bl__row {
  display: grid;
  grid-template-columns: minmax(90px, 38%) 1fr 36px;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 5px 6px;
  border: 0;
  border-radius: 8px;
  background: none;
  font: inherit;
  font-size: 13px;
  color: var(--ft-text);
  text-align: left;
}
.bl__row--click {
  cursor: pointer;
  &:hover,
  &:focus-visible {
    background: var(--ft-surface-2);
    outline: none;
    .bl__bar {
      filter: brightness(1.08);
    }
  }
}
.bl__track {
  height: 10px;
  display: flex;
}
.bl__bar {
  display: block;
  height: 100%;
  border-radius: 0 4px 4px 0;
  background: var(--viz-series, var(--ft-primary));
}
.bl__value {
  text-align: right;
  font-weight: 600;
  color: var(--ft-text-2);
}
</style>
