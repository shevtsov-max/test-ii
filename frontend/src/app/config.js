/**
 * Настройки сборки. Задаются переменными окружения Vite (см. .env.example).
 */
const env = import.meta.env ?? {}

export const config = {
  /** Откуда берутся данные: local — браузер (IndexedDB), graphql — сервер */
  apiMode: env.VITE_API_MODE === 'graphql' ? 'graphql' : 'local',
  /** Адрес GraphQL API */
  graphqlUrl: env.VITE_GRAPHQL_URL || '/graphql',
  /** hash — ссылки вида /#/app (работает на любом статическом хостинге), history — «чистые» адреса */
  routerMode: env.VITE_ROUTER_MODE === 'history' ? 'history' : 'hash',
  /** Вход через соцсети (только с сервером): google,vk,yandex */
  oauthProviders: String(env.VITE_OAUTH_PROVIDERS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  appName: 'Прапра',
  version: typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev',
  buildTime: typeof __BUILD_TIME__ === 'string' ? __BUILD_TIME__ : '',
  supportEmail: env.VITE_SUPPORT_EMAIL || 'support@example.com',
  /** Адрес сайта для юридических документов */
  siteUrl: env.VITE_SITE_URL || '',
  /** Оператор персональных данных — реквизиты для документов (VITE_OPERATOR_*) */
  operator: {
    name: env.VITE_OPERATOR_NAME || '',
    inn: env.VITE_OPERATOR_INN || '',
    ogrn: env.VITE_OPERATOR_OGRN || '',
    address: env.VITE_OPERATOR_ADDRESS || '',
  },
}
