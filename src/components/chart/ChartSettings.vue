<script setup>
/** Настройки отображения схемы (меню «Вид»). */
import { usePrefsStore } from '@/stores/prefs'

defineProps({ view: { type: String, required: true } })
const prefs = usePrefsStore()
const c = prefs.chart

const densities = [
  { value: 'compact', label: 'Компактные' },
  { value: 'normal', label: 'Обычные' },
  { value: 'detailed', label: 'Подробные' },
]
const colors = [
  { value: 'gender', label: 'По полу' },
  { value: 'clan', label: 'По роду' },
  { value: 'generation', label: 'По поколению' },
  { value: 'living', label: 'Живые / умершие' },
  { value: 'none', label: 'Без цвета' },
]
const toggles = [
  ['photos', 'Фотографии'],
  ['years', 'Годы жизни и возраст'],
  ['relation', 'Кем приходится «Вам»'],
  ['patronymic', 'Отчество'],
  ['places', 'Место рождения'],
]
const toggles2 = [
  ['highlight', 'Подсвечивать линию родства выбранного'],
  ['genLabels', 'Подписи поколений'],
  ['minimap', 'Мини-карта'],
  ['placeholders', 'Подсказки «Добавить отца / мать»'],
  ['animate', 'Анимация'],
]
</script>

<template>
  <div class="cset">
    <template v-if="view === 'tree' || view === 'pedigree'">
      <div class="cset__sec">
        <div class="ft-label">Карточки</div>
        <q-btn-toggle v-model="c.density" :options="densities" no-caps unelevated dense spread toggle-color="primary" class="cset__toggle" />
      </div>
      <div class="cset__sec">
        <div class="ft-label">Цвет карточек</div>
        <div class="cset__chips">
          <button v-for="o in colors" :key="o.value" type="button" :class="{ active: c.colorBy === o.value }" @click="c.colorBy = o.value">{{ o.label }}</button>
        </div>
      </div>
      <div class="cset__sec">
        <div class="ft-label">На карточке</div>
        <q-toggle v-for="t in toggles" :key="t[0]" v-model="c[t[0]]" :label="t[1]" dense class="cset__row" />
      </div>
      <div class="cset__sec">
        <div class="ft-label">Схема</div>
        <q-toggle v-for="t in toggles2" :key="t[0]" v-model="c[t[0]]" :label="t[1]" dense class="cset__row" />
      </div>
    </template>
    <template v-else-if="view === 'fan'">
      <div class="cset__sec">
        <div class="ft-label">Раскраска</div>
        <div class="cset__chips">
          <button type="button" :class="{ active: c.fanColor !== 'gender' }" @click="c.fanColor = 'lineage'">Линии отца и матери</button>
          <button type="button" :class="{ active: c.fanColor === 'gender' }" @click="c.fanColor = 'gender'">По полу</button>
        </div>
      </div>
      <div class="cset__sec">
        <q-toggle v-model="c.placeholders" label="Пустые сектора «добавить»" dense class="cset__row" />
      </div>
    </template>
    <div class="cset__foot">
      <q-btn flat dense no-caps size="sm" color="primary" label="Сбросить настройки схемы" @click="prefs.resetChart()" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.cset {
  width: 320px;
  padding: 6px 4px;
}
.cset__sec {
  padding: 10px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  & + & {
    border-top: 1px solid var(--ft-border);
  }
}
.cset__toggle {
  border: 1px solid var(--ft-border);
  border-radius: 10px;
}
.cset__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  button {
    padding: 5px 10px;
    border-radius: 999px;
    border: 1px solid var(--ft-border);
    background: var(--ft-surface);
    color: var(--ft-text-2);
    font: inherit;
    font-size: 12.5px;
    cursor: pointer;
    &:hover {
      border-color: var(--ft-border-strong);
    }
    &.active {
      background: var(--ft-primary-soft);
      border-color: var(--ft-primary);
      color: var(--ft-primary-text);
      font-weight: 600;
    }
  }
}
.cset__row {
  font-size: 13.5px;
}
.cset__foot {
  padding: 6px 10px 2px;
  border-top: 1px solid var(--ft-border);
}
</style>
