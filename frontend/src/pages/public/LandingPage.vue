<script setup>
/** Главная страница для гостей сайта: что это, что умеет, как начать. */
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import ChartScene from '@/components/chart/ChartScene.vue'
import { chartPalette } from '@/components/chart/palette'
import { useAuthStore } from '@/stores/auth'
import { useTreesStore, EXAMPLES } from '@/stores/trees'
import { api } from '@/api'
import { errorMessage } from '@/api/errors'
import { demoTree } from '@/data/seed'
import { FamilyGraph } from '@/domain/graph'
import { relationship } from '@/domain/kinship'
import { computeChart } from '@/domain/layout'

const $q = useQuasar()
const router = useRouter()
const auth = useAuthStore()
const trees = useTreesStore()

/** С сервером: облачное хранение, совместная работа, передача веток, напоминания */
const server = api.mode === 'graphql'
const signedIn = computed(() => auth.isAuthenticated && !auth.isGuest)
const hasSession = computed(() => auth.isAuthenticated)
const busy = ref(false)

async function ensureSession() {
  if (!auth.isAuthenticated) await auth.continueAsGuest()
}
async function tryIt() {
  if (!api.capabilities.guest && !auth.isAuthenticated) return router.push({ name: 'register' })
  busy.value = true
  try {
    await ensureSession()
    router.push({ name: 'new-tree' })
  } catch (e) {
    $q.notify({ type: 'negative', message: errorMessage(e) })
  } finally {
    busy.value = false
  }
}
async function openExample(id = 'romanovs') {
  if (!api.capabilities.guest && !auth.isAuthenticated) return router.push({ name: 'register' })
  busy.value = true
  try {
    await ensureSession()
    if (!trees.loaded) await trees.fetch()
    const name = EXAMPLES.find((x) => x.id === id)?.make().name
    const existing = trees.list.find((t) => t.name === name)
    const s = existing ?? (await trees.createExample(id))
    router.push({ name: 'tree-chart', params: { treeId: s.id } })
  } catch (e) {
    $q.notify({ type: 'negative', message: errorMessage(e) })
  } finally {
    busy.value = false
  }
}

// Живой фрагмент древа — тот же движок раскладки и отрисовки, что и в приложении
const demo = (() => {
  const t = demoTree()
  const G = new FamilyGraph(t)
  const L = computeChart(G, 'me', { view: 'tree', scope: 'direct', up: 2, down: 1, density: 'normal', placeholders: false })
  const b = L.bounds
  const pad = 24
  return {
    t,
    L,
    relationOf: (id) => relationship(G, 'me', id),
    viewBox: `${b.minX - pad} ${b.minY - pad} ${b.maxX - b.minX + pad * 2} ${b.maxY - b.minY + pad * 2}`,
  }
})()
const demoOpts = { photos: true, years: true, relation: true, places: true, patronymic: false, colorBy: 'gender' }
const P = computed(() => chartPalette($q.dark.isActive))

const features = [
  { icon: 'sym_r_account_tree', title: 'Древо любой сложности', text: 'Повторные браки, сводные братья и сёстры, усыновление и опека, браки между родственниками — схема остаётся читаемой.' },
  { icon: 'sym_r_diversity_3', title: 'Кем кому приходится', text: '«Двоюродная бабушка», «Муж свояченицы», «Прапрадед» — родство подписывается само и объясняется цепочкой.' },
  { icon: 'sym_r_badge', title: 'Всё о человеке', text: 'Девичья фамилия, отчество, титулы, даты по старому стилю и «около 1850», места, занятия, свои поля.' },
  { icon: 'sym_r_photo_library', title: 'Фото и документы', text: 'Метрики, письма, фотографии — один документ можно связать с несколькими людьми.' },
  { icon: 'sym_r_menu_book', title: 'Источники', text: 'Ссылки на архивы и метрические книги для каждого факта: видно, что подтверждено, а что — семейное предание.' },
  server
    ? { icon: 'sym_r_cake', title: 'Не забудете поздравить', text: 'Дни рождения и годовщины родных — на главной странице и в Телеграме, утром в удобное время.' }
    : { icon: 'sym_r_description', title: 'Росписи и статистика', text: 'Поколенная и восходящая роспись для печати, поиск ошибок в датах и дубликатов.' },
  server
    ? { icon: 'sym_r_forward_to_inbox', title: 'Передайте ветку родне', text: 'Пригласите дальнего родственника продолжить его ветку. Она останется видна в вашем древе, а данные можно склонировать себе.' }
    : { icon: 'sym_r_wifi_off', title: 'Работает без интернета', text: 'Устанавливается на телефон и компьютер как приложение, обновляется одним нажатием.' },
  { icon: 'sym_r_swap_horiz', title: 'Ваши данные — ваши', text: 'Импорт и экспорт GEDCOM: перенос из «Древа Жизни», MyHeritage, Ancestry и обратно.' },
]
const views = [
  { icon: 'sym_r_account_tree', title: 'Семейное древо', text: 'Предки и потомки вокруг выбранного человека' },
  { icon: 'sym_r_family_history', title: 'Родословная', text: 'Компактная схема предков по линиям' },
  { icon: 'sym_r_donut_large', title: 'Веер', text: 'Все предки на одном круге — видно, где пробелы' },
  { icon: 'sym_r_view_timeline', title: 'Лента времени', text: 'Жизни на шкале лет рядом с историческими эпохами' },
  { icon: 'sym_r_hub', title: 'Все родственники', text: 'Свойственники и дальняя родня по поколениям' },
]
const steps = [
  { n: 1, title: 'Начните с себя', text: `Укажите своё имя и год рождения — это займёт минуту.${server ? '' : ' Регистрация не обязательна.'}` },
  { n: 2, title: 'Добавляйте родных прямо на схеме', text: 'Нажмите «+» у карточки: отец, мать, супруг, ребёнок. Фамилия и отчество подставятся сами.' },
  { n: 3, title: 'Сохраняйте и делитесь', text: 'Печатайте древо и росписи, выгружайте в PDF, PNG и GEDCOM, храните резервную копию.' },
]
const cases = [
  'Несколько браков',
  'Сводные братья и сёстры',
  'Усыновление и опека',
  'Отчим и мачеха',
  'Гражданский брак и помолвка',
  'Браки между родственниками',
  'Старый стиль: 6 (18) мая 1868',
  '«Около 1850», «между 1880 и 1885»',
  'Девичьи и двойные фамилии',
  'Николай II, князь, граф',
  'Пропавшие без вести',
  'Близнецы',
]
const faq = [
  {
    q: 'Это бесплатно?',
    a: 'Да. Все возможности для построения древа доступны бесплатно, без ограничения числа людей.',
  },
  {
    q: 'Где хранятся мои данные?',
    a: server
      ? 'На нашем сервере в России. Древо видите только вы и те, кого вы пригласили. В любой момент можно скачать резервную копию (Настройки древа → Экспорт) или удалить учётную запись вместе со всеми данными.'
      : 'Сейчас — в вашем браузере, на вашем устройстве: никто, кроме вас, их не видит. Регулярно скачивайте резервную копию (Настройки древа → Экспорт) — из неё древо восстанавливается на любом устройстве.',
  },
  {
    q: 'Можно ли перенести древо из «Древа Жизни», MyHeritage или Ancestry?',
    a: 'Да. Выгрузите древо в формате GEDCOM (.ged) в старой программе и импортируйте его здесь: люди, семьи, даты, места и заметки перенесутся.',
  },
  {
    q: 'Как установить на телефон?',
    a: 'Откройте сайт в Chrome, Safari или Яндекс Браузере и выберите «Установить приложение» (на iPhone — «Поделиться» → «На экран Домой»). После установки древо открывается без интернета.',
  },
  {
    q: 'Что делать, если дата известна неточно?',
    a: 'Пишите как есть: «около 1850», «до 1900», «между 1880 и 1885», «весна 1916» или дату по старому стилю — программа поймёт и учтёт это при сортировке и подсчёте возраста.',
  },
  {
    q: 'Можно ли вести древо вместе с родственниками?',
    a: server
      ? 'Да. Пригласите родных по почте с ролью «редактор» или «читатель» (Настройки древа → Доступ). А ветку дальнего родственника можно передать ему целиком: он продолжит её в своём древе, а вы будете видеть изменения.'
      : 'Совместная работа с ролями «редактор» и «читатель» появится вместе с облачной синхронизацией. Пока можно обмениваться файлом резервной копии.',
  },
  ...(server
    ? [
        {
          q: 'Что будет с веткой, которую я передал родственнику?',
          a: 'Она останется в вашем древе, но только для просмотра: её ведёт родственник, и вы сразу видите, что он добавил. Кнопка «Склонировать себе» копирует ветку в ваше древо — дальше копию можно править, а у родственника ничего не изменится.',
        },
        {
          q: 'Как получать напоминания о днях рождения?',
          a: 'Ближайшие дни рождения и годовщины показываются на странице «Мои древа». Подключите Телеграм в профиле (Уведомления) — бот будет присылать список утром в выбранное время. Это бесплатно.',
        },
      ]
    : []),
]
</script>

<template>
  <div class="ld">
    <!-- Первый экран -->
    <section class="ld__hero">
      <div class="ld__wrap ld__hero-grid">
        <div class="ld__hero-text">
          <span class="ld__eyebrow"><q-icon name="sym_r_stars" size="16px" />{{ server ? 'Бесплатно · вместе с роднёй' : 'Бесплатно · работает без интернета' }}</span>
          <h1 class="ld__title">Соберите историю своей семьи</h1>
          <p class="ld__lead">
            Постройте родословное древо, сохраните фотографии, документы и воспоминания — и узнайте, кем вам приходятся самые дальние родственники.
          </p>
          <div class="ld__cta">
            <template v-if="signedIn">
              <q-btn unelevated no-caps color="primary" size="lg" icon-right="sym_r_arrow_forward" label="Продолжить работу" :to="{ name: 'dashboard' }" />
            </template>
            <template v-else>
              <q-btn unelevated no-caps color="primary" size="lg" label="Создать древо" :loading="busy" @click="hasSession ? router.push({ name: 'dashboard' }) : tryIt()" />
              <q-btn outline no-caps color="primary" size="lg" icon="sym_r_visibility" label="Посмотреть пример" :disable="busy" @click="openExample('romanovs')" />
            </template>
          </div>
          <p v-if="!signedIn && !hasSession && api.capabilities.guest" class="ld__terms">
            Продолжая без регистрации, вы принимаете <router-link :to="{ name: 'terms' }">Пользовательское соглашение</router-link>.
          </p>
          <div class="ld__trust">
            <span v-if="server"><q-icon name="sym_r_lock" size="16px" />Доступ — только тем, кого вы пригласили</span>
            <span v-else><q-icon name="sym_r_lock" size="16px" />Данные остаются у вас</span>
            <span><q-icon name="sym_r_install_desktop" size="16px" />Устанавливается как приложение</span>
            <span><q-icon name="sym_r_swap_horiz" size="16px" />GEDCOM</span>
          </div>
        </div>
        <div class="ld__shot" aria-label="Пример семейного древа">
          <div class="ld__shot-bar">
            <i /><i /><i />
            <span>Семья Орловых — древо</span>
          </div>
          <svg :viewBox="demo.viewBox" class="ld__shot-svg" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Схема: родители, бабушки и дедушки, братья и сёстры, дети">
            <ChartScene
              :nodes="demo.L.nodes"
              :edges="demo.L.edges"
              :tree="demo.t"
              :metrics="demo.L.metrics"
              :palette="P"
              :opts="demoOpts"
              :relation-of="demo.relationOf"
              home-id="me"
              selected-id="me"
              lod="full"
              id-prefix="ld"
            />
          </svg>
        </div>
      </div>
    </section>

    <!-- Возможности -->
    <section id="features" class="ld__section">
      <div class="ld__wrap">
        <div class="ld__section-head">
          <span class="ft-label">Возможности</span>
          <h2 class="ld__h2">Всё, что нужно для родословной</h2>
          <p>От первой карточки до книги о семье: удобно начинать и не тесно, когда в древе сотни людей.</p>
        </div>
        <div class="ld__features">
          <article v-for="f in features" :key="f.title" class="ld__feature">
            <span class="ld__feature-icon"><q-icon :name="f.icon" size="22px" /></span>
            <h3>{{ f.title }}</h3>
            <p>{{ f.text }}</p>
          </article>
        </div>
      </div>
    </section>

    <!-- Виды -->
    <section class="ld__section ld__section--alt">
      <div class="ld__wrap">
        <div class="ld__section-head">
          <span class="ft-label">Пять способов увидеть семью</span>
          <h2 class="ld__h2">Одно древо — разные взгляды</h2>
          <p>Переключайтесь одним нажатием: каждый вид отвечает на свой вопрос. Любую схему можно распечатать или сохранить в PNG и SVG.</p>
        </div>
        <div class="ld__views">
          <div v-for="v in views" :key="v.title" class="ld__view">
            <q-icon :name="v.icon" size="26px" />
            <b>{{ v.title }}</b>
            <span>{{ v.text }}</span>
          </div>
        </div>
      </div>
    </section>

    <!-- Как это работает -->
    <section id="how" class="ld__section">
      <div class="ld__wrap">
        <div class="ld__section-head">
          <span class="ft-label">Как это работает</span>
          <h2 class="ld__h2">Первое поколение — за пять минут</h2>
        </div>
        <ol class="ld__steps">
          <li v-for="s in steps" :key="s.n">
            <span class="ld__step-n">{{ s.n }}</span>
            <h3>{{ s.title }}</h3>
            <p>{{ s.text }}</p>
          </li>
        </ol>
      </div>
    </section>

    <!-- Нестандартные случаи -->
    <section class="ld__section ld__section--alt">
      <div class="ld__wrap ld__cases">
        <div>
          <span class="ft-label">Жизнь сложнее схемы</span>
          <h2 class="ld__h2">Учтены непростые случаи</h2>
          <p class="ld__muted">
            В настоящих семьях бывают вторые браки, приёмные дети и даты «со слов бабушки». Всё это можно записать как есть — и схема покажет это
            честно: пунктиром для неродных связей, пометками для приблизительных дат.
          </p>
        </div>
        <div class="ld__chips">
          <span v-for="c in cases" :key="c" class="ld__chip"><q-icon name="sym_r_check" size="16px" />{{ c }}</span>
        </div>
      </div>
    </section>

    <!-- Вопросы -->
    <section id="faq" class="ld__section">
      <div class="ld__wrap ld__faq-wrap">
        <div class="ld__section-head">
          <span class="ft-label">Вопросы</span>
          <h2 class="ld__h2">Частые вопросы</h2>
        </div>
        <q-list class="ld__faq">
          <q-expansion-item v-for="(f, i) in faq" :key="i" :label="f.q" header-class="ld__faq-q" expand-icon="sym_r_keyboard_arrow_down" group="faq">
            <div class="ld__faq-a">{{ f.a }}</div>
          </q-expansion-item>
        </q-list>
      </div>
    </section>

    <!-- Финальный призыв -->
    <section class="ld__final">
      <div class="ld__wrap ld__final-in">
        <h2 class="ld__h2">Начните с себя — остальное подскажем</h2>
        <p>Каждое поколение, записанное сегодня, — подарок тем, кто придёт после.</p>
        <div class="ld__cta ld__cta--center">
          <q-btn v-if="signedIn" unelevated no-caps color="primary" size="lg" label="Мои древа" :to="{ name: 'dashboard' }" />
          <template v-else>
            <q-btn unelevated no-caps color="primary" size="lg" label="Создать древо" :loading="busy" @click="hasSession ? router.push({ name: 'dashboard' }) : tryIt()" />
            <q-btn flat no-caps size="lg" label="Зарегистрироваться" :to="{ name: 'register' }" />
          </template>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped lang="scss">
.ld__wrap {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
}
.ld__hero {
  padding: 56px 0 72px;
  background: radial-gradient(60% 80% at 85% 30%, color-mix(in srgb, var(--ft-primary) 11%, transparent), transparent 70%);
}
.ld__hero-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr);
  gap: 48px;
  align-items: center;
}
.ld__eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: 999px;
  background: var(--ft-primary-soft);
  color: var(--ft-primary-text);
  font-size: 13px;
  font-weight: 650;
}
.ld__title {
  margin: 18px 0 16px;
  font-family: var(--ft-font-display);
  font-size: clamp(36px, 5vw, 56px);
  font-weight: 600;
  line-height: 1.08;
  letter-spacing: -0.02em;
}
.ld__lead {
  margin: 0;
  font-size: 18px;
  line-height: 1.6;
  color: var(--ft-text-2);
  max-width: 520px;
}
.ld__cta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 30px;
}
.ld__terms {
  margin: 12px 0 0;
  font-size: 12.5px;
  color: var(--ft-muted);
}
.ld__cta--center {
  justify-content: center;
}
.ld__trust {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 20px;
  margin-top: 26px;
  font-size: 13px;
  color: var(--ft-muted);
  span {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
}
.ld__shot {
  border-radius: 16px;
  border: 1px solid var(--ft-border);
  background:
    radial-gradient(var(--ft-dot) 1px, transparent 1.2px) 0 0 / 20px 20px,
    var(--ft-canvas);
  box-shadow: var(--ft-shadow-lg);
  overflow: hidden;
}
.ld__shot-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 14px;
  background: var(--ft-surface);
  border-bottom: 1px solid var(--ft-border);
  font-size: 12px;
  color: var(--ft-muted);
  i {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--ft-border-strong);
  }
  span {
    margin-left: 10px;
  }
}
.ld__shot-svg {
  display: block;
  width: 100%;
  height: auto;
  max-height: 460px;
  padding: 8px;
}
.ld__section {
  padding: 80px 0;
}
.ld__section--alt {
  background: var(--ft-surface-2);
  border-top: 1px solid var(--ft-border);
  border-bottom: 1px solid var(--ft-border);
}
.ld__section-head {
  max-width: 640px;
  margin-bottom: 40px;
  p {
    margin: 12px 0 0;
    color: var(--ft-text-2);
    font-size: 16px;
    line-height: 1.6;
  }
}
.ld__h2 {
  margin: 8px 0 0;
  font-family: var(--ft-font-display);
  font-size: clamp(28px, 3.4vw, 38px);
  font-weight: 600;
  line-height: 1.15;
  letter-spacing: -0.015em;
}
.ld__muted {
  color: var(--ft-text-2);
  font-size: 16px;
  line-height: 1.6;
  margin: 14px 0 0;
}
.ld__features {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}
.ld__feature {
  padding: 22px;
  border-radius: 16px;
  border: 1px solid var(--ft-border);
  background: var(--ft-surface);
  h3 {
    margin: 14px 0 6px;
    font-size: 16px;
    font-weight: 700;
  }
  p {
    margin: 0;
    font-size: 14px;
    line-height: 1.55;
    color: var(--ft-text-2);
  }
}
.ld__feature-icon {
  width: 42px;
  height: 42px;
  display: grid;
  place-items: center;
  border-radius: 12px;
  background: var(--ft-primary-soft);
  color: var(--ft-primary);
}
.ld__views {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
}
.ld__view {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 20px 18px;
  border-radius: 14px;
  background: var(--ft-surface);
  border: 1px solid var(--ft-border);
  font-size: 13.5px;
  color: var(--ft-text-2);
  .q-icon {
    color: var(--ft-accent);
    margin-bottom: 6px;
  }
  b {
    color: var(--ft-text);
    font-size: 15px;
  }
}
.ld__steps {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 28px;
  counter-reset: step;
  h3 {
    margin: 16px 0 6px;
    font-size: 18px;
    font-weight: 700;
  }
  p {
    margin: 0;
    color: var(--ft-text-2);
    line-height: 1.6;
  }
}
.ld__step-n {
  width: 40px;
  height: 40px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: var(--ft-primary);
  color: #fff;
  font-weight: 750;
  font-size: 17px;
}
.ld__cases {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr);
  gap: 48px;
  align-items: center;
}
.ld__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.ld__chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 999px;
  background: var(--ft-surface);
  border: 1px solid var(--ft-border);
  font-size: 14px;
  font-weight: 550;
  .q-icon {
    color: var(--ft-positive);
  }
}
.ld__faq-wrap {
  max-width: 820px;
}
.ld__faq {
  border-top: 1px solid var(--ft-border);
  :deep(.q-item) {
    min-height: 60px;
    padding: 8px 4px;
  }
  :deep(.q-expansion-item) {
    border-bottom: 1px solid var(--ft-border);
  }
}
:deep(.ld__faq-q) {
  font-size: 16px;
  font-weight: 650;
}
.ld__faq-a {
  padding: 0 4px 20px;
  color: var(--ft-text-2);
  line-height: 1.65;
}
.ld__final {
  padding: 80px 0;
  background: linear-gradient(180deg, transparent, color-mix(in srgb, var(--ft-primary) 8%, transparent));
}
.ld__final-in {
  text-align: center;
  p {
    margin: 12px 0 0;
    color: var(--ft-text-2);
    font-size: 17px;
  }
}
@media (max-width: 1080px) {
  .ld__features {
    grid-template-columns: repeat(2, 1fr);
  }
  .ld__views {
    grid-template-columns: repeat(3, 1fr);
  }
}
@media (max-width: 860px) {
  .ld__hero {
    padding-top: 32px;
  }
  .ld__hero-grid,
  .ld__cases {
    grid-template-columns: 1fr;
  }
  .ld__steps {
    grid-template-columns: 1fr;
  }
  .ld__views {
    grid-template-columns: repeat(2, 1fr);
  }
  .ld__section {
    padding: 56px 0;
  }
}
@media (max-width: 520px) {
  .ld__features,
  .ld__views {
    grid-template-columns: 1fr;
  }
}
</style>
