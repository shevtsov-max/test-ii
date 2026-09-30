<script setup>
/** Объединение двух записей об одном человеке (дубликатов). */
import { computed, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import PersonAvatar from '@/components/person/PersonAvatar.vue'
import PersonSelect from '@/components/person/PersonSelect.vue'
import { useTreeStore } from '@/stores/tree'
import { useUiStore } from '@/stores/ui'
import { fullName, shortName } from '@/domain/names'
import { birthLine, deathLine } from '@/domain/person'

const $q = useQuasar()
const tree = useTreeStore()
const ui = useUiStore()
const open = computed({
  get: () => ui.mergeDialog.open,
  set: (v) => (ui.mergeDialog.open = v),
})
const a = ref(null)
const b = ref(null)
const keep = ref('a')
watch(open, (o) => {
  if (!o) return
  a.value = ui.mergeDialog.a
  b.value = ui.mergeDialog.b
  keep.value = 'a'
})

function info(id) {
  const p = tree.person(id)
  if (!p) return null
  const G = tree.graph
  const { father, mother } = G.parents(id)
  return {
    p,
    rows: [
      ['ФИО', fullName(p)],
      ['Рождение', birthLine(tree.tree, p) || '—'],
      ['Смерть', p.living ? 'жив(а)' : deathLine(tree.tree, p)],
      ['Родители', [father, mother].filter(Boolean).map((x) => shortName(tree.person(x))).join(', ') || '—'],
      ['Супруги', G.partners(id).map((x) => shortName(tree.person(x.id))).join(', ') || '—'],
      ['Дети', String(G.children(id).length)],
      ['События', String(p.events.length)],
      ['Фото и документы', String(G.mediaOf(id).length)],
    ],
  }
}
const A = computed(() => info(a.value))
const B = computed(() => info(b.value))

function merge() {
  const [k, d] = keep.value === 'a' ? [a.value, b.value] : [b.value, a.value]
  tree.mergePersons(k, d)
  if (tree.selectedId === d) tree.selectPerson(k)
  open.value = false
  $q.notify({ type: 'positive', message: 'Записи объединены', actions: [{ label: 'Отменить', color: 'white', handler: () => tree.undo() }] })
}
</script>

<template>
  <q-dialog v-model="open" transition-show="jump-up">
    <q-card class="mg">
      <header class="mg__head">
        <div class="col">
          <div class="ft-h2">Объединить записи</div>
          <div class="text-muted" style="font-size: 13px">Связи, события, фото и источники будут собраны в одной записи. Пустые поля заполнятся из второй.</div>
        </div>
        <q-btn v-close-popup flat round dense icon="sym_r_close" aria-label="Закрыть" />
      </header>
      <div class="mg__cols">
        <div v-for="side in ['a', 'b']" :key="side" class="mg__col" :class="{ active: keep === side }">
          <PersonSelect v-if="side === 'a'" v-model="a" dense label="Первая запись" :exclude="b ? [b] : []" />
          <PersonSelect v-else v-model="b" dense label="Вторая запись" :exclude="a ? [a] : []" />
          <template v-if="(side === 'a' ? A : B)">
            <div class="mg__who">
              <PersonAvatar :person="(side === 'a' ? A : B).p" :size="44" />
              <q-radio v-model="keep" :val="side" label="Оставить эту запись" dense />
            </div>
            <dl class="mg__dl">
              <template v-for="r in (side === 'a' ? A : B).rows" :key="r[0]">
                <dt>{{ r[0] }}</dt>
                <dd>{{ r[1] }}</dd>
              </template>
            </dl>
          </template>
        </div>
      </div>
      <footer class="mg__foot">
        <q-space />
        <q-btn v-close-popup flat no-caps label="Отмена" />
        <q-btn unelevated no-caps color="primary" icon="sym_r_merge" label="Объединить" :disable="!A || !B" @click="merge" />
      </footer>
    </q-card>
  </q-dialog>
</template>

<style scoped lang="scss">
.mg {
  width: 820px;
  max-width: 96vw;
}
.mg__head {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 18px 18px 10px 22px;
}
.mg__cols {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  padding: 6px 22px 16px;
}
.mg__col {
  border: 1.5px solid var(--ft-border);
  border-radius: 14px;
  padding: 12px;
  transition: border-color 0.15s;
  &.active {
    border-color: var(--ft-primary);
    background: color-mix(in srgb, var(--ft-primary-soft) 45%, transparent);
  }
}
.mg__who {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 12px 0 8px;
}
.mg__dl {
  display: grid;
  grid-template-columns: 110px 1fr;
  gap: 4px 8px;
  margin: 0;
  font-size: 13px;
  dt {
    color: var(--ft-muted);
  }
  dd {
    margin: 0;
  }
}
.mg__foot {
  display: flex;
  gap: 6px;
  padding: 12px 18px 16px;
  border-top: 1px solid var(--ft-border);
}
@media (max-width: 700px) {
  .mg__cols {
    grid-template-columns: 1fr;
  }
}
</style>
