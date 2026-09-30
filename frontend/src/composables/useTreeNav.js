import { useRoute, useRouter } from 'vue-router'
import { useTreeStore } from '@/stores/tree'
import { usePrefsStore } from '@/stores/prefs'

/** Переходы внутри открытого древа. */
export function useTreeNav() {
  const route = useRoute()
  const router = useRouter()
  const tree = useTreeStore()
  const prefs = usePrefsStore()
  const treeId = () => route.params.treeId ?? tree.treeId

  const to = (name, extra = {}) => ({ name, params: { treeId: treeId(), ...(extra.params ?? {}) }, query: extra.query })
  const personRoute = (personId) => to('tree-person', { params: { personId } })

  function openPerson(personId) {
    tree.selectPerson(personId)
    router.push(personRoute(personId))
  }

  /** Построить древо от персоны (опционально — с охватом «Прямые предки…» и т. д.). */
  function showInChart(personId, scope) {
    if (scope) {
      prefs.chart.scope = scope
      prefs.chart.view = 'tree'
    }
    tree.setFocus(personId)
    if (route.name !== 'tree-chart') router.push(to('tree-chart'))
  }

  function openReport(personId, kind) {
    router.push(to('tree-reports', { query: { person: personId, kind } }))
  }

  return { to, personRoute, openPerson, showInChart, openReport, go: (name, extra) => router.push(to(name, extra)) }
}
