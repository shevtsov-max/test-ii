/**
 * Точка доступа к данным. Сторы работают только через `api` и не знают, где лежат данные:
 * в браузере (local) или на сервере (graphql). Режим выбирается переменной VITE_API_MODE.
 *
 * Интерфейс адаптера:
 *   api.auth          me, continueAsGuest, register, login, logout, requestPasswordReset, resetPassword,
 *                     verifyEmail, resendVerification, updateProfile, changePassword, deleteAccount,
 *                     acceptDocuments, oauthUrl
 *   api.trees         list, get, create, save, rename, remove, version
 *   api.media         upload, url, remove, exportData, importData
 *   api.sharing       members, invite, updateRole, remove
 *   api.delegations   list, branches, create, revoke, clone        — передача ветки родственнику
 *   api.invitations   get, accept, decline                         — приглашения по ссылке #/invite/<token>
 *   api.notifications settings, update, telegramLink, disconnect, test, upcoming
 *   api.capabilities  { guest, sharing, sync, emailFlows, oauth, delegation, telegram }
 */
import { config } from '@/app/config'
import { graphqlApi } from './graphql'
import { localApi } from './local'

export const api = config.apiMode === 'graphql' ? graphqlApi : localApi
export { ApiError, errorMessage } from './errors'
