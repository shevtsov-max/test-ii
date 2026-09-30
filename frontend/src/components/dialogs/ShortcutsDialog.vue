<script setup>
import { computed } from 'vue'
import { useUiStore } from '@/stores/ui'
import { SHORTCUTS as groups } from '@/app/shortcuts'

const ui = useUiStore()
const open = computed({
  get: () => ui.shortcutsOpen,
  set: (v) => (ui.shortcutsOpen = v),
})
</script>

<template>
  <q-dialog v-model="open">
    <q-card class="sk">
      <div class="sk__head">
        <div class="ft-h2">Горячие клавиши</div>
        <q-btn v-close-popup flat round dense icon="sym_r_close" />
      </div>
      <div class="sk__grid">
        <section v-for="g in groups" :key="g.title">
          <div class="ft-label q-mb-sm">{{ g.title }}</div>
          <div v-for="k in g.keys" :key="k[1]" class="sk__row">
            <span class="sk__keys"><span v-for="(x, i) in k[0]" :key="i" class="ft-kbd">{{ x }}</span></span>
            <span class="text-2">{{ k[1] }}</span>
          </div>
        </section>
      </div>
    </q-card>
  </q-dialog>
</template>

<style scoped lang="scss">
.sk {
  width: 760px;
  max-width: 96vw;
  padding: 20px 24px 24px;
}
.sk__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.sk__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 24px;
}
.sk__row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 5px 0;
  font-size: 13.5px;
}
.sk__keys {
  display: flex;
  gap: 3px;
  min-width: 92px;
}
</style>
