<script setup>
/** Справка: как пользоваться, форматы дат, импорт, установка, горячие клавиши. */
import { onMounted, onBeforeUnmount, ref } from 'vue'
import { SHORTCUTS } from '@/app/shortcuts'
import { config } from '@/app/config'
import { CHART_SCOPES } from '@/domain/layout'

const TOC = [
  { id: 'start', title: 'Первые шаги' },
  { id: 'chart', title: 'Древо и его виды' },
  { id: 'relatives', title: 'Родственники и семьи' },
  { id: 'dates', title: 'Даты' },
  { id: 'person', title: 'Сведения о человеке' },
  { id: 'media', title: 'Фото, документы, источники' },
  { id: 'reports', title: 'Росписи и проверка' },
  { id: 'import', title: 'Импорт и экспорт' },
  { id: 'pwa', title: 'Приложение и обновления' },
  { id: 'data', title: 'Где хранятся данные' },
  { id: 'keys', title: 'Горячие клавиши' },
]

const DATE_EXAMPLES = [
  ['13.05.1991', '13 мая 1991'],
  ['май 1991, 1991-05', 'май 1991'],
  ['около 1850, ~1850, ок. 1850', 'около 1850'],
  ['до 1900, после 1905', 'до 1900 · после 1905'],
  ['между 1880 и 1885, 1880–1885', 'между 1880 и 1885'],
  ['6.05.1868 ст. ст.', '6 (18) мая 1868 — старый стиль, в скобках — новый'],
  ['весна 1916, «зимой после войны»', 'сохраняется как текст'],
]

const active = ref('start')
let io = null
onMounted(() => {
  io = new IntersectionObserver(
    (entries) => {
      const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
      if (vis[0]) active.value = vis[0].target.id
    },
    { rootMargin: '-80px 0px -60% 0px' },
  )
  for (const t of TOC) {
    const el = document.getElementById(t.id)
    if (el) io.observe(el)
  }
})
onBeforeUnmount(() => io?.disconnect())
const go = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
</script>

<template>
  <div class="hp">
    <header class="hp__head">
      <div class="hp__wrap">
        <span class="ft-label">Справка</span>
        <h1 class="hp__title">Как пользоваться «Прапра»</h1>
        <p>Короткие ответы на главные вопросы. Не нашли нужного — напишите нам: <a :href="`mailto:${config.supportEmail}`">{{ config.supportEmail }}</a></p>
      </div>
    </header>

    <div class="hp__wrap hp__layout">
      <nav class="hp__toc">
        <a v-for="t in TOC" :key="t.id" :href="`#${t.id}`" :class="{ active: active === t.id }" @click.prevent="go(t.id)">{{ t.title }}</a>
      </nav>

      <article class="hp__body">
        <section id="start">
          <h2>Первые шаги</h2>
          <ol>
            <li>Нажмите <b>«Создать древо»</b> и укажите своё имя — вы станете первой карточкой и точкой отсчёта родства («Это Вы»).</li>
            <li>Наведите курсор на карточку (или нажмите на неё на телефоне) и нажмите <b>«+»</b>: появятся кнопки «Отец», «Мать», «Супруг», «Ребёнок», «Брат или сестра».</li>
            <li>
              В форме нового родственника фамилия и отчество уже подставлены (фамилия у женщин — в женской форме). Можно выбрать и уже существующего
              человека — тогда связь просто добавится.
            </li>
            <li>Двойной щелчок по карточке открывает профиль, правый щелчок — меню со всеми действиями.</li>
          </ol>
          <p>Без регистрации можно работать сразу: древо хранится в браузере. Если позже зарегистрироваться, всё созданное перейдёт в учётную запись.</p>
        </section>

        <section id="chart">
          <h2>Древо и его виды</h2>
          <p>Над схемой — переключатель видов:</p>
          <ul>
            <li><b>Древо</b> — предки сверху, потомки снизу, супруги рядом. Центральная персона выделена.</li>
            <li><b>Прапра</b> — компактная горизонтальная схема предков: удобно печатать на одном листе.</li>
            <li><b>Веер</b> — все предки на круге, пустые сектора сразу показывают, кого ещё не нашли.</li>
            <li><b>Лента времени</b> — годы жизни на шкале рядом с историческими эпохами.</li>
          </ul>
          <p>Для вида «Древо» выберите <b>охват</b> — какую часть семьи показывать:</p>
          <ul>
            <li v-for="s in CHART_SCOPES" :key="s.value">
              <b>{{ s.label }}</b> — {{ s.hint.charAt(0).toLowerCase() + s.hint.slice(1) }}
            </li>
          </ul>
          <p>
            «Показать предков» или «Показать потомков» у края карточки (или F5) перестраивает древо вокруг этого человека. Стрелки «Назад» и «Вперёд»
            на панели древа (Alt+← и Alt+→) возвращают к предыдущему центру. Схему можно распечатать или сохранить в PNG и SVG (кнопка «Экспорт»).
          </p>
        </section>

        <section id="relatives">
          <h2>Родственники и семьи</h2>
          <p>
            Семья — это пара (или один родитель) и их дети. У человека может быть несколько семей: повторные браки, гражданский брак, помолвка. Тип
            отношений и даты брака и развода меняются в окне семьи (щелчок по линии между супругами или «Изменить отношения» в меню).
          </p>
          <ul>
            <li>
              <b>Неродные дети</b>: у каждого ребёнка в семье указывается связь — кровный, усыновлён, приёмный, неродной (для отчима или мачехи), под
              опекой. Неродные связи рисуются пунктиром.
            </li>
            <li><b>Сводные братья и сёстры</b> получаются сами, если у детей общий только один родитель.</li>
            <li><b>Двое родителей у ребёнка</b> — например, биологические и приёмные — это две семьи; в древе показывается основная.</li>
            <li><b>Браки между родственниками</b> и «схлопывание» предков поддерживаются: один и тот же предок показывается один раз, а в росписи дается ссылка.</li>
          </ul>
          <p>Кем человек приходится «Это Вы», подписано над именем на карточке. Цепочку родства между любыми двумя людьми покажет «Как связаны?» в меню персоны.</p>
        </section>

        <section id="dates">
          <h2>Даты</h2>
          <p>Дату можно ввести так, как она известна. Программа распознаёт:</p>
          <table class="hp__table">
            <thead>
              <tr>
                <th>Что ввести</th>
                <th>Как будет записано</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="d in DATE_EXAMPLES" :key="d[0]">
                <td>
                  <code>{{ d[0] }}</code>
                </td>
                <td>{{ d[1] }}</td>
              </tr>
            </tbody>
          </table>
          <p>Приблизительные даты учитываются при сортировке и подсчёте возраста, а в карточках отмечаются знаком «~».</p>
        </section>

        <section id="person">
          <h2>Сведения о человеке</h2>
          <p>
            В профиле — фамилия, имя, отчество, фамилия при рождении, прозвище, титул и порядковый номер (например, «Николай II»), пол, даты и места
            рождения и смерти, причина смерти, место жительства, род занятий, род (ветвь фамилии), биография и заметки. Если нужных полей не хватает,
            добавьте свои в настройках древа — например, «Основное занятие» или «Номер в метрической книге».
          </p>
          <p>
            <b>События</b> — всё остальное в жизни: крещение, учёба, служба, переезды, награды. Места хранятся справочником с вложенностью: «Россия →
            Тверская губерния → Тверь», поэтому по ним работает поиск и фильтр.
          </p>
          <p>Отметьте важных людей звёздочкой «Избранное» — они всегда под рукой в боковой панели и быстром поиске ({{ SHORTCUTS[0].keys[0][0].join('+') }}).</p>
        </section>

        <section id="media">
          <h2>Фото, документы, источники</h2>
          <p>
            Загружайте фотографии и сканы документов в профиле человека или в разделе «Медиа». Один файл можно связать с несколькими людьми — например,
            общую фотографию или метрическую запись о браке. Большие фотографии автоматически уменьшаются.
          </p>
          <p>
            <b>Источники</b> — архивные дела, метрические книги, ревизские сказки, публикации. Ссылку на источник можно добавить к любому факту и указать
            достоверность: так будет видно, что подтверждено документом, а что записано со слов.
          </p>
        </section>

        <section id="reports">
          <h2>Росписи и проверка</h2>
          <p>
            <b>Поколенная роспись</b> перечисляет потомков родоначальника по коленам со сквозной нумерацией; <b>восходящая</b> — предков по системе
            Соса — Страдоница. Росписи печатаются и сохраняются в текстовый файл.
          </p>
          <p>
            <b>Проверка древа</b> ищет противоречия (ребёнок старше родителя, смерть раньше рождения, слишком ранний брак), возможные дубликаты и самые
            незаполненные записи.
          </p>
        </section>

        <section id="import">
          <h2>Импорт и экспорт</h2>
          <ul>
            <li>
              <b>Из другой программы</b> («Древо Жизни», MyHeritage, Ancestry, Gramps, GenoPro): выгрузите древо в формате <b>GEDCOM (.ged)</b>, затем на
              странице «Мои древа» нажмите «Импорт» и выберите файл.
            </li>
            <li><b>Резервная копия (.json)</b> содержит всё древо вместе с фотографиями. Скачивайте её время от времени: Настройки древа → Экспорт.</li>
            <li><b>Таблица (.csv)</b> — список людей с выбранными столбцами для Excel и Google Таблиц (раздел «Персоны» → «Экспорт»).</li>
          </ul>
        </section>

        <section id="pwa">
          <h2>Приложение и обновления</h2>
          <p>
            «Прапра» можно установить как приложение: в Chrome, Edge и Яндекс Браузере — значок установки в адресной строке или «Установить» в
            учётной записи; на iPhone и iPad — «Поделиться» → «На экран Домой». Установленное приложение запускается с рабочего стола и работает без
            интернета.
          </p>
          <p>
            Когда выходит новая версия, внизу экрана появляется предложение обновиться. Нажмите «Обновить» — страница перезагрузится, несохранённых
            изменений не бывает: всё записывается сразу. Проверить обновления вручную можно в разделе «Учётная запись → Приложение».
          </p>
        </section>

        <section id="data">
          <h2>Где хранятся данные</h2>
          <p>
            Сейчас данные хранятся в браузере на вашем устройстве (IndexedDB) и никуда не отправляются. Поэтому очистка данных сайта в настройках
            браузера удалит и древо — держите резервную копию. Разные браузеры и устройства хранят данные раздельно; перенести древо можно через
            резервную копию.
          </p>
          <p>Подробнее — в <router-link :to="{ name: 'privacy' }">политике конфиденциальности</router-link>.</p>
        </section>

        <section id="keys">
          <h2>Горячие клавиши</h2>
          <div class="hp__keys">
            <div v-for="g in SHORTCUTS" :key="g.title">
              <h3>{{ g.title }}</h3>
              <div v-for="k in g.keys" :key="k[1]" class="hp__key">
                <span class="hp__key-keys"><span v-for="(x, i) in k[0]" :key="i" class="ft-kbd">{{ x }}</span></span>
                <span>{{ k[1] }}</span>
              </div>
            </div>
          </div>
        </section>
      </article>
    </div>
  </div>
</template>

<style scoped lang="scss">
.hp__wrap {
  max-width: 1100px;
  margin: 0 auto;
  padding: 0 20px;
}
.hp__head {
  padding: 48px 0 32px;
  border-bottom: 1px solid var(--ft-border);
  background: var(--ft-surface-2);
  p {
    margin: 10px 0 0;
    color: var(--ft-text-2);
    font-size: 15.5px;
  }
}
.hp__title {
  margin: 8px 0 0;
  font-family: var(--ft-font-display);
  font-size: clamp(28px, 4vw, 40px);
  font-weight: 600;
  line-height: 1.15;
}
.hp__layout {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  gap: 48px;
  padding-top: 32px;
  padding-bottom: 80px;
}
.hp__toc {
  position: sticky;
  top: 84px;
  align-self: start;
  display: flex;
  flex-direction: column;
  border-left: 2px solid var(--ft-border);
  a {
    padding: 6px 14px;
    margin-left: -2px;
    border-left: 2px solid transparent;
    color: var(--ft-muted);
    font-size: 14px;
    font-weight: 550;
    &:hover {
      color: var(--ft-text);
      text-decoration: none;
    }
    &.active {
      color: var(--ft-primary-text);
      border-left-color: var(--ft-primary);
    }
  }
}
.hp__body {
  max-width: 720px;
  font-size: 15.5px;
  line-height: 1.7;
  color: var(--ft-text-2);
  section {
    scroll-margin-top: 84px;
    & + section {
      margin-top: 44px;
    }
  }
  h2 {
    margin: 0 0 12px;
    font-family: var(--ft-font-display);
    font-size: 26px;
    font-weight: 600;
    color: var(--ft-text);
  }
  h3 {
    margin: 0 0 8px;
    font-size: 14px;
    color: var(--ft-text);
  }
  b {
    color: var(--ft-text);
  }
  ul,
  ol {
    padding-left: 22px;
    li + li {
      margin-top: 6px;
    }
  }
  code {
    padding: 1px 6px;
    border-radius: 5px;
    background: var(--ft-surface-3);
    font-size: 13.5px;
  }
}
.hp__table {
  width: 100%;
  border-collapse: collapse;
  margin: 8px 0 14px;
  font-size: 14px;
  th,
  td {
    text-align: left;
    padding: 8px 10px;
    border-bottom: 1px solid var(--ft-border);
  }
  th {
    font-size: 12px;
    color: var(--ft-muted);
  }
}
.hp__keys {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 24px;
}
.hp__key {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 14px;
  padding: 3px 0;
}
.hp__key-keys {
  display: inline-flex;
  gap: 3px;
  min-width: 96px;
}
@media (max-width: 860px) {
  .hp__layout {
    grid-template-columns: 1fr;
  }
  .hp__toc {
    display: none;
  }
}
</style>
