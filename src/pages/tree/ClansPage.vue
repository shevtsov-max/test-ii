<script setup>
/** Роды — ветви фамилий. Назначаются персонам; древо можно раскрасить по родам. */
import { computed } from 'vue'
import { useQuasar } from 'quasar'
import PageHeader from '@/components/ui/PageHeader.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import PersonAvatar from '@/components/person/PersonAvatar.vue'
import { useTreeStore } from '@/stores/tree'
import { usePrefsStore } from '@/stores/prefs'
import { useTreeNav } from '@/composables/useTreeNav'
import { CLAN_COLORS, newClan } from '@/domain/model'
import { surnameFor } from '@/domain/names'

const $q = useQuasar()
const tree = useTreeStore()
const prefs = usePrefsStore()
const nav = useTreeNav()

const clans = computed(() =>
  Object.values(tree.tree.clans)
    .map((c) => {
      const members = tree.persons.filter((p) => p.clanId === c.id)
      const years = members.map((p) => p.birth.date.year).filter(Boolean)
      return { ...c, members, from: years.length ? Math.min(...years) : null, to: years.length ? Math.max(...years) : null }
    })
    .sort((a, b) => b.members.length - a.members.length),
)
const noClan = computed(() => tree.persons.filter((p) => !p.clanId).length)

// Предложение: роды по самым частым фамилиям
const suggestions = computed(() => {
  const counts = new Map()
  const existing = new Set(Object.values(tree.tree.clans).map((c) => c.name.toLowerCase()))
  for (const p of tree.persons) {
    const s = surnameFor(p.birthName || p.lastName, 'M')
    if (s) counts.set(s, (counts.get(s) ?? 0) + 1)
  }
  return [...counts.entries()]
    .filter(([s, n]) => n >= 3 && !existing.has(clanName(s).toLowerCase()))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
})
function clanName(surname) {
  return /(ов|ев|ин|ын)$/.test(surname) ? surname + 'ы' : /ий$/.test(surname) ? surname.slice(0, -2) + 'ие' : surname
}
function createFromSurname(surname) {
  const c = newClan({ name: clanName(surname), color: CLAN_COLORS[Object.keys(tree.tree.clans).length % CLAN_COLORS.length] })
  tree.commit('Новый род', (d) => {
    d.clans[c.id] = c
    for (const p of Object.values(d.persons)) if (!p.clanId && surnameFor(p.birthName || p.lastName, 'M') === surname) p.clanId = c.id
  })
  $q.notify({ type: 'positive', message: `Род «${c.name}» создан` })
}
function add() {
  $q.dialog({
    title: 'Новый род',
    prompt: { model: '', type: 'text', outlined: true, label: 'Название, например «Шевцовы»', isValid: (v) => !!v.trim() },
    cancel: { flat: true, label: 'Отмена', noCaps: true },
    ok: { unelevated: true, label: 'Создать', color: 'primary', noCaps: true },
  }).onOk((name) => tree.saveClan(newClan({ name: name.trim(), color: CLAN_COLORS[Object.keys(tree.tree.clans).length % CLAN_COLORS.length] })))
}
function rename(c) {
  $q.dialog({
    title: 'Род',
    prompt: { model: c.name, type: 'text', outlined: true, isValid: (v) => !!v.trim() },
    cancel: { flat: true, label: 'Отмена', noCaps: true },
    ok: { unelevated: true, label: 'Сохранить', color: 'primary', noCaps: true },
  }).onOk((name) => tree.saveClan({ id: c.id, name: name.trim(), color: c.color, description: c.description }))
}
const setColor = (c, color) => tree.saveClan({ id: c.id, name: c.name, color, description: c.description })
function remove(c) {
  $q.dialog({
    title: `Удалить род «${c.name}»?`,
    message: 'Персоны останутся в древе, у них просто не будет рода.',
    cancel: { flat: true, label: 'Отмена', noCaps: true },
    ok: { unelevated: true, label: 'Удалить', color: 'negative', noCaps: true },
  }).onOk(() => tree.removeClan(c.id))
}
function showInTree() {
  prefs.chart.colorBy = 'clan'
  nav.go('tree-chart')
}
</script>

<template>
  <div class="ft-page clp">
    <PageHeader title="Роды" icon="sym_r_diversity_1" subtitle="Ветви фамилий: удобно фильтровать таблицу и раскрашивать древо">
      <q-btn outline no-caps color="primary" icon="sym_r_palette" label="Раскрасить древо по родам" @click="showInTree" />
      <q-btn v-if="!tree.readonly" unelevated no-caps color="primary" icon="sym_r_add" label="Новый род" @click="add" />
    </PageHeader>

    <div v-if="suggestions.length && !tree.readonly" class="clp__suggest ft-card">
      <q-icon name="sym_r_lightbulb" size="20px" class="text-warning" />
      <span>Создать роды по частым фамилиям:</span>
      <q-btn v-for="[s, n] in suggestions" :key="s" outline no-caps dense color="primary" :label="`${clanName(s)} · ${n}`" @click="createFromSurname(s)" />
    </div>

    <div v-if="clans.length" class="clp__grid">
      <article v-for="c in clans" :key="c.id" class="clp__card ft-card">
        <div class="clp__stripe" :style="{ background: c.color }" />
        <div class="clp__body">
          <div class="clp__head">
            <h2 class="ft-h3 col">{{ c.name }}</h2>
            <q-btn v-if="!tree.readonly" flat round dense size="sm" icon="sym_r_more_vert" class="text-muted">
              <q-menu>
                <div class="clp__colors">
                  <button v-for="col in CLAN_COLORS" :key="col" type="button" :style="{ background: col }" :class="{ active: col === c.color }" @click="setColor(c, col)" />
                </div>
                <q-list dense>
                  <q-item v-close-popup clickable @click="rename(c)"><q-item-section>Переименовать</q-item-section></q-item>
                  <q-item v-close-popup clickable class="text-negative" @click="remove(c)"><q-item-section>Удалить род</q-item-section></q-item>
                </q-list>
              </q-menu>
            </q-btn>
          </div>
          <div class="text-muted" style="font-size: 13px">
            {{ c.members.length }} чел.<template v-if="c.from"> · {{ c.from === c.to ? c.from : `${c.from}–${c.to}` }}</template>
          </div>
          <div class="clp__members">
            <router-link v-for="p in c.members.slice(0, 10)" :key="p.id" :to="nav.personRoute(p.id)" class="clp__av">
              <PersonAvatar :person="p" :size="32" />
            </router-link>
            <span v-if="c.members.length > 10" class="clp__more">+{{ c.members.length - 10 }}</span>
          </div>
          <router-link :to="nav.to('tree-people', { query: { clan: c.id } })" class="clp__link">Все представители →</router-link>
        </div>
      </article>
    </div>
    <EmptyState v-else icon="sym_r_diversity_1" title="Родов пока нет" text="Род объединяет людей одной фамилии или ветви: Шевцовы, Ивашевы… Его можно указать в карточке персоны." />
    <div v-if="noClan && clans.length" class="text-muted q-mt-md">Без рода: {{ noClan }} чел.</div>
  </div>
</template>

<style scoped lang="scss">
.clp__suggest {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding: 12px 14px;
  margin-bottom: 16px;
}
.clp__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(290px, 1fr));
  gap: 14px;
}
.clp__card {
  overflow: hidden;
  display: flex;
}
.clp__stripe {
  width: 6px;
  flex: none;
}
.clp__body {
  flex: 1;
  padding: 14px 16px;
  min-width: 0;
}
.clp__head {
  display: flex;
  align-items: center;
}
.clp__members {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin: 12px 0 10px;
}
.clp__av {
  display: block;
}
.clp__more {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 11.5px;
  font-weight: 700;
  background: var(--ft-surface-3);
  color: var(--ft-muted);
}
.clp__link {
  font-size: 13px;
  font-weight: 600;
}
.clp__colors {
  display: grid;
  grid-template-columns: repeat(5, 24px);
  gap: 6px;
  padding: 10px 12px 6px;
  button {
    width: 24px;
    height: 24px;
    border-radius: 7px;
    border: 2px solid transparent;
    cursor: pointer;
    &.active {
      border-color: var(--ft-text);
    }
  }
}
</style>
