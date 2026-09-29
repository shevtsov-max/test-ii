import { useQuasar } from 'quasar'
import { useTreeStore } from '@/stores/tree'
import { shortName } from '@/utils/person'

export function usePersonActions() {
  const $q = useQuasar()
  const store = useTreeStore()

  function remove(id: string, after?: () => void) {
    const p = store.person(id)
    if (!p) return
    $q.dialog({
      title: 'Удалить персону?',
      message: `«${shortName(p)}» будет удалён(а) из древа вместе с фото, фактами и связями. Действие можно отменить (Ctrl+Z).`,
      cancel: { flat: true, label: 'Отмена', color: 'grey-8' },
      ok: { unelevated: true, label: 'Удалить', color: 'negative' },
      persistent: false,
    }).onOk(() => {
      store.deletePerson(id)
      $q.notify({
        message: 'Персона удалена',
        actions: [{ label: 'Отменить', color: 'primary', handler: () => store.undo() }],
      })
      after?.()
    })
  }

  function setHome(id: string) {
    store.setHome(id)
    $q.notify({ type: 'positive', message: `${shortName(store.person(id))} — теперь «Это Вы»` })
  }

  function detachFromParents(id: string) {
    $q.dialog({
      title: 'Отвязать от родителей?',
      message: 'Связь с родителями будет удалена. Сами персоны останутся в древе.',
      cancel: { flat: true, label: 'Отмена', color: 'grey-8' },
      ok: { unelevated: true, label: 'Отвязать', color: 'primary' },
    }).onOk(() => store.detachChild(id))
  }

  return { remove, setHome, detachFromParents }
}
