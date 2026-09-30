<script setup>
/**
 * Проверка древа: противоречия в датах, возможные дубликаты (с объединением), незаполненные записи.
 * Отклонённые пары дубликатов запоминаются в браузере (это удобство конкретного пользователя, а не данные древа).
 */
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageHeader from '@/components/ui/PageHeader.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import PersonAvatar from '@/components/person/PersonAvatar.vue'
import PersonChip from '@/components/person/PersonChip.vue'
import { useTreeStore } from '@/stores/tree'
import { useUiStore } from '@/stores/ui'
import { useTreeNav } from '@/composables/useTreeNav'
import { checkTree, findDuplicates } from '@/domain/validation'
import { completeness, lifeSpan } from '@/domain/person'
import { fullName } from '@/domain/names'
import { placeName } from '@/domain/places'

const route = useRoute()
const router = useRouter()
const tree = useTreeStore()
const ui = useUiStore()
const nav = useTreeNav()

const TABS = ['issues', 'duplicates', 'gaps']
const tab = computed({
  get: () => (TABS.includes(route.query.tab) ? route.query.tab : 'issues'),
  set: (v) => router.replace({ query: { ...route.query, tab: v } }),
})

// ------------------------------------------------------------------ противоречия
const SEVERITY = {
  error: { label: 'Ошибки', icon: 'sym_r_error', hint: 'Даты противоречат друг другу' },
  warning: { label: 'Предупреждения', icon: 'sym_r_warning', hint: 'Возможно, опечатка в дате' },
  info: { label: 'Замечания', icon: 'sym_r_info', hint: 'Стоит обратить внимание' },
}
const severities = ref(['error', 'warning', 'info'])
const issues = computed(() => checkTree(tree.graph))
const shownIssues = computed(() => issues.value.filter((i) => severities.value.includes(i.severity)))
const bySeverity = computed(() => Object.fromEntries(Object.keys(SEVERITY).map((k) => [k, issues.value.filter((i) => i.severity === k).length])))
const toggleSeverity = (k) => (severities.value = severities.value.includes(k) ? severities.value.filter((x) => x !== k) : [...severities.value, k])

// ------------------------------------------------------------------ дубликаты
const ignoreKey = computed(() => `rd:dup-ignore:${tree.treeId}`)
const ignored = ref(new Set())
watch(
  ignoreKey,
  (k) => {
    try {
      ignored.value = new Set(JSON.parse(localStorage.getItem(k) ?? '[]'))
    } catch {
      ignored.value = new Set()
    }
  },
  { immediate: true },
)
const pairKey = (d) => [d.a, d.b].sort().join('|')
function ignore(d) {
  ignored.value = new Set([...ignored.value, pairKey(d)])
  try {
    localStorage.setItem(ignoreKey.value, JSON.stringify([...ignored.value]))
  } catch {
    // Хранилище недоступно — отметка просто не переживёт перезагрузку
  }
}
function resetIgnored() {
  ignored.value = new Set()
  try {
    localStorage.removeItem(ignoreKey.value)
  } catch {
    // ничего страшного
  }
}
const allDuplicates = computed(() => findDuplicates(tree.graph).filter((d) => tree.person(d.a) && tree.person(d.b)))
const duplicates = computed(() => allDuplicates.value.filter((d) => !ignored.value.has(pairKey(d))))

function dupInfo(id) {
  const p = tree.person(id)
  const { father, mother } = tree.graph.parents(id)
  return {
    p,
    name: fullName(p),
    life: lifeSpan(p),
    place: placeName(tree.tree, p.birth.placeId),
    parents: [father, mother].filter(Boolean),
  }
}

// ------------------------------------------------------------------ незаполненное
const gapsLimit = ref(40)
const gaps = computed(() =>
  tree.persons
    .map((p) => ({ p, ...completeness(tree.graph, p) }))
    .filter((x) => x.score < 100)
    .sort((a, b) => a.score - b.score || b.p.updatedAt - a.p.updatedAt),
)
const scoreTone = (s) => (s >= 75 ? 'positive' : s >= 45 ? 'warning' : 'negative')
</script>

<template>
  <div class="ft-page ck">
    <PageHeader title="Проверка древа" icon="sym_r_fact_check" subtitle="Ошибки в датах, повторяющиеся записи и пробелы в сведениях" />

    <q-tabs v-model="tab" align="left" no-caps active-color="primary" indicator-color="primary" class="ck__tabs" inline-label>
      <q-tab name="issues" icon="sym_r_rule" label="Противоречия">
        <q-badge v-if="bySeverity.error" color="negative" rounded class="q-ml-xs">{{ bySeverity.error }}</q-badge>
      </q-tab>
      <q-tab name="duplicates" icon="sym_r_group" label="Возможные дубликаты">
        <q-badge v-if="duplicates.length" color="warning" rounded class="q-ml-xs">{{ duplicates.length }}</q-badge>
      </q-tab>
      <q-tab name="gaps" icon="sym_r_checklist" label="Незаполненные записи" />
    </q-tabs>

    <!-- Противоречия -->
    <template v-if="tab === 'issues'">
      <div class="ck__sev">
        <button v-for="(v, k) in SEVERITY" :key="k" type="button" class="ck__sev-btn" :class="[`ck__sev-btn--${k}`, { active: severities.includes(k) }]" @click="toggleSeverity(k)">
          <q-icon :name="v.icon" size="18px" />
          <span>
            <b>{{ v.label }}: {{ bySeverity[k] }}</b>
            <small>{{ v.hint }}</small>
          </span>
        </button>
      </div>
      <div v-if="shownIssues.length" class="ck__list">
        <article v-for="i in shownIssues" :key="i.id" class="ck__issue ft-card" :class="`ck__issue--${i.severity}`">
          <q-icon :name="SEVERITY[i.severity].icon" size="20px" class="ck__issue-icon" />
          <div class="col min-w-0">
            <div class="fw-600">{{ i.title }}</div>
            <div class="text-muted ck__issue-text">{{ i.text }}</div>
            <div class="ck__issue-people">
              <PersonChip v-for="id in i.personIds" :key="id" :person-id="id" :size="26" />
            </div>
          </div>
          <div class="ck__issue-actions">
            <q-btn flat dense no-caps size="sm" icon="sym_r_edit" label="Исправить" :disable="tree.readonly" @click="ui.editPerson(i.personIds[0])" />
            <q-btn v-if="i.familyId" flat dense no-caps size="sm" icon="sym_r_family_restroom" label="Семья" :disable="tree.readonly" @click="ui.editFamily(i.familyId)" />
            <q-btn flat dense no-caps size="sm" icon="sym_r_account_tree" label="В древе" @click="nav.showInChart(i.personIds[0])" />
          </div>
        </article>
      </div>
      <EmptyState v-else icon="sym_r_task_alt" title="Всё в порядке" text="Противоречий в датах и связях не найдено." />
    </template>

    <!-- Дубликаты -->
    <template v-else-if="tab === 'duplicates'">
      <p class="ck__intro">
        Совпадают имя и фамилия (с учётом мужской и женской формы), отчество и годы рождения не противоречат друг другу. При объединении связи, события,
        фото и источники переносятся в одну запись.
        <a v-if="ignored.size" href="#" @click.prevent="resetIgnored">Вернуть скрытые пары ({{ ignored.size }})</a>
      </p>
      <div v-if="duplicates.length" class="ck__list">
        <article v-for="d in duplicates" :key="pairKey(d)" class="ck__dup ft-card">
          <div class="ck__dup-score">
            <b class="tabular">{{ d.score }}%</b>
            <span>{{ d.reasons.join(', ') }}</span>
          </div>
          <div class="ck__dup-pair">
            <router-link v-for="x in [dupInfo(d.a), dupInfo(d.b)]" :key="x.p.id" :to="nav.personRoute(x.p.id)" class="ck__dup-person">
              <PersonAvatar :person="x.p" :size="44" />
              <span class="min-w-0">
                <span class="fw-600 ellipsis-1">{{ x.name }}</span>
                <span class="text-muted">{{ [x.life, x.place].filter(Boolean).join(' · ') || 'даты неизвестны' }}</span>
                <span class="text-muted ellipsis-1">
                  Родители: {{ x.parents.length ? x.parents.map((id) => fullName(tree.person(id), { middle: false })).join(', ') : 'не указаны' }}
                </span>
              </span>
            </router-link>
          </div>
          <div class="ck__dup-actions">
            <q-btn unelevated no-caps color="primary" icon="sym_r_merge" label="Сравнить и объединить" :disable="tree.readonly" @click="ui.merge(d.a, d.b)" />
            <q-btn flat no-caps label="Это разные люди" @click="ignore(d)" />
          </div>
        </article>
      </div>
      <EmptyState v-else icon="sym_r_group" title="Дубликатов не найдено" text="Если вы знаете, что два человека — одна персона, объедините их из меню персоны." />
    </template>

    <!-- Незаполненные -->
    <template v-else>
      <p class="ck__intro">Записи, в которых меньше всего сведений. Начните с самых пустых — часто хватает одного звонка родственникам.</p>
      <div v-if="gaps.length" class="ck__gaps ft-card">
        <div v-for="g in gaps.slice(0, gapsLimit)" :key="g.p.id" class="ck__gap">
          <PersonChip :person-id="g.p.id" :size="32" class="ck__gap-person" />
          <div class="ck__gap-missing">
            <span v-for="m in g.missing" :key="m" class="ft-chip">{{ m }}</span>
          </div>
          <div class="ck__gap-score">
            <q-linear-progress :value="g.score / 100" rounded size="6px" :color="scoreTone(g.score)" track-color="grey-3" />
            <span class="tabular">{{ g.score }}%</span>
          </div>
          <q-btn flat round dense icon="sym_r_edit" :disable="tree.readonly" aria-label="Заполнить" @click="ui.editPerson(g.p.id)">
            <q-tooltip>Заполнить</q-tooltip>
          </q-btn>
        </div>
        <div v-if="gaps.length > gapsLimit" class="text-center q-pa-sm">
          <q-btn flat no-caps color="primary" :label="`Показать ещё (${gaps.length - gapsLimit})`" @click="gapsLimit += 40" />
        </div>
      </div>
      <EmptyState v-else icon="sym_r_verified" title="Все записи заполнены" text="У каждой персоны есть основные сведения." />
    </template>
  </div>
</template>

<style scoped lang="scss">
.ck__tabs {
  margin-bottom: 18px;
  border-bottom: 1px solid var(--ft-border);
}
.ck__intro {
  color: var(--ft-text-2);
  max-width: 760px;
  margin: 0 0 16px;
  font-size: 13.5px;
  line-height: 1.55;
}
.ck__sev {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}
.ck__sev-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  border-radius: 12px;
  border: 1px solid var(--ft-border);
  background: var(--ft-surface);
  color: var(--ft-muted);
  font: inherit;
  text-align: left;
  cursor: pointer;
  opacity: 0.65;
  span {
    display: flex;
    flex-direction: column;
  }
  b {
    color: var(--ft-text);
    font-size: 13.5px;
  }
  small {
    font-size: 12px;
  }
  &.active {
    opacity: 1;
    border-color: var(--ft-border-strong);
    box-shadow: var(--ft-shadow-xs);
  }
}
.ck__sev-btn--error .q-icon,
.ck__issue--error .ck__issue-icon {
  color: var(--ft-negative);
}
.ck__sev-btn--warning .q-icon,
.ck__issue--warning .ck__issue-icon {
  color: var(--ft-warning);
}
.ck__sev-btn--info .q-icon,
.ck__issue--info .ck__issue-icon {
  color: var(--ft-info);
}
.ck__list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.ck__issue {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 14px;
  flex-wrap: wrap;
}
.ck__issue-icon {
  margin-top: 1px;
}
.ck__issue-text {
  font-size: 13px;
  margin-top: 2px;
}
.ck__issue-people {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 18px;
  margin-top: 8px;
}
.ck__issue-actions {
  display: flex;
  gap: 2px;
  flex-wrap: wrap;
}
.ck__dup {
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.ck__dup-score {
  display: flex;
  align-items: baseline;
  gap: 10px;
  font-size: 13px;
  color: var(--ft-muted);
  b {
    font-size: 16px;
    color: var(--ft-warning);
  }
}
.ck__dup-pair {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.ck__dup-person {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 12px;
  background: var(--ft-surface-2);
  border: 1px solid var(--ft-border);
  color: var(--ft-text);
  text-decoration: none !important;
  font-size: 13px;
  > span {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .fw-600 {
    font-size: 14px;
  }
  &:hover {
    border-color: var(--ft-border-strong);
  }
}
.ck__dup-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.ck__gaps {
  padding: 4px 0;
}
.ck__gap {
  display: grid;
  grid-template-columns: minmax(200px, 280px) 1fr 140px 36px;
  align-items: center;
  gap: 14px;
  padding: 8px 14px;
  & + & {
    border-top: 1px solid var(--ft-border);
  }
}
.ck__gap-missing {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.ck__gap-score {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12.5px;
  color: var(--ft-muted);
  .q-linear-progress {
    flex: 1;
  }
  span {
    width: 34px;
    text-align: right;
  }
}
@media (max-width: 800px) {
  .ck__dup-pair {
    grid-template-columns: 1fr;
  }
  .ck__gap {
    grid-template-columns: 1fr 36px;
  }
  .ck__gap-missing,
  .ck__gap-score {
    grid-column: 1 / 2;
  }
}
</style>
