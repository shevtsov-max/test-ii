<script setup>
/**
 * Семья персоны: родители (в том числе приёмные), братья и сёстры, супруги и дети каждого союза.
 * Здесь же — управление связями: отношения, тип родства, отвязка.
 */
import { computed } from 'vue'
import PersonChip from './PersonChip.vue'
import { useTreeStore } from '@/stores/tree'
import { useUiStore } from '@/stores/ui'
import { usePersonActions } from '@/composables/usePersonActions'
import { childLinkInfo, statusInfo } from '@/domain/model'
import { formatDate } from '@/domain/dates'
import { placeName } from '@/domain/places'

const props = defineProps({ personId: { type: String, required: true } })
const tree = useTreeStore()
const ui = useUiStore()
const actions = usePersonActions()
const G = computed(() => tree.graph)
const ro = computed(() => !tree.canEdit(props.personId))

const parentFams = computed(() =>
  G.value.parentFamilies(props.personId).map((f, i) => {
    const { father, mother } = G.value.parents(props.personId, f)
    const link = f.childLinks?.[props.personId] ?? 'birth'
    return { f, father, mother, link, primary: i === 0 }
  }),
)
const sib = computed(() => G.value.siblings(props.personId))
const unions = computed(() =>
  G.value.spouseFamilies(props.personId).map((f) => ({
    f,
    partner: G.value.partnerIn(f, props.personId),
    kids: G.value.familyChildren(f),
  })),
)
const when = (f) => [formatDate(f.marriage.date), placeName(tree.tree, f.marriage.placeId)].filter(Boolean).join(', ')
</script>

<template>
  <div class="pf">
    <!-- Родители -->
    <section class="ft-card ft-card--pad">
      <div class="pf__head">
        <h2 class="ft-h3">Родители</h2>
        <q-btn v-if="!ro" flat dense no-caps size="sm" color="primary" icon="sym_r_add" label="Приёмные родители" @click="ui.addRelative(personId, 'father', null, 'adopted')" />
      </div>
      <div v-if="!parentFams.length" class="pf__empty">
        <span class="text-muted">Родители не указаны</span>
        <template v-if="!ro">
          <q-btn outline no-caps dense color="primary" icon="sym_r_add" label="Отца" @click="ui.addRelative(personId, 'father')" />
          <q-btn outline no-caps dense color="primary" icon="sym_r_add" label="Мать" @click="ui.addRelative(personId, 'mother')" />
        </template>
      </div>
      <div v-for="pf in parentFams" :key="pf.f.id" class="pf__block">
        <div class="pf__block-head">
          <span class="ft-chip" :class="pf.link === 'birth' ? '' : 'ft-chip--info'">{{ pf.link === 'birth' ? 'Кровные родители' : childLinkInfo(pf.link).label }}</span>
          <span v-if="pf.f.partners.length === 2" class="text-muted" style="font-size: 12.5px">{{ statusInfo(pf.f.status).label }}{{ when(pf.f) ? ` · ${when(pf.f)}` : '' }}</span>
          <q-space />
          <q-btn v-if="!ro" flat round dense size="sm" icon="sym_r_more_horiz" class="text-muted">
            <q-menu>
              <q-list dense style="min-width: 240px">
                <q-item v-close-popup clickable @click="ui.editFamily(pf.f.id)">
                  <q-item-section avatar><q-icon name="sym_r_favorite" /></q-item-section>
                  <q-item-section>Отношения родителей, тип родства</q-item-section>
                </q-item>
                <q-item v-close-popup clickable class="text-negative" @click="actions.detachFromParents(personId, pf.f.id)">
                  <q-item-section avatar><q-icon name="sym_r_link_off" color="negative" /></q-item-section>
                  <q-item-section>Отвязать от этих родителей</q-item-section>
                </q-item>
              </q-list>
            </q-menu>
          </q-btn>
        </div>
        <div class="pf__pair">
          <PersonChip v-if="pf.father" :person-id="pf.father" relation class="pf__chip" />
          <button v-else-if="!ro && pf.f.partners.length < 2" type="button" class="pf__add" @click="ui.addRelative(personId, 'father', pf.f.id, pf.link)">
            <q-icon name="sym_r_add" size="18px" /> Добавить отца
          </button>
          <PersonChip v-if="pf.mother" :person-id="pf.mother" relation class="pf__chip" />
          <button v-else-if="!ro && pf.f.partners.length < 2" type="button" class="pf__add" @click="ui.addRelative(personId, 'mother', pf.f.id, pf.link)">
            <q-icon name="sym_r_add" size="18px" /> Добавить мать
          </button>
        </div>
      </div>
    </section>

    <!-- Братья и сёстры -->
    <section class="ft-card ft-card--pad">
      <div class="pf__head">
        <h2 class="ft-h3">Братья и сёстры <small class="text-muted">{{ sib.full.length + sib.half.length || '' }}</small></h2>
        <span v-if="!ro">
          <q-btn flat dense no-caps size="sm" color="primary" icon="sym_r_add" label="Брат" @click="ui.addRelative(personId, 'brother')" />
          <q-btn flat dense no-caps size="sm" color="primary" icon="sym_r_add" label="Сестра" @click="ui.addRelative(personId, 'sister')" />
        </span>
      </div>
      <div v-if="sib.full.length" class="pf__grid">
        <PersonChip v-for="id in sib.full" :key="id" :person-id="id" relation class="pf__chip" />
      </div>
      <template v-if="sib.half.length">
        <div class="ft-label q-mt-md q-mb-sm">Сводные (единокровные и единоутробные)</div>
        <div class="pf__grid">
          <PersonChip v-for="id in sib.half" :key="id" :person-id="id" relation class="pf__chip" />
        </div>
      </template>
      <div v-if="!sib.full.length && !sib.half.length" class="text-muted">Нет братьев и сестёр в древе</div>
    </section>

    <!-- Супруги и дети -->
    <section class="ft-card ft-card--pad">
      <div class="pf__head">
        <h2 class="ft-h3">Супруги и дети</h2>
        <span v-if="!ro">
          <q-btn flat dense no-caps size="sm" color="primary" icon="sym_r_add" label="Супруг(а)" @click="ui.addRelative(personId, 'partner')" />
          <q-btn flat dense no-caps size="sm" color="primary" icon="sym_r_add" label="Ребёнок" @click="ui.addRelative(personId, 'son')" />
        </span>
      </div>
      <div v-if="!unions.length" class="text-muted">Нет супругов и детей в древе</div>
      <div v-for="u in unions" :key="u.f.id" class="pf__block">
        <div class="pf__block-head">
          <span class="ft-chip ft-chip--primary"><q-icon :name="statusInfo(u.f.status).icon" size="14px" />{{ u.partner ? statusInfo(u.f.status).label : 'Второй родитель неизвестен' }}</span>
          <span v-if="when(u.f)" class="text-muted" style="font-size: 12.5px">{{ when(u.f) }}</span>
          <q-space />
          <q-btn v-if="!ro" flat dense no-caps size="sm" color="primary" icon="sym_r_edit" label="Отношения" @click="ui.editFamily(u.f.id)" />
          <q-btn v-if="!ro && u.partner" flat round dense size="sm" icon="sym_r_link_off" class="text-muted" @click="actions.removePartnership(u.f.id, personId)">
            <q-tooltip>Удалить связь</q-tooltip>
          </q-btn>
        </div>
        <PersonChip v-if="u.partner" :person-id="u.partner" relation class="pf__chip pf__partner" />
        <div class="pf__kids">
          <div class="ft-label q-mb-xs">Дети · {{ u.kids.length }}</div>
          <div class="pf__grid">
            <PersonChip v-for="c in u.kids" :key="c" :person-id="c" relation class="pf__chip">
              <span v-if="u.f.childLinks?.[c]" class="ft-chip ft-chip--info">{{ childLinkInfo(u.f.childLinks[c]).short }}</span>
            </PersonChip>
            <button v-if="!ro" type="button" class="pf__add pf__add--sm" @click="ui.addRelative(personId, 'son', u.f.id)">
              <q-icon name="sym_r_add" size="18px" /> Ребёнок
            </button>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped lang="scss">
.pf {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.pf__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.pf__empty {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.pf__block {
  padding: 12px;
  border-radius: 14px;
  background: var(--ft-surface-2);
  border: 1px solid var(--ft-border);
  & + & {
    margin-top: 10px;
  }
}
.pf__block-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}
.pf__pair {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.pf__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: 8px;
}
.pf__chip {
  padding: 8px 10px;
  background: var(--ft-surface);
  border: 1px solid var(--ft-border);
  border-radius: 12px;
  transition: box-shadow 0.15s;
  &:hover {
    box-shadow: var(--ft-shadow);
  }
}
.pf__partner {
  max-width: 360px;
}
.pf__kids {
  margin-top: 12px;
}
.pf__add {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px;
  border-radius: 12px;
  border: 1.5px dashed var(--ft-border-strong);
  background: transparent;
  color: var(--ft-muted);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
  &:hover {
    border-color: var(--ft-primary);
    color: var(--ft-primary-text);
  }
}
.pf__add--sm {
  padding: 8px;
}
@media (max-width: 600px) {
  .pf__pair {
    grid-template-columns: 1fr;
  }
}
</style>
