/**
 * Единый тип ошибки API — и для локального режима, и для GraphQL.
 * code: UNAUTHENTICATED | FORBIDDEN | NOT_FOUND | VALIDATION | CONFLICT | NETWORK | UNSUPPORTED | INTERNAL
 */
export class ApiError extends Error {
  /**
   * @param {string} message текст для пользователя
   * @param {string} [code]
   * @param {Record<string, string>} [fields] ошибки по полям формы
   */
  constructor(message, code = 'INTERNAL', fields = undefined) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.fields = fields
  }

  static fromGraphQL(errors) {
    const e = errors[0] ?? {}
    const ext = e.extensions ?? {}
    return new ApiError(e.message || 'Ошибка сервера', ext.code || 'INTERNAL', ext.fields)
  }
}

export const unsupported = (what) => () => Promise.reject(new ApiError(`${what} доступно после подключения сервера`, 'UNSUPPORTED'))

/** Сообщение об ошибке для уведомления. */
export function errorMessage(e) {
  if (!e) return 'Неизвестная ошибка'
  if (e instanceof ApiError) return e.message
  if (e.name === 'AbortError') return 'Запрос отменён'
  if (e instanceof TypeError && /fetch|network/i.test(e.message)) return 'Нет соединения с сервером'
  return e.message || String(e)
}
