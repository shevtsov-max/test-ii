/**
 * Локальные учётные записи (режим без сервера). Пароли хранятся как PBKDF2-хеш с солью.
 * Письма не отправляются: ссылка для сброса пароля показывается сразу.
 * Интерфейс совпадает с GraphQL-адаптером (src/api/graphql/index.js).
 */
import { ApiError } from '../errors'
import { store } from './db'
import { uid } from '@/domain/model'
import { validatePassword } from '@/utils/password'

export { validatePassword }

export const GUEST_ID = 'guest'

const guestUser = () => ({ id: GUEST_ID, email: '', name: 'Гость', avatar: null, emailVerified: false, guest: true, createdAt: 0 })

const enc = new TextEncoder()
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
const randomToken = (n = 24) => hex(crypto.getRandomValues(new Uint8Array(n)))

async function hashPassword(password, salt) {
  if (crypto.subtle) {
    const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode(salt), iterations: 120000, hash: 'SHA-256' }, key, 256)
    return hex(bits)
  }
  // Небезопасный контекст (http): простой хеш — только чтобы не хранить пароль открытым текстом
  let h = 2166136261
  for (const ch of salt + password) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  return 'fnv' + (h >>> 0).toString(16)
}

const publicUser = (u) => ({
  id: u.id,
  email: u.email,
  name: u.name,
  avatar: u.avatar ?? null,
  emailVerified: !!u.emailVerified,
  guest: false,
  createdAt: u.createdAt,
})

const normEmail = (e) => String(e ?? '').trim().toLowerCase()


async function createSession(userId) {
  const token = randomToken()
  await store.put('sessions', { userId, createdAt: Date.now() }, token)
  return token
}

async function userByEmail(email) {
  return store.oneByIndex('users', 'email', normEmail(email))
}

/** Переносит древа гостя в новую учётную запись. */
async function adoptGuestTrees(userId) {
  const list = await store.byIndex('summaries', 'ownerId', GUEST_ID)
  for (const s of list) await store.put('summaries', { ...s, ownerId: userId })
}

export const auth = {
  async me(token) {
    if (!token) return null
    const s = await store.get('sessions', token)
    if (!s) return null
    if (s.userId === GUEST_ID) return guestUser()
    const u = await store.get('users', s.userId)
    return u ? publicUser(u) : null
  },

  async continueAsGuest() {
    return { user: guestUser(), token: await createSession(GUEST_ID) }
  },

  async register({ name, email, password }, { fromGuest = false } = {}) {
    const e = normEmail(email)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw new ApiError('Проверьте адрес почты', 'VALIDATION', { email: 'Неверный адрес' })
    const pwErr = validatePassword(password)
    if (pwErr) throw new ApiError(pwErr, 'VALIDATION', { password: pwErr })
    if (await userByEmail(e)) throw new ApiError('Этот адрес уже зарегистрирован', 'CONFLICT', { email: 'Адрес уже используется' })
    const salt = randomToken(12)
    const user = {
      id: uid('u'),
      email: e,
      name: String(name ?? '').trim() || e.split('@')[0],
      avatar: null,
      salt,
      passwordHash: await hashPassword(password, salt),
      // Писем нет — считаем адрес подтверждённым
      emailVerified: true,
      createdAt: Date.now(),
    }
    await store.put('users', user)
    if (fromGuest) await adoptGuestTrees(user.id)
    return { user: publicUser(user), token: await createSession(user.id) }
  },

  async login({ email, password }) {
    const u = await userByEmail(email)
    if (!u || (await hashPassword(password, u.salt)) !== u.passwordHash) throw new ApiError('Неверная почта или пароль', 'UNAUTHENTICATED')
    return { user: publicUser(u), token: await createSession(u.id) }
  },

  async logout(token) {
    if (token) await store.delete('sessions', token)
  },

  async requestPasswordReset(email) {
    const u = await userByEmail(email)
    // Не раскрываем, есть ли такой адрес; в локальном режиме возвращаем ссылку сразу
    if (!u) return { sent: true, devToken: null }
    const token = randomToken(16)
    await store.put('users', { ...u, resetToken: token, resetExpires: Date.now() + 3600e3 })
    return { sent: true, devToken: token }
  },

  async resetPassword(token, password) {
    const pwErr = validatePassword(password)
    if (pwErr) throw new ApiError(pwErr, 'VALIDATION', { password: pwErr })
    const all = await store.all('users')
    const u = all.find((x) => x.resetToken === token && x.resetExpires > Date.now())
    if (!u) throw new ApiError('Ссылка устарела или уже использована', 'NOT_FOUND')
    const salt = randomToken(12)
    await store.put('users', { ...u, salt, passwordHash: await hashPassword(password, salt), resetToken: null, resetExpires: 0 })
    return { user: publicUser(u), token: await createSession(u.id) }
  },

  async verifyEmail() {
    return { verified: true }
  },

  async resendVerification() {
    return { sent: true }
  },

  async updateProfile(token, patch) {
    const me = await auth.me(token)
    if (!me || me.guest) throw new ApiError('Войдите в учётную запись', 'UNAUTHENTICATED')
    const u = await store.get('users', me.id)
    const next = { ...u }
    if (patch.name !== undefined) next.name = String(patch.name).trim() || u.name
    if (patch.avatar !== undefined) next.avatar = patch.avatar
    if (patch.email !== undefined && normEmail(patch.email) !== u.email) {
      const e = normEmail(patch.email)
      if (await userByEmail(e)) throw new ApiError('Этот адрес уже зарегистрирован', 'CONFLICT', { email: 'Адрес уже используется' })
      next.email = e
    }
    await store.put('users', next)
    return publicUser(next)
  },

  async changePassword(token, { current, next }) {
    const me = await auth.me(token)
    if (!me || me.guest) throw new ApiError('Войдите в учётную запись', 'UNAUTHENTICATED')
    const u = await store.get('users', me.id)
    if ((await hashPassword(current, u.salt)) !== u.passwordHash) throw new ApiError('Текущий пароль неверен', 'VALIDATION', { current: 'Неверный пароль' })
    const pwErr = validatePassword(next)
    if (pwErr) throw new ApiError(pwErr, 'VALIDATION', { next: pwErr })
    const salt = randomToken(12)
    await store.put('users', { ...u, salt, passwordHash: await hashPassword(next, salt) })
    return true
  },

  async deleteAccount(token, { password }) {
    const me = await auth.me(token)
    if (!me || me.guest) throw new ApiError('Войдите в учётную запись', 'UNAUTHENTICATED')
    const u = await store.get('users', me.id)
    if ((await hashPassword(password, u.salt)) !== u.passwordHash) throw new ApiError('Пароль неверен', 'VALIDATION', { password: 'Неверный пароль' })
    const trees = await store.byIndex('summaries', 'ownerId', me.id)
    for (const t of trees) {
      await store.delete('trees', t.id)
      await store.delete('summaries', t.id)
    }
    await store.delete('users', me.id)
    await store.delete('sessions', token)
    return true
  },

  oauthUrl() {
    return null
  },
}
