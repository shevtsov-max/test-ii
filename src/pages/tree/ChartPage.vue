<script setup>
import { computed, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import TreeChart from '@/components/chart/TreeChart.vue'
import FanChart from '@/components/chart/FanChart.vue'
import TimelineChart from '@/components/chart/TimelineChart.vue'
import ChartSettings from '@/components/chart/ChartSettings.vue'
import PersonSummary from '@/components/person/PersonSummary.vue'
import PersonSelect from '@/components/person/PersonSelect.vue'
import PersonAvatar from '@/components/person/PersonAvatar.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { useTreeStore } from '@/stores/tree'
import { usePrefsStore } from '@/stores/prefs'
import { useUiStore } from '@/stores/ui'
import { useTreeNav } from '@/composables/useTreeNav'
import { CHART_SCOPES, CHART_VIEWS, computeChart } from '@/domain/layout'
import { downloadPng, downloadSvg, printChart } from '@/components/chart/exportChart'
import { shortName } from '@/domain/names'
import { lifeSpan } from '@/domain/person'
import { errorMessage } from '@/api'

const $q = useQuasar()
const tree = useTreeStore()
const prefs = usePrefsStore()
const ui = useUiStore()
const nav = useTreeNav()
const c = prefs.chart

const chartRef = ref()
const stage = ref()
const exporting = ref(false)

// Центр по умолчанию — «Это Вы»
watch(
  () => [tree.focusId, tree.tree],
  () => {
    if (tree.tree && (!tree.focusId || !tree.person(tree.focusId))) tree.setFocus(tree.homeId ?? Object.keys(tree.tree.persons)[0])
  },
  { immediate: true },
)

const settings = computed(() => ({
  view: c.view,
  scope: c.scope,
  up: c.up,
  down: c.down,
  density: c.density,
  placeholders: c.placeholders && !tree.readonly,
}))
const layout = computed(() => (tree.graph && tree.focusId ? computeChart(tree.graph, tree.focusId, settings.value) : null))

// Лента жизни: люди из схемы «Семья» вокруг центра
const timelineSet = computed(() => {
  if (c.view !== 'timeline' || !tree.graph || !tree.focusId) return { ids: [], gens: new Map() }
  const L = computeChart(tree.graph, tree.focusId, { ...settings.value, view: 'tree', scope: c.scope === 'all' ? 'all' : c.scope, placeholders: false })
  const gens = new Map()
  for (const n of L.nodes) if (n.personId && !gens.has(n.personId)) gens.set(n.personId, n.row)
  return { ids: [...gens.keys()], gens }
})

const scope = computed(() => CHART_SCOPES.find((s) => s.value === c.scope) ?? CHART_SCOPES[1])
const genOptions = [1, 2, 3, 4, 5, 6, 7, 8, 10, 12]
const shownCount = computed(() => (c.view === 'timeline' ? timelineSet.value.ids.length : (layout.value?.shown.size ?? 0)))
const panel = computed(() => prefs.panelOpen && !!tree.selected && $q.screen.gt.sm && c.view !== 'timeline')
const mobileSheet = ref(true)
watch(
  () => tree.selectedId,
  () => (mobileSheet.value = true),
)

function exportOpts() {
  const focus = tree.focus
  return {
    layout: layout.value,
    tree: tree.tree,
    opts: c,
    relationOf: tree.relationToHome,
    homeId: tree.homeId,
    title: tree.tree.name,
    subtitle: `${scope.value.label} · центр: ${shortName(focus)} · ${new Date().toLocaleDateString('ru-RU')}`,
    dark: false,
  }
}
async function doExport(kind) {
  if (!layout.value?.nodes.length) return
  exporting.value = true
  try {
    if (kind === 'png') await downloadPng(exportOpts())
    else if (kind === 'svg') await downloadSvg(exportOpts())
    else await printChart(exportOpts())
  } catch (e) {
    $q.notify({ type: 'negative', message: errorMessage(e) })
  } finally {
    exporting.value = false
  }
}

function toggleFullscreen() {
  const el = stage.value
  if (!document.fullscreenElement) el?.requestFullscreen?.().catch(() => {})
  else document.exitFullscreen?.()
}

const onlyMe = computed(() => tree.count === 1 && !!tree.focus)
</script>

<template>
  <div class="chp">
    <!-- Панель инструментов -->
    <div class="chp__bar no-print">
      <div class="chp__views">
        <button v-for="v in CHART_VIEWS" :key="v.value" type="button" :class="{ active: c.view === v.value }" @click="c.view = v.value">
          <q-icon :name="v.icon" size="18px" />
          <span>{{ v.label }}</span>
        </button>
      </div>

      <q-btn v-if="c.view === 'tree' || c.view === 'timeline'" flat no-caps dense class="chp__scope" :icon="scope.icon" icon-right="sym_r_keyboard_arrow_down">
        <span class="ellipsis-1">{{ $q.screen.width >= 1680 ? scope.label : scope.short }}</span>
        <q-menu :offset="[0, 6]">
          <q-list style="min-width: 320px" class="q-py-xs">
            <q-item-label header class="q-pb-xs">Построить древо</q-item-label>
            <q-item v-for="s in CHART_SCOPES" :key="s.value" v-close-popup clickable :active="c.scope === s.value" active-class="chp__active" @click="c.scope = s.value">
              <q-item-section avatar><q-icon :name="s.icon" /></q-item-section>
              <q-item-section>
                <q-item-label>{{ s.label }}</q-item-label>
                <q-item-label caption>{{ s.hint }}</q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </q-menu>
      </q-btn>

      <q-btn v-if="c.view !== 'timeline'" flat no-caps dense class="chp__gens" icon-right="sym_r_keyboard_arrow_down">
        <span class="text-muted gt-sm q-mr-xs">Поколения</span>
        <span class="tabular"><q-icon name="sym_r_north" size="15px" />{{ c.up }}<template v-if="c.view === 'tree'"> <q-icon name="sym_r_south" size="15px" />{{ c.down }}</template></span>
        <q-menu :offset="[0, 6]">
          <div class="chp__gen-menu">
            <div class="ft-label">Предки (вверх)</div>
            <div class="chp__gen-row">
              <button v-for="g in genOptions" :key="'u' + g" type="button" :class="{ active: c.up === g }" @click="c.up = g">{{ g }}</button>
            </div>
            <template v-if="c.view === 'tree'">
              <div class="ft-label q-mt-sm">Потомки (вниз)</div>
              <div class="chp__gen-row">
                <button v-for="g in [0, ...genOptions]" :key="'d' + g" type="button" :class="{ active: c.down === g }" @click="c.down = g">{{ g }}</button>
              </div>
            </template>
          </div>
        </q-menu>
      </q-btn>

      <div class="chp__hist">
        <q-btn flat round dense icon="sym_r_arrow_back" :disable="!tree.canFocusBack" aria-label="Предыдущий центр" @click="tree.focusBack()">
          <q-tooltip>Назад: {{ tree.canFocusBack ? shortName(tree.person(tree.focusHistory.back.at(-1))) : 'нет' }} (Alt+←)</q-tooltip>
        </q-btn>
        <q-btn flat round dense icon="sym_r_arrow_forward" :disable="!tree.canFocusForward" aria-label="Следующий центр" @click="tree.focusForward()">
          <q-tooltip>Вперёд: {{ tree.canFocusForward ? shortName(tree.person(tree.focusHistory.forward.at(-1))) : 'нет' }} (Alt+→)</q-tooltip>
        </q-btn>
      </div>

      <PersonSelect
        class="chp__focus"
        dense
        icon="sym_r_center_focus_strong"
        placeholder="Построить от…"
        :model-value="tree.focusId"
        @pick="(id) => tree.setFocus(id)"
      />

      <q-space />
      <span v-if="$q.screen.width >= 1600" class="chp__count text-muted">{{ shownCount }} из {{ tree.count }}</span>

      <q-btn flat round dense icon="sym_r_tune" class="text-muted" aria-label="Вид">
        <q-tooltip>Вид схемы</q-tooltip>
        <q-menu anchor="bottom right" self="top right" :offset="[0, 6]">
          <ChartSettings :view="c.view" />
        </q-menu>
      </q-btn>
      <q-btn v-if="c.view === 'tree' || c.view === 'pedigree'" flat round dense icon="sym_r_ios_share" class="text-muted" :loading="exporting" aria-label="Экспорт">
        <q-tooltip>Сохранить и печать</q-tooltip>
        <q-menu anchor="bottom right" self="top right" :offset="[0, 6]">
          <q-list style="min-width: 260px" class="q-py-xs">
            <q-item v-close-popup clickable @click="doExport('png')">
              <q-item-section avatar><q-icon name="sym_r_image" /></q-item-section>
              <q-item-section>
                <q-item-label>Картинка PNG</q-item-label>
                <q-item-label caption>для сообщений и соцсетей</q-item-label>
              </q-item-section>
            </q-item>
            <q-item v-close-popup clickable @click="doExport('svg')">
              <q-item-section avatar><q-icon name="sym_r_polyline" /></q-item-section>
              <q-item-section>
                <q-item-label>Векторный SVG</q-item-label>
                <q-item-label caption>для печати плакатом в типографии</q-item-label>
              </q-item-section>
            </q-item>
            <q-item v-close-popup clickable @click="doExport('print')">
              <q-item-section avatar><q-icon name="sym_r_print" /></q-item-section>
              <q-item-section>
                <q-item-label>Печать / PDF</q-item-label>
                <q-item-label caption>через системный диалог печати</q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </q-menu>
      </q-btn>
      <q-btn
        v-if="c.view !== 'timeline'"
        flat
        round
        dense
        :icon="prefs.panelOpen ? 'sym_r_right_panel_close' : 'sym_r_right_panel_open'"
        class="text-muted gt-sm"
        :aria-label="prefs.panelOpen ? 'Скрыть панель' : 'Показать панель'"
        @click="prefs.panelOpen = !prefs.panelOpen"
      >
        <q-tooltip>{{ prefs.panelOpen ? 'Скрыть панель персоны' : 'Показать панель персоны' }}</q-tooltip>
      </q-btn>
    </div>

    <div class="chp__body">
      <div ref="stage" class="chp__stage">
        <template v-if="layout && tree.focus">
          <TreeChart v-if="c.view === 'tree' || c.view === 'pedigree'" ref="chartRef" :layout="layout" :opts="c" @fullscreen="toggleFullscreen" />
          <FanChart v-else-if="c.view === 'fan'" :opts="c" @fullscreen="toggleFullscreen" />
          <TimelineChart v-else :person-ids="timelineSet.ids" :generations="timelineSet.gens" />
        </template>
        <EmptyState v-else icon="sym_r_account_tree" title="Древо пусто" text="Добавьте первого человека — например, себя.">
          <template #actions>
            <q-btn unelevated no-caps color="primary" icon="sym_r_person_add" label="Добавить персону" @click="ui.newPerson()" />
          </template>
        </EmptyState>

        <!-- Подсказка для нового древа -->
        <div v-if="onlyMe && !tree.readonly" class="chp__guide no-print">
          <div class="chp__guide-icon"><q-icon name="sym_r_waving_hand" size="22px" /></div>
          <div class="col">
            <b>С чего начать</b>
            <div class="text-muted">Заполните сведения о себе, затем добавьте родителей — древо будет расти от вас.</div>
          </div>
          <q-btn outline no-caps color="primary" label="Мои данные" @click="ui.editPerson(tree.focusId)" />
          <q-btn unelevated no-caps color="primary" label="Добавить отца" @click="ui.addRelative(tree.focusId, 'father')" />
          <q-btn unelevated no-caps color="primary" label="Добавить мать" @click="ui.addRelative(tree.focusId, 'mother')" />
        </div>
      </div>

      <transition name="chp-panel">
        <aside v-if="panel" class="chp__panel ft-scroll no-print">
          <PersonSummary :person-id="tree.selectedId" closable @close="prefs.panelOpen = false" />
        </aside>
      </transition>
    </div>

    <!-- Телефон: нижняя плашка выбранной персоны -->
    <transition name="chp-sheet">
      <div v-if="tree.selected && !$q.screen.gt.sm && mobileSheet && c.view !== 'timeline'" class="chp__sheet no-print" :class="`gender-${tree.selected.gender}`">
        <PersonAvatar :person="tree.selected" :size="42" />
        <router-link :to="nav.personRoute(tree.selected.id)" class="col min-w-0 chp__sheet-text">
          <div class="fw-700 ellipsis-1">{{ shortName(tree.selected) }}</div>
          <div class="text-muted ellipsis-1" style="font-size: 12.5px">
            {{ [lifeSpan(tree.selected), tree.relationToHome(tree.selected.id)].filter(Boolean).join(' · ') }}
          </div>
        </router-link>
        <q-btn v-if="!tree.readonly" flat round dense icon="sym_r_person_add" aria-label="Добавить" @click="ui.addOverlayFor = tree.selected.id" />
        <q-btn v-if="tree.focusId !== tree.selected.id" flat round dense icon="sym_r_center_focus_strong" aria-label="В центр" @click="tree.setFocus(tree.selected.id)" />
        <q-btn flat round dense icon="sym_r_close" aria-label="Скрыть" @click="mobileSheet = false" />
      </div>
    </transition>
  </div>
</template>

<style scoped lang="scss">
.chp {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  position: relative;
}
.chp__bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--ft-surface);
  border-bottom: 1px solid var(--ft-border);
  flex: none;
  overflow-x: auto;
  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }
}
.chp__views {
  display: flex;
  padding: 3px;
  gap: 2px;
  background: var(--ft-surface-3);
  border-radius: 11px;
  flex: none;
  button {
    display: flex;
    align-items: center;
    gap: 6px;
    height: 30px;
    padding: 0 11px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: var(--ft-muted);
    font: inherit;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    &:hover {
      color: var(--ft-text);
    }
    &.active {
      background: var(--ft-surface);
      color: var(--ft-text);
      box-shadow: var(--ft-shadow-xs);
      .q-icon {
        color: var(--ft-primary);
      }
    }
  }
}
.chp__scope,
.chp__hist {
  display: flex;
  gap: 0;
  color: var(--ft-text-2);
}
.chp__gens {
  height: 36px;
  padding: 0 10px;
  border: 1px solid var(--ft-border);
  border-radius: 10px;
  font-size: 13px;
  flex: none;
  max-width: 300px;
  :deep(.q-btn__content) {
    flex-wrap: nowrap;
    gap: 6px;
  }
}
.chp__active {
  color: var(--ft-primary-text);
  background: var(--ft-primary-soft);
}
.chp__gen-menu {
  padding: 12px 14px;
  width: 290px;
}
.chp__gen-row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 6px;
  button {
    min-width: 34px;
    height: 30px;
    border-radius: 8px;
    border: 1px solid var(--ft-border);
    background: var(--ft-surface);
    color: var(--ft-text-2);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
    &.active {
      background: var(--ft-primary);
      border-color: var(--ft-primary);
      color: #fff;
    }
  }
}
.chp__focus {
  width: 210px;
  flex: none;
  :deep(.q-field__control) {
    height: 36px;
    min-height: 36px;
  }
}
.chp__count {
  font-size: 12.5px;
  white-space: nowrap;
}
.chp__body {
  flex: 1;
  min-height: 0;
  display: flex;
  position: relative;
}
.chp__stage {
  flex: 1;
  min-width: 0;
  position: relative;
  background: var(--ft-canvas);
}
.chp__panel {
  width: 340px;
  flex: none;
  overflow-y: auto;
  background: var(--ft-surface);
  border-left: 1px solid var(--ft-border);
}
.chp__guide {
  position: absolute;
  left: 50%;
  top: 16px;
  transform: translateX(-50%);
  z-index: 6;
  display: flex;
  align-items: center;
  gap: 12px;
  width: max-content;
  max-width: calc(100% - 32px);
  padding: 12px 14px;
  border-radius: 16px;
  background: var(--ft-surface);
  border: 1px solid var(--ft-border);
  box-shadow: var(--ft-shadow-lg);
  flex-wrap: wrap;
}
.chp__guide-icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  background: var(--ft-primary-soft);
  color: var(--ft-primary-text);
}
.chp__sheet {
  position: absolute;
  left: 10px;
  right: 10px;
  bottom: 10px;
  z-index: 8;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 8px 8px 10px;
  border-radius: 16px;
  background: var(--ft-surface);
  border: 1px solid var(--ft-border);
  border-left: 4px solid var(--g);
  box-shadow: var(--ft-shadow-lg);
}
.chp__sheet-text {
  color: var(--ft-text);
  text-decoration: none !important;
}
.chp-panel-enter-active,
.chp-panel-leave-active {
  transition:
    margin 0.2s var(--ft-ease),
    opacity 0.2s;
}
.chp-panel-enter-from,
.chp-panel-leave-to {
  margin-right: -340px;
  opacity: 0;
}
.chp-sheet-enter-active,
.chp-sheet-leave-active {
  transition: 0.2s;
}
.chp-sheet-enter-from,
.chp-sheet-leave-to {
  opacity: 0;
  transform: translateY(12px);
}
@media (max-width: 1023px) {
  .chp__views span {
    display: none;
  }
  .chp__focus {
    width: 170px;
  }
}
</style>
