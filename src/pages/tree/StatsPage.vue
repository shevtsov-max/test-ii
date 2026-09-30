<script setup>
/** Статистика древа: поколения, рождения по десятилетиям, продолжительность жизни, частые фамилии и имена. */
import { computed, ref } from 'vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import StatCard from '@/components/ui/StatCard.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import PersonChip from '@/components/person/PersonChip.vue'
import ColumnChart from '@/components/stats/ColumnChart.vue'
import BarList from '@/components/stats/BarList.vue'
import { useTreeStore } from '@/stores/tree'
import { useUiStore } from '@/stores/ui'
import { useTreeNav } from '@/composables/useTreeNav'
import { treeStats } from '@/domain/stats'
import { roman } from '@/domain/reports'
import { shortName } from '@/domain/names'
import { pluralYears } from '@/domain/dates'
import { count } from '@/utils/format'

const tree = useTreeStore()
const ui = useUiStore()
const nav = useTreeNav()

const s = computed(() => treeStats(tree.graph))
const pct = (n) => (s.value.persons ? Math.round((n / s.value.persons) * 100) : 0)
const tables = ref({ decades: false, life: false })

// Ось времени без пропусков: десятилетия без рождений — нулевые колонки
const decades = computed(() => {
  const list = s.value.byDecade
  if (!list.length) return []
  const have = new Map(list.map((d) => [d.label, d.value]))
  const out = []
  for (let y = list[0].label; y <= list.at(-1).label; y += 10) out.push({ label: y, value: have.get(y) ?? 0 })
  return out
})
const life = computed(() => s.value.lifespanByCentury.map((d) => ({ label: d.label, value: d.value, hint: count(d.n, 'человек', 'человека', 'человек') })))
const centuryLabel = (c) => `${roman(c)} в.`

const genderParts = computed(() =>
  [
    { key: 'M', label: 'Мужчины', value: s.value.male },
    { key: 'F', label: 'Женщины', value: s.value.female },
    { key: 'U', label: 'Пол не указан', value: s.value.unknownGender },
  ].filter((x) => x.value),
)
const lifeParts = computed(() =>
  [
    { key: 'living', label: 'Живые', value: s.value.living },
    { key: 'deceased', label: 'Умершие', value: s.value.deceased },
  ].filter((x) => x.value),
)

const search = (q) => nav.go('tree-people', { query: { q } })
const earliest = computed(() => tree.person(s.value.earliest))
const oldest = computed(() => (s.value.oldest ? { p: tree.person(s.value.oldest.id), years: s.value.oldest.years } : null))
const yrs = (n) => `${n} ${pluralYears(n)}`
const familyTitle = (f) => f.partners.map((id) => shortName(tree.person(id))).join(' и ') || 'Родители неизвестны'
</script>

<template>
  <div class="ft-page st">
    <PageHeader title="Статистика" icon="sym_r_monitoring" :subtitle="`${tree.tree.name}: цифры и закономерности`" />

    <EmptyState v-if="s.persons < 2" icon="sym_r_monitoring" title="Пока мало данных" text="Добавьте родственников — здесь появятся поколения, частые фамилии и продолжительность жизни." />

    <template v-else>
      <div class="st__kpi">
        <StatCard label="Персон" :value="s.persons" icon="sym_r_groups" tone="primary" :to="nav.to('tree-people')" />
        <StatCard label="Поколений" :value="s.generations" icon="sym_r_stacks" tone="accent" :hint="earliest ? `с ${earliest.birth.date.year} года` : ''" />
        <StatCard label="Семей" :value="s.families" icon="sym_r_favorite" tone="primary" :hint="s.avgChildren ? `в среднем ${s.avgChildren} детей в семье` : ''" />
        <StatCard
          label="Средняя продолжительность жизни"
          :value="s.avgLifespan ? yrs(s.avgLifespan) : '—'"
          icon="sym_r_hourglass"
          tone="info"
          hint="по умершим с известными датами"
        />
      </div>

      <div class="st__grid">
        <section class="ft-card ft-card--pad st__wide">
          <header class="st__head">
            <div>
              <h2 class="ft-h3">Рождения по десятилетиям</h2>
              <div class="st__sub">Сколько персон древа родилось в каждом десятилетии</div>
            </div>
            <q-btn flat dense no-caps size="sm" :icon="tables.decades ? 'sym_r_bar_chart' : 'sym_r_table'" :label="tables.decades ? 'График' : 'Таблица'" @click="tables.decades = !tables.decades" />
          </header>
          <ColumnChart
            v-if="decades.length"
            :data="decades"
            :table="tables.decades"
            label-header="Десятилетие"
            value-header="Родилось"
            :format-label="(l) => `${l}-е`"
          />
          <div v-else class="text-muted">Нет ни одной известной даты рождения.</div>
        </section>

        <section class="ft-card ft-card--pad">
          <header class="st__head"><h2 class="ft-h3">Состав</h2></header>
          <div class="st__split-title">Пол</div>
          <div class="st__split" role="img" :aria-label="genderParts.map((g) => `${g.label}: ${g.value}`).join(', ')">
            <span v-for="g in genderParts" :key="g.key" :class="`st__seg st__seg--${g.key}`" :style="{ flexGrow: g.value }" :title="`${g.label}: ${g.value}`" />
          </div>
          <ul class="st__legend">
            <li v-for="g in genderParts" :key="g.key">
              <span :class="`st__key st__seg--${g.key}`" />{{ g.label }} <b class="tabular">{{ g.value }}</b>
              <span class="text-muted">{{ pct(g.value) }}%</span>
            </li>
          </ul>
          <div class="st__split-title q-mt-md">Живые и умершие</div>
          <div class="st__split" role="img" :aria-label="lifeParts.map((g) => `${g.label}: ${g.value}`).join(', ')">
            <span v-for="g in lifeParts" :key="g.key" :class="`st__seg st__seg--${g.key}`" :style="{ flexGrow: g.value }" :title="`${g.label}: ${g.value}`" />
          </div>
          <ul class="st__legend">
            <li v-for="g in lifeParts" :key="g.key">
              <span :class="`st__key st__seg--${g.key}`" />{{ g.label }} <b class="tabular">{{ g.value }}</b>
              <span class="text-muted">{{ pct(g.value) }}%</span>
            </li>
          </ul>

          <div class="st__records">
            <div v-if="earliest" class="st__record">
              <div class="ft-label">Самый ранний год рождения</div>
              <PersonChip :person-id="earliest.id" :size="32" />
            </div>
            <div v-if="oldest" class="st__record">
              <div class="ft-label">Долгожитель</div>
              <PersonChip :person-id="oldest.p.id" :size="32" :caption="`прожил(а) ${yrs(oldest.years)}`" />
            </div>
          </div>
        </section>

        <section class="ft-card ft-card--pad">
          <header class="st__head">
            <div>
              <h2 class="ft-h3">Продолжительность жизни</h2>
              <div class="st__sub">Средний возраст смерти по веку рождения, лет</div>
            </div>
            <q-btn v-if="life.length" flat dense no-caps size="sm" :icon="tables.life ? 'sym_r_bar_chart' : 'sym_r_table'" :label="tables.life ? 'График' : 'Таблица'" @click="tables.life = !tables.life" />
          </header>
          <ColumnChart
            v-if="life.length"
            :data="life"
            :table="tables.life"
            cap-labels
            :height="200"
            label-header="Век рождения"
            value-header="Средний возраст"
            :format-label="centuryLabel"
          />
          <div v-else class="text-muted">Нужны умершие персоны с известными датами рождения и смерти.</div>
        </section>

        <section class="ft-card ft-card--pad">
          <header class="st__head">
            <div>
              <h2 class="ft-h3">Частые фамилии</h2>
              <div class="st__sub">По фамилии при рождении, мужская и женская форма вместе</div>
            </div>
          </header>
          <BarList v-if="s.surnames.length" :items="s.surnames" clickable @pick="(i) => search(i.label)" />
          <div v-else class="text-muted">Фамилии не указаны.</div>
        </section>

        <section class="ft-card ft-card--pad">
          <header class="st__head"><h2 class="ft-h3">Места рождения</h2></header>
          <BarList v-if="s.birthPlaces.length" :items="s.birthPlaces" clickable @pick="(i) => search(i.label)" />
          <div v-else class="text-muted">Места рождения не указаны.</div>
        </section>

        <section class="ft-card ft-card--pad">
          <header class="st__head"><h2 class="ft-h3">Мужские имена</h2></header>
          <BarList v-if="s.maleNames.length" :items="s.maleNames" clickable class="st--male" @pick="(i) => search(i.label)" />
          <div v-else class="text-muted">Нет данных.</div>
        </section>

        <section class="ft-card ft-card--pad">
          <header class="st__head"><h2 class="ft-h3">Женские имена</h2></header>
          <BarList v-if="s.femaleNames.length" :items="s.femaleNames" clickable class="st--female" @pick="(i) => search(i.label)" />
          <div v-else class="text-muted">Нет данных.</div>
        </section>

        <section v-if="s.largestFamilies.length" class="ft-card ft-card--pad st__wide">
          <header class="st__head"><h2 class="ft-h3">Самые многодетные семьи</h2></header>
          <div class="st__families">
            <button v-for="f in s.largestFamilies" :key="f.familyId" type="button" class="st__family" @click="ui.editFamily(f.familyId)">
              <span class="st__family-n tabular">{{ f.children }}</span>
              <span class="min-w-0">
                <span class="fw-600 ellipsis-1">{{ familyTitle(f) }}</span>
                <span class="text-muted" style="font-size: 12.5px">{{ count(f.children, 'ребёнок', 'ребёнка', 'детей') }}</span>
              </span>
            </button>
          </div>
        </section>
      </div>
    </template>
  </div>
</template>

<style scoped lang="scss">
.st {
  --viz-series: #d24e26;
  --viz-male: #2f74c0;
  --viz-female: #cc4a78;
  --viz-neutral: #b5b0a6;
}
.st:is(.body--dark *) {
  --viz-series: #e0602f;
  --viz-male: #4a8ad8;
  --viz-female: #dc5f8b;
  --viz-neutral: #4d5561;
}
.st__kpi {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}
.st__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  align-items: start;
}
.st__wide {
  grid-column: 1 / -1;
}
.st__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 14px;
}
.st__sub {
  font-size: 12.5px;
  color: var(--ft-muted);
  margin-top: 2px;
}
.st__split-title {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--ft-text-2);
  margin-bottom: 6px;
}
.st__split {
  display: flex;
  gap: 2px;
  height: 14px;
}
.st__seg {
  display: block;
  min-width: 4px;
  &:first-child {
    border-radius: 4px 0 0 4px;
  }
  &:last-child {
    border-radius: 0 4px 4px 0;
  }
  &:only-child {
    border-radius: 4px;
  }
}
.st__seg--M {
  background: var(--viz-male);
}
.st__seg--F {
  background: var(--viz-female);
}
.st__seg--U,
.st__seg--deceased {
  background: var(--viz-neutral);
}
.st__seg--living {
  background: var(--viz-series);
}
.st__legend {
  list-style: none;
  margin: 8px 0 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  font-size: 13px;
  li {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
}
.st__key {
  width: 10px;
  height: 10px;
  border-radius: 3px;
  display: inline-block;
}
.st__records {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 18px;
  padding-top: 14px;
  border-top: 1px solid var(--ft-border);
}
.st__record .ft-label {
  margin-bottom: 6px;
}
.st--male {
  --viz-series: var(--viz-male);
}
.st--female {
  --viz-series: var(--viz-female);
}
.st__families {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 8px;
}
.st__family {
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
  > span:last-child {
    display: flex;
    flex-direction: column;
  }
  &:hover {
    border-color: var(--ft-border-strong);
    background: var(--ft-surface-2);
  }
}
.st__family-n {
  width: 38px;
  height: 38px;
  flex: none;
  display: grid;
  place-items: center;
  border-radius: 10px;
  background: var(--ft-primary-soft);
  color: var(--ft-primary-text);
  font-weight: 750;
  font-size: 17px;
}
@media (max-width: 900px) {
  .st__grid {
    grid-template-columns: 1fr;
  }
}
</style>
