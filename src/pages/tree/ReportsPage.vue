<script setup>
/**
 * Росписи — поколенная (потомки по коленам) и восходящая (предки по Соса — Страдоница).
 * Параметры в адресе: ?person=<id>&kind=descendants|ancestors — сюда ведёт «Построить роспись» из меню персоны.
 */
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import PageHeader from '@/components/ui/PageHeader.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import PersonSelect from '@/components/person/PersonSelect.vue'
import { useTreeStore } from '@/stores/tree'
import { useTreeNav } from '@/composables/useTreeNav'
import { ancestorReport, descendantReport, reportToText } from '@/domain/reports'
import { downloadText, fileSlug } from '@/utils/files'
import { shortName } from '@/domain/names'

const $q = useQuasar()
const route = useRoute()
const router = useRouter()
const tree = useTreeStore()
const nav = useTreeNav()

const KINDS = [
  { value: 'descendants', label: 'Поколенная роспись', hint: 'Потомки родоначальника по коленам', icon: 'sym_r_south' },
  { value: 'ancestors', label: 'Восходящая роспись', hint: 'Предки с нумерацией Соса', icon: 'sym_r_north' },
]

const kind = computed({
  get: () => (route.query.kind === 'ancestors' ? 'ancestors' : 'descendants'),
  set: (v) => router.replace({ query: { ...route.query, kind: v } }),
})
const rootId = computed({
  get: () => (tree.person(route.query.person) ? route.query.person : defaultRoot()),
  set: (v) => v && router.replace({ query: { ...route.query, person: v } }),
})

/** По умолчанию: для потомков — самый ранний предок «Это Вы» по прямой мужской линии, для предков — сама персона. */
function defaultRoot() {
  const home = tree.homeId ?? tree.focusId ?? tree.persons[0]?.id
  if (!home || kind.value === 'ancestors') return home
  let cur = home
  for (let i = 0; i < 50; i++) {
    const { father, mother } = tree.graph.parents(cur)
    const next = father ?? mother
    if (!next) break
    cur = next
  }
  return cur
}

const opts = ref({ generations: 8, maleLine: false, spouses: true, places: true, occupation: true, notes: false, hideLiving: false })

const report = computed(() => {
  if (!rootId.value) return null
  const o = { ...opts.value }
  return kind.value === 'ancestors' ? ancestorReport(tree.graph, rootId.value, o) : descendantReport(tree.graph, rootId.value, o)
})
const text = computed(() => reportToText(report.value))

// Возможная глубина — чтобы не предлагать пустые колена
const maxDepth = computed(() => {
  if (!rootId.value) return 1
  const d = kind.value === 'ancestors' ? tree.graph.ancestorDistances(rootId.value, 'blood') : tree.graph.descendantDistances(rootId.value)
  return Math.max(1, ...d.values()) + 1
})
watch(maxDepth, (m) => {
  if (opts.value.generations > m) opts.value.generations = Math.max(2, m)
})

async function copy() {
  try {
    await navigator.clipboard.writeText(text.value)
    $q.notify({ type: 'positive', message: 'Роспись скопирована в буфер обмена' })
  } catch {
    $q.notify({ type: 'negative', message: 'Не удалось скопировать — браузер запретил доступ к буферу' })
  }
}
function download() {
  const who = shortName(tree.person(rootId.value))
  downloadText(`${fileSlug(`${kind.value === 'ancestors' ? 'Восходящая' : 'Поколенная'} роспись ${who}`)}.txt`, text.value, 'text/plain;charset=utf-8')
}
const print = () => window.print()

function jump(num) {
  document.getElementById(`r-${num}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}
</script>

<template>
  <div class="ft-page rp">
    <PageHeader title="Росписи" icon="sym_r_description" subtitle="Текстовая родословная для печати, публикации или архива" class="no-print">
      <q-btn flat no-caps icon="sym_r_content_copy" label="Копировать" :disable="!report" @click="copy" />
      <q-btn flat no-caps icon="sym_r_download" label=".txt" :disable="!report" @click="download" />
      <q-btn unelevated no-caps color="primary" icon="sym_r_print" label="Печать" :disable="!report" @click="print" />
    </PageHeader>

    <div class="rp__layout">
      <aside class="rp__opts ft-card ft-card--pad no-print">
        <div class="rp__kinds">
          <button v-for="k in KINDS" :key="k.value" type="button" class="rp__kind" :class="{ active: kind === k.value }" @click="kind = k.value">
            <q-icon :name="k.icon" size="20px" />
            <span>
              <b>{{ k.label }}</b>
              <small>{{ k.hint }}</small>
            </span>
          </button>
        </div>

        <PersonSelect v-model="rootId" :label="kind === 'ancestors' ? 'Чьих предков расписать' : 'Родоначальник'" dense icon="sym_r_person" />

        <div>
          <div class="ft-label q-mb-xs">
            {{ kind === 'ancestors' ? 'Поколений' : 'Колен' }}: <b class="tabular">{{ Math.min(opts.generations, maxDepth) }}</b>
            <span class="text-muted"> из {{ maxDepth }}</span>
          </div>
          <q-slider v-model="opts.generations" :min="1" :max="Math.max(2, maxDepth)" :step="1" markers snap color="primary" />
        </div>

        <div class="rp__toggles">
          <q-toggle v-if="kind === 'descendants'" v-model="opts.maleLine" dense label="Только по мужской линии" />
          <q-toggle v-if="kind === 'descendants'" v-model="opts.spouses" dense label="Сведения о супругах" />
          <q-toggle v-model="opts.places" dense label="Места рождения и смерти" />
          <q-toggle v-model="opts.occupation" dense label="Род занятий" />
          <q-toggle v-model="opts.notes" dense label="Заметки" />
          <q-toggle v-model="opts.hideLiving" dense label="Скрыть сведения о живых" />
        </div>
        <p class="rp__hint">
          <template v-if="kind === 'ancestors'">
            Нумерация Соса — Страдоница: у персоны № n отец — № 2n, мать — № 2n + 1. Повторяющиеся предки (браки между родственниками) даются ссылкой.
          </template>
          <template v-else>
            Сквозная нумерация: у каждого потомка указан номер родителя, у детей — их номера в следующем колене. «Только по мужской линии» — классическая
            роспись рода: потомство дочерей не расписывается.
          </template>
        </p>
      </aside>

      <article v-if="report" class="rp__doc ft-card">
        <header class="rp__doc-head">
          <div class="rp__doc-kind">{{ kind === 'ancestors' ? 'Восходящая роспись' : 'Поколенная роспись' }}</div>
          <h2 class="rp__doc-title">{{ tree.tree.name }}</h2>
          <div class="rp__doc-sub">
            {{ kind === 'ancestors' ? 'Предки' : 'Потомки' }}:
            <router-link :to="nav.personRoute(report.rootId)" class="no-print-link">{{ report.generations[0]?.entries[0]?.name }}</router-link>
            · {{ report.total }} {{ report.total % 10 === 1 && report.total % 100 !== 11 ? 'персона' : 'персон' }}
          </div>
        </header>

        <section v-for="g in report.generations" :key="g.index" class="rp__gen">
          <h3 class="rp__gen-title">{{ g.label }}</h3>
          <div v-for="e in g.entries" :id="`r-${e.num}`" :key="`${g.index}-${e.num}`" class="rp__entry">
            <span class="rp__num tabular">{{ e.num }}.</span>
            <div class="rp__body">
              <div class="rp__name">
                <router-link :to="nav.personRoute(e.personId)">{{ e.name }}</router-link>
                {{ ' ' }}<span v-if="e.parentNum" class="rp__ref">
                  (от <a href="#" @click.prevent="jump(e.parentNum)">№ {{ e.parentNum }}</a>)
                </span>
                <span v-if="e.repeatOf" class="rp__ref">
                  — см. <a href="#" @click.prevent="jump(e.repeatOf)">№ {{ e.repeatOf }}</a>
                </span>
              </div>
              <div v-if="e.info" class="rp__info">{{ e.info }}</div>
              <div v-if="e.note" class="rp__note">{{ e.note }}</div>
              <template v-if="kind === 'descendants'">
                <div v-for="f in e.families" :key="f.familyId" class="rp__fam">
                  <div v-if="f.partnerName">
                    <span class="rp__fam-status">{{ f.status }}<template v-if="f.marriage"> ({{ f.marriage }})</template>:</span>{{ ' ' }}
                    <router-link v-if="f.partnerId" :to="nav.personRoute(f.partnerId)">{{ f.partnerName }}</router-link>
                    <span v-if="f.partnerInfo" class="text-muted"> — {{ f.partnerInfo }}</span>
                  </div>
                  <div v-if="f.children.length && !e.stopped" class="rp__kids">
                    Дети:{{ ' ' }}
                    <template v-for="(c, i) in f.children" :key="c.id">
                      <a v-if="c.num" href="#" @click.prevent="jump(c.num)">{{ c.name.split(' ')[1] || c.name }} (№ {{ c.num }})</a>
                      <router-link v-else :to="nav.personRoute(c.id)">{{ c.name }}</router-link>
                      <template v-if="i < f.children.length - 1">, </template>
                    </template>
                  </div>
                  <div v-else-if="f.children.length && e.stopped" class="rp__kids text-muted">
                    Дети: {{ f.children.length }} — потомство по женской линии не расписывается
                  </div>
                </div>
              </template>
            </div>
          </div>
        </section>
        <footer class="rp__doc-foot">Составлено в «Родословной» · {{ new Date().toLocaleDateString('ru-RU') }}</footer>
      </article>
      <EmptyState v-else icon="sym_r_description" title="Выберите персону" text="Роспись строится от родоначальника (для потомков) или от человека, чьих предков нужно расписать." />
    </div>
  </div>
</template>

<style scoped lang="scss">
.rp__layout {
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
  gap: 20px;
  align-items: start;
}
.rp__opts {
  position: sticky;
  top: 12px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.rp__kinds {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.rp__kind {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid var(--ft-border);
  background: var(--ft-surface);
  color: var(--ft-text);
  font: inherit;
  text-align: left;
  cursor: pointer;
  span {
    display: flex;
    flex-direction: column;
  }
  small {
    color: var(--ft-muted);
    font-size: 12px;
  }
  .q-icon {
    color: var(--ft-muted);
  }
  &.active {
    border-color: var(--ft-primary);
    background: var(--ft-primary-soft);
    .q-icon {
      color: var(--ft-primary);
    }
  }
}
.rp__toggles {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.rp__hint {
  margin: 0;
  font-size: 12.5px;
  color: var(--ft-muted);
  line-height: 1.5;
}
.rp__doc {
  padding: 48px 56px;
  font-family: var(--ft-font-display);
  font-size: 15.5px;
  line-height: 1.55;
  max-width: 880px;
}
.rp__doc-head {
  text-align: center;
  margin-bottom: 32px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--ft-border);
}
.rp__doc-kind {
  font-family: var(--ft-font);
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: 11.5px;
  font-weight: 700;
  color: var(--ft-muted);
}
.rp__doc-title {
  margin: 8px 0 6px;
  font-size: 30px;
  font-weight: 600;
  line-height: 1.2;
}
.rp__doc-sub {
  color: var(--ft-text-2);
}
.rp__gen + .rp__gen {
  margin-top: 28px;
}
.rp__gen-title {
  margin: 0 0 12px;
  font-size: 17px;
  font-weight: 650;
  text-align: center;
  font-variant: small-caps;
  letter-spacing: 0.04em;
  color: var(--ft-primary-text);
}
.rp__entry {
  display: flex;
  gap: 10px;
  padding: 6px 0;
  break-inside: avoid;
  scroll-margin-top: 80px;
  &:target,
  &:hover {
    background: none;
  }
}
.rp__num {
  flex: none;
  width: 40px;
  text-align: right;
  font-weight: 700;
  color: var(--ft-muted);
}
.rp__body {
  min-width: 0;
}
.rp__name {
  font-weight: 650;
  a {
    color: var(--ft-text);
  }
}
.rp__ref {
  font-weight: 400;
  color: var(--ft-muted);
  a {
    color: var(--ft-primary-text);
  }
}
.rp__info {
  color: var(--ft-text-2);
}
.rp__note {
  font-style: italic;
  color: var(--ft-text-2);
  white-space: pre-line;
}
.rp__fam {
  margin-top: 3px;
  a {
    color: var(--ft-primary-text);
  }
}
.rp__fam-status {
  font-style: italic;
}
.rp__kids {
  padding-left: 14px;
}
.rp__doc-foot {
  margin-top: 40px;
  padding-top: 14px;
  border-top: 1px solid var(--ft-border);
  text-align: center;
  font-family: var(--ft-font);
  font-size: 12px;
  color: var(--ft-muted);
}
@media (max-width: 1000px) {
  .rp__layout {
    grid-template-columns: 1fr;
  }
  .rp__opts {
    position: static;
  }
  .rp__doc {
    padding: 28px 20px;
  }
}
@media print {
  .rp__layout {
    display: block;
  }
  .rp__doc {
    border: 0;
    box-shadow: none;
    padding: 0;
    max-width: none;
    color: #000;
    a {
      color: #000 !important;
      text-decoration: none;
    }
  }
}
</style>
