<script setup>
import { computed } from 'vue'
import { useQuasar } from 'quasar'
import StatCard from '@/components/ui/StatCard.vue'
import GuestBanner from '@/components/ui/GuestBanner.vue'
import PersonAvatar from '@/components/person/PersonAvatar.vue'
import PersonChip from '@/components/person/PersonChip.vue'
import ChartScene from '@/components/chart/ChartScene.vue'
import { chartPalette } from '@/components/chart/palette'
import { useTreeStore } from '@/stores/tree'
import { useUiStore } from '@/stores/ui'
import { useTreeNav } from '@/composables/useTreeNav'
import { computeChart } from '@/domain/layout'
import { treeStats, upcomingAnniversaries, anniversaryText } from '@/domain/stats'
import { checkTree } from '@/domain/validation'
import { formatDate, plural } from '@/domain/dates'
import { shortName } from '@/domain/names'
import { timeAgo } from '@/utils/format'

const $q = useQuasar()
const tree = useTreeStore()
const ui = useUiStore()
const nav = useTreeNav()

const G = computed(() => tree.graph)
const stats = computed(() => treeStats(G.value))
const issues = computed(() => checkTree(G.value))
const anniversaries = computed(() => upcomingAnniversaries(G.value, 45).slice(0, 8))
const recent = computed(() => [...tree.persons].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 7))
const home = computed(() => tree.person(tree.homeId))
const pct = (n) => (stats.value.persons ? Math.round((n / stats.value.persons) * 100) : 0)
const coverage = computed(() => [
  { label: 'Известна дата рождения', value: pct(stats.value.withBirthDate) },
  { label: 'Указаны родители', value: pct(stats.value.withParents) },
  { label: 'Есть фото', value: pct(stats.value.withPhoto) },
  {
    label: 'Есть ссылки на источники',
    value: pct(tree.persons.filter((p) => p.citations.length || p.birth.citations?.length || p.events.some((e) => e.citations?.length)).length),
  },
])

// Мини-древо вокруг «Это Вы»
const preview = computed(() => {
  const id = tree.homeId ?? tree.focusId
  if (!id || !G.value) return null
  const L = computeChart(G.value, id, { view: 'tree', scope: 'direct', up: 2, down: 1, density: 'compact', placeholders: false })
  const b = L.bounds
  const pad = 20
  return { L, viewBox: `${b.minX - pad} ${b.minY - pad} ${b.maxX - b.minX + pad * 2} ${b.maxY - b.minY + pad * 2}` }
})
const previewOpts = { photos: true, years: true, relation: false, places: false, patronymic: false, colorBy: 'gender' }
const P = computed(() => chartPalette($q.dark.isActive))
const whenText = (a) => (a.inDays === 0 ? 'сегодня' : a.inDays === 1 ? 'завтра' : `через ${a.inDays} ${plural(a.inDays, 'день', 'дня', 'дней')}`)
const sevIcon = { error: 'sym_r_error', warning: 'sym_r_warning', info: 'sym_r_info' }
</script>

<template>
  <div class="ft-page ov">
    <header class="ov__head">
      <div class="min-w-0">
        <div class="ft-label">Обзор древа</div>
        <h1 class="ft-h1 ov__title">{{ tree.tree.name }}</h1>
        <div v-if="tree.tree.description" class="text-muted q-mt-xs">{{ tree.tree.description }}</div>
        <div v-if="home" class="ov__home">
          <PersonAvatar :person="home" :size="26" />
          <span>«Это Вы» — <router-link :to="nav.personRoute(home.id)">{{ shortName(home) }}</router-link>. От этой персоны считается родство.</span>
        </div>
      </div>
      <q-space />
      <div class="ov__actions">
        <q-btn outline no-caps color="primary" icon="sym_r_person_add" label="Добавить персону" :disable="tree.readonly" @click="ui.newPerson()" />
        <q-btn unelevated no-caps color="primary" icon="sym_r_account_tree" label="Открыть древо" :to="nav.to('tree-chart')" />
      </div>
    </header>

    <GuestBanner />

    <div class="ov__stats">
      <StatCard label="Персон" :value="stats.persons" icon="sym_r_groups" tone="primary" :hint="`${stats.male} муж. · ${stats.female} жен.`" :to="nav.to('tree-people')" />
      <StatCard label="Поколений" :value="stats.generations" icon="sym_r_stacks" tone="accent" :hint="stats.earliest ? `с ${tree.person(stats.earliest).birth.date.year} года` : ''" :to="nav.to('tree-chart')" />
      <StatCard label="Семей" :value="stats.families" icon="sym_r_favorite" tone="primary" :hint="stats.avgChildren ? `в среднем ${stats.avgChildren} детей` : ''" />
      <StatCard label="Фото и документы" :value="stats.media" icon="sym_r_photo_library" tone="info" :to="nav.to('tree-media')" />
      <StatCard label="Мест" :value="stats.places" icon="sym_r_location_on" tone="accent" :to="nav.to('tree-places')" />
      <StatCard label="Источников" :value="stats.sources" icon="sym_r_menu_book" tone="warning" :to="nav.to('tree-sources')" />
    </div>

    <div class="ov__grid">
      <div class="ov__col">
        <router-link v-if="preview" :to="nav.to('tree-chart')" class="ov__preview ft-card ft-card--hover">
          <div class="ov__card-head">
            <h2 class="ft-h3">Прямая линия</h2>
            <span class="text-muted" style="font-size: 12.5px">Открыть древо →</span>
          </div>
          <svg :viewBox="preview.viewBox" class="ov__svg" preserveAspectRatio="xMidYMid meet">
            <ChartScene
              :nodes="preview.L.nodes"
              :edges="preview.L.edges"
              :tree="tree.tree"
              :metrics="preview.L.metrics"
              :palette="P"
              :opts="previewOpts"
              :home-id="tree.homeId"
              lod="full"
              id-prefix="ov"
            />
          </svg>
        </router-link>

        <section class="ft-card ft-card--pad">
          <div class="ov__card-head">
            <h2 class="ft-h3">Памятные даты</h2>
            <span class="text-muted" style="font-size: 12.5px">ближайшие 45 дней</span>
          </div>
          <div v-if="anniversaries.length" class="ov__list">
            <div v-for="a in anniversaries" :key="a.key" class="ov__ann">
              <div class="ov__ann-date">
                <b>{{ a.when.getDate() }}</b>
                <span>{{ a.when.toLocaleDateString('ru-RU', { month: 'short' }).replace('.', '') }}</span>
              </div>
              <PersonAvatar :person="tree.person(a.personIds[0])" :size="34" />
              <div class="col min-w-0">
                <router-link :to="nav.personRoute(a.personIds[0])" class="fw-600 ellipsis-1 ov__link">{{ anniversaryText(G, a).title }}</router-link>
                <div class="text-muted ellipsis-1" style="font-size: 12.5px">{{ anniversaryText(G, a).text }} · {{ formatDate(a.date) }}</div>
              </div>
              <span class="ft-chip" :class="{ 'ft-chip--primary': a.inDays <= 1 }">{{ whenText(a) }}</span>
            </div>
          </div>
          <div v-else class="text-muted">В ближайшие недели памятных дат нет. Они появятся, когда будут известны дни рождения, свадеб и смерти.</div>
        </section>
      </div>

      <div class="ov__col">
        <section class="ft-card ft-card--pad">
          <div class="ov__card-head"><h2 class="ft-h3">Полнота сведений</h2></div>
          <div v-for="c in coverage" :key="c.label" class="ov__bar">
            <div class="ov__bar-top">
              <span>{{ c.label }}</span>
              <b class="tabular">{{ c.value }}%</b>
            </div>
            <q-linear-progress :value="c.value / 100" rounded size="7px" :color="c.value > 70 ? 'positive' : c.value > 35 ? 'warning' : 'negative'" track-color="grey-3" />
          </div>
        </section>

        <section class="ft-card ft-card--pad">
          <div class="ov__card-head">
            <h2 class="ft-h3">Что проверить</h2>
            <router-link :to="nav.to('tree-check')" class="ov__more">Все ({{ issues.length }})</router-link>
          </div>
          <div v-if="issues.length" class="ov__list">
            <router-link v-for="i in issues.slice(0, 5)" :key="i.id" :to="nav.personRoute(i.personIds[0])" class="ov__issue" :class="`ov__issue--${i.severity}`">
              <q-icon :name="sevIcon[i.severity]" size="18px" />
              <div class="min-w-0">
                <div class="fw-600">{{ i.title }}</div>
                <div class="text-muted ellipsis-1" style="font-size: 12.5px">{{ i.text }}</div>
              </div>
            </router-link>
          </div>
          <div v-else class="text-muted">Противоречий в датах не найдено.</div>
        </section>

        <section class="ft-card ft-card--pad">
          <div class="ov__card-head"><h2 class="ft-h3">Недавно изменены</h2></div>
          <div class="ov__list">
            <PersonChip v-for="p in recent" :key="p.id" :person-id="p.id" :caption="timeAgo(p.updatedAt)" :size="32" />
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.ov__head {
  display: flex;
  align-items: flex-end;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 20px;
}
.ov__title {
  font-family: var(--ft-font-display);
  font-weight: 650;
  font-size: 30px;
  margin-top: 4px;
}
.ov__home {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
  font-size: 13.5px;
  color: var(--ft-text-2);
}
.ov__actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.ov__stats {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}
.ov__grid {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}
.ov__col {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.ov__card-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 12px;
}
.ov__preview {
  display: block;
  padding: 18px 20px 12px;
  color: var(--ft-text);
  text-decoration: none !important;
  background:
    radial-gradient(var(--ft-dot) 1px, transparent 1.2px) 0 0 / 20px 20px,
    var(--ft-canvas);
}
.ov__svg {
  width: 100%;
  height: 300px;
  display: block;
}
.ov__list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.ov__ann {
  display: flex;
  align-items: center;
  gap: 12px;
}
.ov__ann-date {
  width: 44px;
  flex: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  line-height: 1.1;
  padding: 5px 0;
  border-radius: 10px;
  background: var(--ft-surface-3);
  b {
    font-size: 17px;
  }
  span {
    font-size: 11px;
    color: var(--ft-muted);
    text-transform: uppercase;
  }
}
.ov__link {
  color: var(--ft-text);
  display: block;
}
.ov__bar + .ov__bar {
  margin-top: 12px;
}
.ov__bar-top {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  margin-bottom: 5px;
}
.ov__more {
  font-size: 13px;
  font-weight: 600;
}
.ov__issue {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 10px;
  color: var(--ft-text);
  text-decoration: none !important;
  background: var(--ft-surface-2);
  &:hover {
    background: var(--ft-surface-3);
  }
}
.ov__issue--error .q-icon {
  color: var(--ft-negative);
}
.ov__issue--warning .q-icon {
  color: var(--ft-warning);
}
.ov__issue--info .q-icon {
  color: var(--ft-info);
}
@media (max-width: 1000px) {
  .ov__grid {
    grid-template-columns: 1fr;
  }
}
</style>
