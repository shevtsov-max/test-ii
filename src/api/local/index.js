/**
 * Локальный адаптер: всё хранится в браузере (IndexedDB). Работает без сервера и офлайн.
 */
import { unsupported } from '../errors'
import { auth } from './auth'
import { media } from './media'
import { trees } from './trees'

export const localApi = {
  mode: 'local',
  capabilities: { guest: true, sharing: false, sync: false, emailFlows: false, oauth: false },
  auth: { ...auth, setUnauthorizedHandler() {} },
  trees,
  media,
  sharing: {
    members: async () => [],
    invite: unsupported('Совместный доступ'),
    updateRole: unsupported('Совместный доступ'),
    remove: unsupported('Совместный доступ'),
    publicLink: unsupported('Публичная ссылка'),
  },
}
