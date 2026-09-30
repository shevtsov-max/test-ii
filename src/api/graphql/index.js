/**
 * GraphQL-адаптер: тот же интерфейс, что у локального (src/api/local), но данные — на сервере.
 * Включается переменной VITE_API_MODE=graphql (адрес — VITE_GRAPHQL_URL).
 */
import { config } from '@/app/config'
import { ApiError } from '../errors'
import { createClient } from './client'
import * as Op from './operations'

const LS_REFRESH = 'rd:refresh'
let accessToken = null
let onUnauthorized = () => {}

const client = createClient({
  url: config.graphqlUrl,
  getToken: () => accessToken,
  refresh: async () => {
    const rt = localStorage.getItem(LS_REFRESH)
    if (!rt) return false
    const data = await client.request(Op.M_REFRESH, { refreshToken: rt }, { auth: false })
    applyAuth(data.refreshToken)
    return true
  },
  onUnauthorized: () => onUnauthorized(),
})

function applyAuth(p) {
  accessToken = p.accessToken
  if (p.refreshToken) localStorage.setItem(LS_REFRESH, p.refreshToken)
  return { user: { ...p.user, guest: false }, token: p.accessToken }
}

/**
 * После входа через внешний сервис сервер возвращает пользователя на адрес приложения
 * с параметром ?refreshToken=… — забираем его и убираем из адресной строки.
 */
function takeOAuthToken() {
  const url = new URL(location.href)
  const rt = url.searchParams.get('refreshToken')
  if (!rt) return
  localStorage.setItem(LS_REFRESH, rt)
  url.searchParams.delete('refreshToken')
  history.replaceState(history.state, '', url.toString())
}

const byId = (list) => Object.fromEntries((list ?? []).map((x) => [x.id, x]))

/** Ответ сервера (массивы) → TreeData (словари по id). */
function toTreeData(t) {
  return {
    version: 2,
    id: t.id,
    name: t.name,
    description: t.description ?? '',
    homePersonId: t.homePersonId,
    persons: byId(t.persons),
    families: byId(t.families.map((f) => ({ ...f, childLinks: f.childLinks ?? {} }))),
    places: byId(t.places),
    media: byId(t.media.map((m) => ({ ...m, fileKey: null }))),
    sources: byId(t.sources),
    clans: byId(t.clans),
    customFields: t.customFields ?? [],
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  }
}

const auth = {
  setUnauthorizedHandler(fn) {
    onUnauthorized = fn
  },
  async me(token) {
    takeOAuthToken()
    if (token) accessToken = token
    if (!accessToken) {
      const rt = localStorage.getItem(LS_REFRESH)
      if (!rt) return null
      try {
        const d = await client.request(Op.M_REFRESH, { refreshToken: rt }, { auth: false })
        applyAuth(d.refreshToken)
      } catch {
        return null
      }
    }
    const d = await client.request(Op.Q_ME)
    return d.me ? { ...d.me, guest: false } : null
  },
  continueAsGuest: () => Promise.reject(new ApiError('Гостевой режим недоступен — войдите или зарегистрируйтесь', 'UNSUPPORTED')),
  async register(input) {
    const d = await client.request(Op.M_REGISTER, { input: { name: input.name, email: input.email, password: input.password } }, { auth: false })
    return applyAuth(d.register)
  },
  async login({ email, password }) {
    const d = await client.request(Op.M_LOGIN, { email, password }, { auth: false })
    return applyAuth(d.login)
  },
  async logout() {
    await client.request(Op.M_LOGOUT, { refreshToken: localStorage.getItem(LS_REFRESH) }).catch(() => {})
    accessToken = null
    localStorage.removeItem(LS_REFRESH)
  },
  async requestPasswordReset(email) {
    await client.request(Op.M_REQUEST_RESET, { email }, { auth: false })
    return { sent: true, devToken: null }
  },
  async resetPassword(token, password) {
    const d = await client.request(Op.M_RESET, { token, password }, { auth: false })
    return applyAuth(d.resetPassword)
  },
  async verifyEmail(token) {
    await client.request(Op.M_VERIFY, { token }, { auth: false })
    return { verified: true }
  },
  async resendVerification() {
    await client.request(Op.M_RESEND)
    return { sent: true }
  },
  async updateProfile(_token, patch) {
    const d = await client.request(Op.M_UPDATE_PROFILE, { input: patch })
    return { ...d.updateProfile, guest: false }
  },
  async changePassword(_token, { current, next }) {
    await client.request(Op.M_CHANGE_PASSWORD, { current, next })
    return true
  },
  async deleteAccount(_token, { password }) {
    await client.request(Op.M_DELETE_ACCOUNT, { password })
    accessToken = null
    localStorage.removeItem(LS_REFRESH)
    return true
  },
  oauthUrl(provider) {
    const base = config.graphqlUrl.replace(/\/graphql\/?$/, '')
    return `${base}/auth/${provider}?redirect=${encodeURIComponent(location.href.split('#')[0])}`
  },
}

const trees = {
  async list() {
    const d = await client.request(Op.Q_TREES)
    return d.trees
  },
  async get(treeId) {
    const d = await client.request(Op.Q_TREE, { id: treeId })
    if (!d.tree) throw new ApiError('Древо не найдено', 'NOT_FOUND')
    return { tree: toTreeData(d.tree), role: d.tree.role, version: d.tree.version }
  },
  async create(_userId, data) {
    const d = await client.request(Op.M_CREATE_TREE, {
      input: { name: data.name, description: data.description ?? '', data: stripLocal(data) },
    })
    return d.createTree
  },
  /**
   * @param {object} changes результат changesToInput() — только изменённые сущности
   */
  async save(treeId, _tree, changes) {
    const d = await client.request(Op.M_APPLY_CHANGES, { treeId, changes })
    return d.applyTreeChanges
  },
  async rename(treeId, name) {
    return trees.save(treeId, null, { tree: { name } })
  },
  async remove(treeId) {
    await client.request(Op.M_DELETE_TREE, { id: treeId })
  },
  async version(treeId) {
    const d = await client.request(Op.Q_TREE_VERSION, { id: treeId })
    return d.tree?.version ?? null
  },
}

/** Локальные ключи файлов на сервер не отправляются. */
function stripLocal(data) {
  return { ...data, media: Object.fromEntries(Object.entries(data.media ?? {}).map(([k, m]) => [k, { ...m, fileKey: null }])) }
}

const media = {
  /** Загрузка по подписанной ссылке (S3-совместимое хранилище): сервер выдаёт uploadUrl. */
  async upload(treeId, file) {
    const d = await client.request(Op.M_CREATE_UPLOAD, { treeId, filename: file.name, mime: file.type, size: file.size })
    const u = d.createUpload
    const res = await fetch(u.uploadUrl, { method: 'PUT', body: file, headers: { 'content-type': file.type, ...(u.headers ?? {}) } })
    if (!res.ok) throw new ApiError('Не удалось загрузить файл', 'NETWORK')
    return {
      fileKey: null,
      src: u.fileUrl,
      thumb: u.thumbUrl ?? (file.type.startsWith('image/') ? u.fileUrl : null),
      mime: file.type,
      size: file.size,
      kind: file.type.startsWith('image/') ? 'photo' : 'document',
      title: file.name.replace(/\.[^.]+$/, ''),
    }
  },
  async url(m) {
    return m?.src ?? m?.thumb ?? null
  },
  async remove() {},
  async exportData() {
    return null
  },
  async importData() {
    throw new ApiError('Импорт файлов из резервной копии выполняется сервером', 'UNSUPPORTED')
  },
}

const sharing = {
  /** Участники древа в форме, удобной интерфейсу: { id, role, name, email, avatar, pending } */
  async members(treeId) {
    const d = await client.request(Op.Q_MEMBERS, { treeId })
    return d.treeMembers.map((m) => ({
      id: m.id,
      role: m.role,
      name: m.user?.name ?? '',
      email: m.user?.email ?? m.invitedEmail ?? '',
      avatar: m.user?.avatar ?? null,
      pending: m.status === 'pending',
    }))
  },
  async invite(treeId, email, role) {
    const d = await client.request(Op.M_INVITE, { treeId, email, role })
    return d.inviteMember
  },
  async updateRole(memberId, role) {
    const d = await client.request(Op.M_UPDATE_MEMBER, { memberId, role })
    return d.updateMember
  },
  async remove(memberId) {
    await client.request(Op.M_REMOVE_MEMBER, { memberId })
  },
  async publicLink(treeId, enabled) {
    const d = await client.request(Op.M_SHARE_LINK, { treeId, enabled })
    return d.setPublicLink
  },
}

export const graphqlApi = {
  mode: 'graphql',
  capabilities: { guest: false, sharing: true, sync: true, emailFlows: true, oauth: config.oauthProviders.length > 0 },
  auth,
  trees,
  media,
  sharing,
}
