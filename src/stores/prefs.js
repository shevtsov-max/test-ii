import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

const LS_PREFS = 'rd:prefs'
const PREFS_VERSION = 1

/** Колонки таблицы «Персоны» по умолчанию (как в «Древе Жизни»). */
export const DEFAULT_COLUMNS = ['name', 'relation', 'birth', 'residence', 'age', 'occupation', 'note', 'living', 'photo', 'gender']

const defaults = () => ({
  version: PREFS_VERSION,
  /** auto | light | dark */
  theme: 'auto',
  sidebarCollapsed: false,
  chart: {
    view: 'tree',
    scope: 'family',
    up: 3,
    down: 3,
    density: 'normal',
    photos: true,
    years: true,
    relation: true,
    places: false,
    patronymic: false,
    /** gender | clan | generation | living | none */
    colorBy: 'gender',
    placeholders: true,
    minimap: true,
    genLabels: true,
    highlight: true,
    fanColor: 'lineage',
    animate: true,
  },
  people: {
    columns: DEFAULT_COLUMNS,
    density: 'normal',
    rowsPerPage: 50,
  },
  panelOpen: true,
})

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_PREFS) ?? 'null')
    if (!raw) {
      // Настройки прежней версии: тёмная тема, число поколений
      const old = JSON.parse(localStorage.getItem('ft:ui:v1') ?? 'null')
      const d = defaults()
      if (old) {
        if (old.dark) d.theme = 'dark'
        if (old.generations && old.generations < 99) d.chart.up = d.chart.down = Math.min(8, old.generations)
        if (old.showPhotos === false) d.chart.photos = false
        if (old.showYears === false) d.chart.years = false
      }
      return d
    }
    const d = defaults()
    return { ...d, ...raw, chart: { ...d.chart, ...raw.chart }, people: { ...d.people, ...raw.people } }
  } catch {
    return defaults()
  }
}

/** Настройки интерфейса (хранятся в этом браузере). */
export const usePrefsStore = defineStore('prefs', () => {
  const s = load()
  const theme = ref(s.theme)
  const sidebarCollapsed = ref(s.sidebarCollapsed)
  const chart = ref(s.chart)
  const people = ref(s.people)
  const panelOpen = ref(s.panelOpen)

  watch(
    [theme, sidebarCollapsed, chart, people, panelOpen],
    () => {
      try {
        localStorage.setItem(
          LS_PREFS,
          JSON.stringify({ version: PREFS_VERSION, theme: theme.value, sidebarCollapsed: sidebarCollapsed.value, chart: chart.value, people: people.value, panelOpen: panelOpen.value }),
        )
      } catch {
        /* ignore */
      }
    },
    { deep: true },
  )

  function resetChart() {
    chart.value = defaults().chart
  }

  return { theme, sidebarCollapsed, chart, people, panelOpen, resetChart }
})
