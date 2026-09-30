<script setup>
/**
 * «Сегодня и ближайшие дни»: дни рождения, годовщины свадеб и дни памяти по всем древам пользователя.
 * С сервером те же даты бот присылает в Телеграм (Учётная запись → Уведомления).
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '@/api'
import { useAuthStore } from '@/stores/auth'
import { plural } from '@/utils/format'

const props = defineProps({
  days: { type: Number, default: 7 },
  /** Перечитать при изменении (например, после загрузки списка древ) */
  refreshKey: { type: [Number, String], default: 0 },
})

const auth = useAuthStore()
const router = useRouter()
const items = ref([])
const loaded = ref(false)

async function load() {
  if (!auth.user) return
  try {
    items.value = await api.notifications.upcoming(auth.user.id, props.days)
  } catch {
    items.value = []
  } finally {
    loaded.value = true
  }
}
onMounted(load)
watch(() => props.refreshKey, load)

const KIND = {
  birthday: { icon: 'sym_r_cake', tone: 'birthday' },
  wedding: { icon: 'sym_r_favorite', tone: 'wedding' },
  memory_birth: { icon: 'sym_r_local_florist', tone: 'memory' },
  memory_death: { icon: 'sym_r_local_florist', tone: 'memory' },
}
const years = (n) => `${n} ${plural(n, 'год', 'года', 'лет')}`

function title(e) {
  const who = e.names.join(' и ')
  switch (e.kind) {
    case 'birthday':
      return e.years ? `${who} — ${e.inDays === 0 ? 'исполняется ' : ''}${years(e.years)}` : `${who} — день рождения`
    case 'wedding':
      return e.years ? `${who} — ${years(e.years)} вместе` : `${who} — годовщина свадьбы`
    case 'memory_birth':
      return e.years ? `${who} — ${years(e.years)} со дня рождения` : `${who} — день рождения`
    default:
      return e.years ? `${who} — ${years(e.years)} со дня смерти` : `${who} — день памяти`
  }
}
function when(e) {
  if (e.inDays === 0) return 'Сегодня'
  if (e.inDays === 1) return 'Завтра'
  const d = new Date(`${e.date}T12:00:00`)
  return d.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'long' })
}
const list = computed(() => items.value.slice(0, 8).map((e) => ({ ...e, ...KIND[e.kind], title: title(e), when: when(e) })))
const today = computed(() => items.value.filter((e) => e.inDays === 0).length)

function open(e) {
  const personId = e.personIds[0]
  if (personId) router.push({ name: 'tree-person', params: { treeId: e.treeId, personId } })
  else router.push({ name: 'tree-chart', params: { treeId: e.treeId } })
}
</script>

<template>
  <section v-if="loaded && list.length" class="ud ft-card">
    <header class="ud__head">
      <q-icon name="sym_r_celebration" size="22px" class="ud__head-icon" />
      <div class="col">
        <div class="ft-h3">{{ today ? 'Сегодня и ближайшие дни' : 'Ближайшие памятные даты' }}</div>
        <div class="text-muted" style="font-size: 12.5px">На {{ days }} {{ plural(days, 'день', 'дня', 'дней') }} вперёд по всем вашим древам</div>
      </div>
      <q-btn
        v-if="api.capabilities.telegram"
        flat
        dense
        no-caps
        color="primary"
        icon="sym_r_notifications_active"
        label="Напоминать в Телеграме"
        class="gt-xs"
        :to="{ name: 'account', query: { tab: 'notifications' } }"
      />
    </header>
    <ul class="ud__list">
      <li v-for="e in list" :key="`${e.kind}-${e.treeId}-${e.personIds.join('-')}`" :class="[`ud--${e.tone}`, { 'ud--today': e.inDays === 0 }]">
        <button type="button" @click="open(e)">
          <span class="ud__icon"><q-icon :name="e.icon" size="18px" /></span>
          <span class="ud__when">{{ e.when }}</span>
          <span class="ud__title ellipsis-1">{{ e.title }}</span>
          <span class="ud__tree ellipsis-1 gt-xs">{{ e.treeName }}</span>
        </button>
      </li>
    </ul>
    <router-link v-if="api.capabilities.telegram" :to="{ name: 'account', query: { tab: 'notifications' } }" class="ud__cta lt-sm">
      <q-icon name="sym_r_notifications_active" size="16px" />Напоминать в Телеграме
    </router-link>
  </section>
</template>

<style scoped lang="scss">
.ud {
  padding: 16px 16px 10px;
  margin-bottom: 20px;
}
.ud__head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}
.ud__head-icon {
  color: var(--ft-accent);
}
.ud__list {
  list-style: none;
  margin: 0;
  padding: 0;
  button {
    display: grid;
    grid-template-columns: 32px 130px minmax(0, 1fr) minmax(0, 180px);
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 7px 6px;
    border: 0;
    border-radius: 10px;
    background: none;
    color: var(--ft-text);
    font: inherit;
    font-size: 14px;
    text-align: left;
    cursor: pointer;
    &:hover {
      background: var(--ft-surface-2);
    }
  }
}
.ud__icon {
  width: 32px;
  height: 32px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  background: var(--ft-surface-3);
  color: var(--ft-muted);
}
.ud--birthday .ud__icon {
  background: var(--ft-accent-soft);
  color: var(--ft-accent);
}
.ud--wedding .ud__icon {
  background: var(--ft-female-soft);
  color: var(--ft-female);
}
.ud__when {
  color: var(--ft-text-2);
  font-size: 13px;
}
.ud--today .ud__when {
  color: var(--ft-accent);
  font-weight: 700;
}
.ud__title {
  font-weight: 550;
}
.ud__tree {
  color: var(--ft-muted);
  font-size: 12.5px;
  text-align: right;
}
.ud__cta {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 6px 4px;
  font-size: 13px;
  font-weight: 600;
}
@media (max-width: 599px) {
  .ud__list button {
    grid-template-columns: 32px 88px minmax(0, 1fr);
  }
}
</style>
