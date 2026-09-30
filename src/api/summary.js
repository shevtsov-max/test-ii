/**
 * Краткие сведения о древе для списка на главной (TreeSummary).
 */
import { shortName } from '@/domain/names'

/** @returns {import('@/domain/types').TreeSummary & { ownerId: string }} */
export function summarize(tree, ownerId, role = 'owner') {
  const home = tree.homePersonId ? tree.persons[tree.homePersonId] : null
  const avatar = home?.avatarId ? tree.media?.[home.avatarId] : null
  const thumb = avatar?.thumb && avatar.thumb.length < 60000 ? avatar.thumb : null
  return {
    id: tree.id,
    ownerId,
    role,
    name: tree.name,
    description: tree.description ?? '',
    persons: Object.keys(tree.persons).length,
    families: Object.keys(tree.families).length,
    media: Object.keys(tree.media ?? {}).length,
    homeName: home ? shortName(home) : null,
    homeThumb: thumb,
    homeGender: home?.gender ?? 'U',
    createdAt: tree.createdAt ?? Date.now(),
    updatedAt: tree.updatedAt ?? Date.now(),
  }
}
