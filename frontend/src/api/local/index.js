/**
 * Локальный адаптер: всё хранится в браузере (IndexedDB). Работает без сервера и офлайн.
 * Совместный доступ, передача веток и уведомления в Telegram требуют сервера.
 */
import { unsupported } from '../errors'
import { auth } from './auth'
import { media } from './media'
import { notifications } from './notifications'
import { trees } from './trees'

export const localApi = {
  mode: 'local',
  capabilities: { guest: true, sharing: false, sync: false, emailFlows: false, oauth: false, delegation: false, telegram: false },
  auth: { ...auth, setUnauthorizedHandler() {} },
  trees,
  media,
  sharing: {
    members: async () => [],
    invite: unsupported('Совместный доступ'),
    updateRole: unsupported('Совместный доступ'),
    remove: unsupported('Совместный доступ'),
  },
  delegations: {
    list: async () => [],
    branches: async () => [],
    create: unsupported('Передача ветки'),
    revoke: unsupported('Передача ветки'),
    clone: unsupported('Передача ветки'),
  },
  invitations: {
    get: unsupported('Приглашения'),
    accept: unsupported('Приглашения'),
    decline: unsupported('Приглашения'),
  },
  notifications: {
    ...notifications,
    update: unsupported('Уведомления в Telegram'),
    telegramLink: unsupported('Уведомления в Telegram'),
    disconnect: unsupported('Уведомления в Telegram'),
    test: unsupported('Уведомления в Telegram'),
  },
}
