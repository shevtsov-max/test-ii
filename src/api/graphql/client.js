/**
 * Минимальный GraphQL-клиент на fetch: токен в заголовке Authorization, обновление токена
 * при UNAUTHENTICATED, таймаут, нормализованные ошибки (ApiError). Без внешних зависимостей —
 * при желании заменяется на urql/Apollo без изменения адаптеров.
 */
import { ApiError } from '../errors'

/**
 * @param {{ url: string, getToken: () => string | null, refresh?: () => Promise<boolean>, onUnauthorized?: () => void, timeout?: number }} opts
 */
export function createClient(opts) {
  const { url, getToken, refresh, onUnauthorized, timeout = 30000 } = opts

  async function send(query, variables, signal) {
    const token = getToken()
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeout)
    signal?.addEventListener('abort', () => ctrl.abort())
    let res
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/graphql-response+json, application/json',
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ query, variables }),
        credentials: 'include',
        signal: ctrl.signal,
      })
    } catch (e) {
      if (e.name === 'AbortError') throw new ApiError('Сервер не отвечает', 'NETWORK')
      throw new ApiError('Нет соединения с сервером', 'NETWORK')
    } finally {
      clearTimeout(timer)
    }
    let json
    try {
      json = await res.json()
    } catch {
      throw new ApiError(`Ошибка сервера (${res.status})`, res.status === 401 ? 'UNAUTHENTICATED' : 'INTERNAL')
    }
    if (json.errors?.length) throw ApiError.fromGraphQL(json.errors)
    if (res.status === 401) throw new ApiError('Требуется вход', 'UNAUTHENTICATED')
    return json.data
  }

  /**
   * @param {string} query
   * @param {object} [variables]
   * @param {{ signal?: AbortSignal, auth?: boolean }} [o]
   */
  async function request(query, variables = {}, o = {}) {
    try {
      return await send(query, variables, o.signal)
    } catch (e) {
      if (e.code === 'UNAUTHENTICATED' && o.auth !== false && refresh) {
        if (await refresh().catch(() => false)) return send(query, variables, o.signal)
        onUnauthorized?.()
      }
      throw e
    }
  }

  return { request }
}

/** Тег для подсветки GraphQL в редакторе; возвращает строку как есть. */
export const gql = (strings, ...values) => strings.reduce((s, str, i) => s + str + (values[i] ?? ''), '')
