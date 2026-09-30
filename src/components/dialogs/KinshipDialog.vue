<script setup>
/** Калькулятор родства: кем один человек приходится другому и через кого они связаны. */
import { computed, ref, watch } from 'vue'
import PersonAvatar from '@/components/person/PersonAvatar.vue'
import PersonSelect from '@/components/person/PersonSelect.vue'
import { useTreeStore } from '@/stores/tree'
import { useUiStore } from '@/stores/ui'
import { kinshipChain, relationship } from '@/domain/kinship'
import { shortName } from '@/domain/names'
import { lifeSpan } from '@/domain/person'

const tree = useTreeStore()
const ui = useUiStore()
const open = computed({
  get: () => ui.kinshipDialog.open,
  set: (v) => (ui.kinshipDialog.open = v),
})
const a = ref(null)
const b = ref(null)
watch(open, (o) => {
  if (!o) return
  a.value = ui.kinshipDialog.a ?? tree.homeId
  b.value = ui.kinshipDialog.b ?? (tree.selectedId !== a.value ? tree.selectedId : null)
})
const ab = computed(() => (a.value && b.value ? relationship(tree.graph, a.value, b.value) : ''))
const ba = computed(() => (a.value && b.value ? relationship(tree.graph, b.value, a.value) : ''))
const chain = computed(() => (a.value && b.value && a.value !== b.value ? kinshipChain(tree.graph, a.value, b.value) : null))
function swap() {
  ;[a.value, b.value] = [b.value, a.value]
}
</script>

<template>
  <q-dialog v-model="open" transition-show="jump-up">
    <q-card class="kd">
      <header class="kd__head">
        <div class="ft-h2 col">Кем приходится</div>
        <q-btn v-close-popup flat round dense icon="sym_r_close" aria-label="Закрыть" />
      </header>
      <div class="kd__body">
        <div class="kd__pick">
          <PersonSelect v-model="a" dense label="Кто" />
          <q-btn flat round dense icon="sym_r_swap_horiz" aria-label="Поменять местами" @click="swap" />
          <PersonSelect v-model="b" dense label="Кому" />
        </div>
        <template v-if="a && b">
          <div v-if="a === b" class="kd__result">Это один и тот же человек</div>
          <template v-else-if="ab">
            <div class="kd__result">
              <b>{{ shortName(tree.person(b)) }}</b> приходится <b>{{ shortName(tree.person(a)) }}</b>:
              <span class="kd__label">{{ ab.toLowerCase() }}</span>
            </div>
            <div class="kd__result kd__result--sub">
              <b>{{ shortName(tree.person(a)) }}</b> приходится <b>{{ shortName(tree.person(b)) }}</b>:
              <span class="kd__label">{{ ba.toLowerCase() }}</span>
            </div>
            <div v-if="chain" class="kd__chain">
              <div class="ft-label q-mb-sm">Как связаны · {{ chain.length - 1 }} {{ chain.length - 1 === 1 ? 'шаг' : chain.length - 1 < 5 ? 'шага' : 'шагов' }}</div>
              <div v-for="(c, i) in chain" :key="c.id + i" class="kd__step">
                <div class="kd__rail">
                  <span class="kd__dot" />
                  <span v-if="i < chain.length - 1" class="kd__line" />
                </div>
                <div class="kd__person" :class="`gender-${tree.person(c.id)?.gender}`">
                  <PersonAvatar :person="tree.person(c.id)" :size="30" />
                  <div class="min-w-0">
                    <div class="fw-600 ellipsis-1">{{ shortName(tree.person(c.id)) }}</div>
                    <div class="text-muted" style="font-size: 12px">
                      <template v-if="i > 0">{{ c.word }} — {{ shortName(tree.person(chain[i - 1].id)) }}</template>
                      <template v-else>{{ lifeSpan(tree.person(c.id)) }}</template>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </template>
          <div v-else class="kd__result text-muted">Не связаны: в древе нет общей линии между этими людьми.</div>
        </template>
      </div>
    </q-card>
  </q-dialog>
</template>

<style scoped lang="scss">
.kd {
  width: 600px;
  max-width: 96vw;
}
.kd__head {
  display: flex;
  align-items: center;
  padding: 18px 18px 6px 22px;
}
.kd__body {
  padding: 8px 22px 22px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.kd__pick {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 8px;
  align-items: center;
}
.kd__result {
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--ft-primary-soft);
  font-size: 14.5px;
}
.kd__result--sub {
  background: var(--ft-surface-2);
  font-size: 13.5px;
}
.kd__label {
  font-weight: 750;
  color: var(--ft-primary-text);
}
.kd__chain {
  margin-top: 4px;
}
.kd__step {
  display: flex;
  gap: 10px;
}
.kd__rail {
  position: relative;
  width: 14px;
  display: flex;
  justify-content: center;
}
.kd__dot {
  width: 10px;
  height: 10px;
  margin-top: 11px;
  border-radius: 50%;
  background: var(--ft-primary);
  z-index: 1;
}
.kd__line {
  position: absolute;
  top: 18px;
  bottom: -14px;
  width: 2px;
  background: var(--ft-border-strong);
}
.kd__person {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 3px 0 10px;
  min-width: 0;
}
@media (max-width: 560px) {
  .kd__pick {
    grid-template-columns: 1fr;
  }
}
</style>
