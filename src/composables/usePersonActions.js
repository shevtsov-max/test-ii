import { useQuasar } from 'quasar'
import { useRoute, useRouter } from 'vue-router'
import { useTreeStore } from '@/stores/tree'
import { shortName } from '@/domain/names'
import { errorMessage } from '@/api'

/** Действия с персоной, требующие подтверждения. */
export function usePersonActions() {
  const $q = useQuasar()
  const tree = useTreeStore()
  const route = useRoute()
  const router = useRouter()

  const confirm = (opts) =>
    new Promise((resolve) =>
      $q
        .dialog({
          cancel: { flat: true, label: 'Отмена', noCaps: true, color: 'grey-8' },
          persistent: false,
          ...opts,
          ok: { unelevated: true, noCaps: true, color: 'primary', ...opts.ok },
        })
        .onOk(() => resolve(true))
        .onCancel(() => resolve(false))
        .onDismiss(() => resolve(false)),
    )

  const undoAction = { label: 'Отменить', color: 'primary', handler: () => tree.undo() }

  async function remove(id, after) {
    const p = tree.person(id)
    if (!p) return false
    const ok = await confirm({
      title: 'Удалить персону?',
      message: `«${shortName(p)}» будет удалён(а) из древа вместе с событиями и связями. Фото и документы останутся в разделе «Медиа».`,
      ok: { label: 'Удалить', color: 'negative' },
    })
    if (!ok) return false
    try {
      tree.deletePerson(id)
      $q.notify({ message: 'Персона удалена', actions: [undoAction] })
      if (route.name === 'tree-person' && route.params.personId === id) router.replace({ name: 'tree-people', params: { treeId: tree.treeId } })
      after?.()
      return true
    } catch (e) {
      $q.notify({ type: 'negative', message: errorMessage(e) })
      return false
    }
  }

  function setHome(id) {
    tree.setHome(id)
    $q.notify({ type: 'positive', message: `${shortName(tree.person(id))} — теперь «Это Вы»: родство считается от этой персоны` })
  }

  async function detachFromParents(id, familyId) {
    const ok = await confirm({
      title: 'Отвязать от родителей?',
      message: 'Связь с родителями будет удалена. Сами персоны останутся в древе.',
      ok: { label: 'Отвязать' },
    })
    if (ok) {
      tree.detachChild(id, familyId)
      $q.notify({ message: 'Связь удалена', actions: [undoAction] })
    }
  }

  async function removePartnership(familyId, keepId) {
    const f = tree.family(familyId)
    const other = f?.partners.find((x) => x !== keepId)
    const ok = await confirm({
      title: 'Удалить связь партнёров?',
      message: f?.children.length
        ? `Общие дети останутся детьми ${shortName(tree.person(keepId))}.`
        : `${shortName(tree.person(keepId))} и ${shortName(tree.person(other))} больше не будут связаны.`,
      ok: { label: 'Удалить связь', color: 'negative' },
    })
    if (ok) {
      tree.removePartnership(familyId, keepId)
      $q.notify({ message: 'Связь удалена', actions: [undoAction] })
    }
  }

  function toggleFavorite(id) {
    tree.toggleFavorite(id)
    const p = tree.person(id)
    $q.notify({ message: p.favorite ? 'Добавлено в избранное' : 'Убрано из избранного', timeout: 1400 })
  }

  return { confirm, remove, setHome, detachFromParents, removePartnership, toggleFavorite }
}
