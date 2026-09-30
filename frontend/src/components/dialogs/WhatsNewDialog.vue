<script setup>
import { computed } from 'vue'
import { CHANGELOG } from '@/app/changelog'
import { config } from '@/app/config'
import { useUiStore } from '@/stores/ui'
import { usePwaStore } from '@/stores/pwa'

const ui = useUiStore()
const pwa = usePwaStore()
const open = computed({
  get: () => ui.whatsNewOpen,
  set: (v) => (ui.whatsNewOpen = v),
})
const cmp = (a, b) => {
  const pa = String(a).split('.').map(Number)
  const pb = String(b).split('.').map(Number)
  for (let i = 0; i < 3; i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0)
  return 0
}
const entries = computed(() => {
  const from = pwa.updatedFrom
  const list = from ? CHANGELOG.filter((e) => cmp(e.version, from) > 0) : CHANGELOG
  return list.length ? list : CHANGELOG.slice(0, 1)
})
</script>

<template>
  <q-dialog v-model="open">
    <q-card class="wn">
      <div class="wn__hero">
        <q-icon name="sym_r_celebration" size="30px" />
        <div>
          <div class="ft-h2">Что нового</div>
          <div class="text-muted">Версия {{ config.version }}</div>
        </div>
        <q-space />
        <q-btn v-close-popup flat round dense icon="sym_r_close" />
      </div>
      <div class="wn__body ft-scroll">
        <section v-for="e in entries" :key="e.version">
          <div class="wn__title">
            <b>{{ e.title }}</b>
            <span class="ft-chip">{{ e.version }} · {{ new Date(e.date).toLocaleDateString('ru-RU') }}</span>
          </div>
          <ul>
            <li v-for="(it, i) in e.items" :key="i">{{ it }}</li>
          </ul>
        </section>
      </div>
      <div class="wn__foot">
        <q-btn v-close-popup unelevated no-caps color="primary" label="Понятно" class="q-px-lg" />
      </div>
    </q-card>
  </q-dialog>
</template>

<style scoped lang="scss">
.wn {
  width: 560px;
  max-width: 96vw;
  max-height: 86vh;
  display: flex;
  flex-direction: column;
}
.wn__hero {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 20px 20px 14px 24px;
  color: var(--ft-primary-text);
  > div {
    color: var(--ft-text);
  }
}
.wn__body {
  padding: 0 24px 8px;
  overflow-y: auto;
  ul {
    margin: 8px 0 16px;
    padding-left: 20px;
  }
  li {
    margin-bottom: 6px;
    color: var(--ft-text-2);
  }
}
.wn__title {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.wn__foot {
  display: flex;
  justify-content: flex-end;
  padding: 12px 20px 18px;
  border-top: 1px solid var(--ft-border);
}
</style>
