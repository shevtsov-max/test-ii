<script setup>
/** Поле пароля с кнопкой «показать» и (опционально) индикатором надёжности. */
import { computed, ref } from 'vue'
import { passwordStrength } from '@/utils/password'

const props = defineProps({
  modelValue: { type: String, default: '' },
  label: { type: String, default: 'Пароль' },
  autocomplete: { type: String, default: 'current-password' },
  strength: Boolean,
  error: { type: String, default: '' },
  hint: { type: String, default: '' },
})
defineEmits(['update:modelValue'])
const visible = ref(false)
const s = computed(() => passwordStrength(props.modelValue))
const tone = computed(() => ['negative', 'negative', 'warning', 'positive', 'positive'][s.value.score])
</script>

<template>
  <div class="pwi">
    <q-input
      :model-value="modelValue"
      :type="visible ? 'text' : 'password'"
      :label="label"
      :autocomplete="autocomplete"
      outlined
      :error="!!error"
      :error-message="error"
      :hint="strength && modelValue ? undefined : hint"
      bottom-slots
      @update:model-value="$emit('update:modelValue', $event)"
    >
      <template #prepend><q-icon name="sym_r_lock" size="20px" /></template>
      <template #append>
        <q-btn flat round dense :icon="visible ? 'sym_r_visibility_off' : 'sym_r_visibility'" :aria-label="visible ? 'Скрыть пароль' : 'Показать пароль'" @click="visible = !visible" />
      </template>
      <template v-if="strength && modelValue && !error" #hint>
        <div class="pwi__meter">
          <span v-for="i in 4" :key="i" :class="i <= s.score ? `bg-${tone}` : ''" />
        </div>
        <span>{{ s.label }}</span>
      </template>
    </q-input>
  </div>
</template>

<style scoped lang="scss">
.pwi__meter {
  display: inline-flex;
  gap: 3px;
  margin-right: 8px;
  vertical-align: middle;
  span {
    width: 26px;
    height: 4px;
    border-radius: 2px;
    background: var(--ft-surface-3);
  }
}
</style>
