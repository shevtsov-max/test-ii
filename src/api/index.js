/**
 * Точка доступа к данным. Сторы работают только через `api` и не знают, где лежат данные:
 * в браузере (local) или на сервере (graphql). Режим выбирается переменной VITE_API_MODE.
 *
 * Интерфейс адаптера:
 *   api.auth     me, continueAsGuest, register, login, logout, requestPasswordReset, resetPassword,
 *                verifyEmail, resendVerification, updateProfile, changePassword, deleteAccount, oauthUrl
 *   api.trees    list, get, create, save, rename, remove, version
 *   api.media    upload, url, remove, exportData, importData
 *   api.sharing  members, invite, updateRole, remove, publicLink
 *   api.capabilities  { guest, sharing, sync, emailFlows, oauth }
 */
import { config } from '@/app/config'
import { graphqlApi } from './graphql'
import { localApi } from './local'

export const api = config.apiMode === 'graphql' ? graphqlApi : localApi
export { ApiError, errorMessage } from './errors'
