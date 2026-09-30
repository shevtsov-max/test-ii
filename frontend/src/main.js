import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { Quasar, Notify, Dialog, Dark, Loading, LocalStorage } from 'quasar'
import quasarLang from 'quasar/lang/ru'
import iconSet from 'quasar/icon-set/svg-material-symbols-rounded'
import { ICONS } from './icons.generated'
import { createAppRouter } from './app/router'

import '@fontsource-variable/inter'
import '@fontsource-variable/lora'
import 'quasar/src/css/index.sass'
import './styles/app.scss'

import App from './App.vue'

const app = createApp(App)
app.use(createPinia())
app.use(createAppRouter())
app.use(Quasar, {
  plugins: { Notify, Dialog, Dark, Loading, LocalStorage },
  lang: quasarLang,
  iconSet,
  config: {
    notify: { position: 'bottom', timeout: 2600, classes: 'ft-notify' },
  },
})
// Иконки `sym_r_*` отрисовываются из SVG (без загрузки 5-мегабайтного шрифта)
app.config.globalProperties.$q.iconMapFn = (name) => (ICONS[name] ? { icon: ICONS[name] } : undefined)
app.mount('#app')
