<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import GuestBanner from '@/components/ui/GuestBanner.vue'
import UpcomingDates from '@/components/ui/UpcomingDates.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { api, errorMessage } from '@/api'
import { useAuthStore } from '@/stores/auth'
import { EXAMPLES, useTreesStore } from '@/stores/trees'
import { downloadBackup, downloadGedcom } from '@/utils/backup'
import { formatBytes, pickFiles } from '@/utils/files'
import { count, timeAgo } from '@/utils/format'

const $q = useQuasar()
const router = useRouter()
const auth = useAuthStore()
const trees = useTreesStore()
const busy = ref(false)
const storage = ref(null)

onMounted(async () => {
  try {
    await trees.fetch()
  } catch (e) {
    $q.notify({ type: 'negative', message: errorMessage(e) })
  }
  if (api.mode === 'local') storage.value = await import('@/api/local/db').then((m) => m.store.estimate()).catch(() => null)
})

const hour = new Date().getHours()
const greeting = computed(() => {
  const name = auth.isGuest ? '' : `, ${auth.user?.name?.split(' ')[0] ?? ''}`
  const g = hour < 5 ? 'Доброй ночи' : hour < 12 ? 'Доброе утро' : hour < 18 ? 'Добрый день' : 'Добрый вечер'
  return g + name
})

const open = (id) => router.push({ name: 'tree-chart', params: { treeId: id } })

async function run(fn, success) {
  busy.value = true
  try {
    const r = await fn()
    if (success) $q.notify({ type: 'positive', message: success })
    return r
  } catch (e) {
    $q.notify({ type: 'negative', message: errorMessage(e), timeout: 6000 })
  } finally {
    busy.value = false
  }
}

async function importTree() {
  const [file] = await pickFiles('.json,.ged,.gedcom,application/json,text/plain')
  if (!file) return
  const s = await run(() => trees.importFile(file), 'Древо импортировано')
  if (s) open(s.id)
}
async function example(id) {
  const s = await run(() => trees.createExample(id))
  if (s) open(s.id)
}
function rename(t) {
  $q.dialog({
    title: 'Название древа',
    prompt: { model: t.name, type: 'text', outlined: true, isValid: (v) => !!v.trim() },
    cancel: { flat: true, label: 'Отмена', noCaps: true },
    ok: { unelevated: true, label: 'Сохранить', color: 'primary', noCaps: true },
  }).onOk((v) => run(() => trees.rename(t.id, v.trim())))
}
function remove(t) {
  $q.dialog({
    title: `Удалить древо «${t.name}»?`,
    message: `Будут удалены ${count(t.persons, 'персона', 'персоны', 'персон')}, все события, фото и документы. Это нельзя отменить — сначала сохраните резервную копию.`,
    prompt: { model: '', type: 'text', outlined: true, label: 'Введите название древа для подтверждения', isValid: (v) => v.trim() === t.name.trim() },
    cancel: { flat: true, label: 'Отмена', noCaps: true },
    ok: { unelevated: true, label: 'Удалить навсегда', color: 'negative', noCaps: true },
  }).onOk(() => run(() => trees.remove(t.id), 'Древо удалено'))
}
async function exportTree(t, kind) {
  await run(async () => {
    const { tree } = await api.trees.get(t.id, auth.user.id)
    if (kind === 'ged') downloadGedcom(tree)
    else await downloadBackup(tree)
  })
}
</script>

<template>
  <div class="ft-page dash">
    <header class="dash__head">
      <div>
        <h1 class="ft-h1">{{ greeting }}</h1>
        <div class="text-muted q-mt-xs">
          {{ trees.list.length ? `У вас ${count(trees.list.length, 'древо', 'древа', 'древ')}` : 'Здесь будут ваши родословные древа' }}
        </div>
      </div>
      <q-space />
      <q-btn outline no-caps color="primary" icon="sym_r_upload_file" label="Импорт" :loading="busy" @click="importTree">
        <q-tooltip>GEDCOM (.ged) из MyHeritage, Ancestry, «Древа Жизни» или резервная копия (.json)</q-tooltip>
      </q-btn>
      <q-btn unelevated no-caps color="primary" icon="sym_r_add" label="Новое древо" :to="{ name: 'new-tree' }" />
    </header>

    <GuestBanner />
    <UpcomingDates v-if="trees.list.length" :refresh-key="trees.list.map((t) => t.updatedAt).join()" />

    <div v-if="trees.loading && !trees.loaded" class="dash__grid">
      <q-skeleton v-for="i in 3" :key="i" height="190px" class="dash__skel" />
    </div>

    <template v-else-if="trees.list.length">
      <div class="dash__grid">
        <article v-for="t in trees.list" :key="t.id" class="tcard ft-card ft-card--hover" tabindex="0" @click="open(t.id)" @keydown.enter="open(t.id)">
          <div class="tcard__art" :class="`gender-${t.homeGender || 'U'}`">
            <div class="tcard__art-bg" />
            <div class="tcard__who">
              <div class="tcard__avatar">
                <img v-if="t.homeThumb" :src="t.homeThumb" alt="" />
                <q-icon v-else name="sym_r_person" size="26px" />
              </div>
              <div class="min-w-0">
                <div class="tcard__home-label">Это Вы</div>
                <div class="fw-600 ellipsis-1">{{ t.homeName || '—' }}</div>
              </div>
            </div>
          </div>
          <div class="tcard__body">
            <div class="tcard__title">
              <span class="ellipsis-1">{{ t.name }}</span>
              <q-btn flat round dense size="sm" icon="sym_r_more_vert" class="tcard__menu" aria-label="Действия" @click.stop>
                <q-menu anchor="bottom right" self="top right">
                  <q-list dense style="min-width: 220px" class="q-py-xs">
                    <q-item v-close-popup clickable @click="open(t.id)">
                      <q-item-section avatar><q-icon name="sym_r_open_in_new" /></q-item-section>
                      <q-item-section>Открыть</q-item-section>
                    </q-item>
                    <q-item v-close-popup clickable :disable="t.role !== 'owner'" @click="rename(t)">
                      <q-item-section avatar><q-icon name="sym_r_edit" /></q-item-section>
                      <q-item-section>Переименовать</q-item-section>
                    </q-item>
                    <q-item v-close-popup clickable @click="run(() => trees.duplicate(t.id), 'Копия создана')">
                      <q-item-section avatar><q-icon name="sym_r_content_copy" /></q-item-section>
                      <q-item-section>Создать копию</q-item-section>
                    </q-item>
                    <q-separator class="q-my-xs" />
                    <q-item v-close-popup clickable @click="exportTree(t, 'json')">
                      <q-item-section avatar><q-icon name="sym_r_save" /></q-item-section>
                      <q-item-section>Резервная копия (.json)</q-item-section>
                    </q-item>
                    <q-item v-close-popup clickable @click="exportTree(t, 'ged')">
                      <q-item-section avatar><q-icon name="sym_r_account_tree" /></q-item-section>
                      <q-item-section>Экспорт GEDCOM (.ged)</q-item-section>
                    </q-item>
                    <q-separator class="q-my-xs" />
                    <q-item v-close-popup clickable class="text-negative" :disable="t.role !== 'owner'" @click="remove(t)">
                      <q-item-section avatar><q-icon name="sym_r_delete" color="negative" /></q-item-section>
                      <q-item-section>Удалить</q-item-section>
                    </q-item>
                  </q-list>
                </q-menu>
              </q-btn>
            </div>
            <div v-if="t.description" class="tcard__desc">{{ t.description }}</div>
            <div class="tcard__stats">
              <span><q-icon name="sym_r_groups" size="16px" />{{ t.persons }}</span>
              <span><q-icon name="sym_r_favorite" size="16px" />{{ t.families }}</span>
              <span><q-icon name="sym_r_photo_library" size="16px" />{{ t.media }}</span>
              <q-space />
              <span class="text-faint">{{ timeAgo(t.updatedAt) }}</span>
            </div>
          </div>
        </article>
        <router-link :to="{ name: 'new-tree' }" class="tcard tcard--new">
          <q-icon name="sym_r_add_circle" size="34px" />
          <b>Новое древо</b>
          <span>Начните с себя — добавьте родителей, бабушек и дедушек</span>
        </router-link>
      </div>
    </template>

    <EmptyState v-else icon="sym_r_forest" title="Начните своё родословное древо" text="Создайте древо с нуля, перенесите его из другой программы или посмотрите пример.">
      <template #actions>
        <q-btn unelevated no-caps color="primary" icon="sym_r_add" label="Создать древо" :to="{ name: 'new-tree' }" />
        <q-btn outline no-caps color="primary" icon="sym_r_upload_file" label="Импорт GEDCOM / JSON" @click="importTree" />
      </template>
    </EmptyState>

    <section class="dash__examples">
      <div class="ft-h3 q-mb-sm">Посмотреть на примере</div>
      <div class="dash__ex-grid">
        <button v-for="e in EXAMPLES" :key="e.id" type="button" class="dash__ex ft-card ft-card--hover" :disabled="busy" @click="example(e.id)">
          <span class="dash__ex-icon"><q-icon :name="e.id === 'romanovs' ? 'sym_r_crown' : 'sym_r_family_restroom'" size="22px" /></span>
          <span class="min-w-0">
            <b>{{ e.name }}</b>
            <span class="text-muted">{{ e.text }}</span>
          </span>
          <q-icon name="sym_r_arrow_forward" size="18px" class="text-faint" />
        </button>
      </div>
    </section>

    <footer v-if="storage && storage.quota" class="dash__storage text-muted">
      <q-icon name="sym_r_storage" size="16px" />
      Данные хранятся в этом браузере: занято {{ formatBytes(storage.usage) }} из {{ formatBytes(storage.quota) }}.
      <router-link :to="{ name: 'account', query: { tab: 'data' } }">Резервные копии и хранилище</router-link>
    </footer>
  </div>
</template>

<style scoped lang="scss">
.dash__head {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 22px;
}
.dash__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(290px, 1fr));
  gap: 16px;
}
.dash__skel {
  border-radius: 16px;
}
.tcard {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  cursor: pointer;
  outline: none;
  &:focus-visible {
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--ft-primary) 40%, transparent);
  }
}
.tcard__art {
  position: relative;
  height: 96px;
  padding: 16px;
  display: flex;
  align-items: flex-end;
  overflow: hidden;
  border-bottom: 1px solid var(--ft-border);
}
.tcard__art-bg {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 85% 20%, color-mix(in srgb, var(--ft-primary) 22%, transparent), transparent 55%),
    radial-gradient(circle at 10% 110%, color-mix(in srgb, var(--g) 22%, transparent), transparent 60%),
    var(--ft-surface-2);
}
.tcard__art-bg::after {
  content: '';
  position: absolute;
  right: 14px;
  top: 12px;
  width: 120px;
  height: 70px;
  opacity: 0.35;
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 70' fill='none' stroke='%23a8a194' stroke-width='2' stroke-linecap='round'%3E%3Cpath d='M20 18h30M70 18h30M35 18v14h50V18M60 32v12M30 56V44h60v12'/%3E%3Ccircle cx='14' cy='18' r='6'/%3E%3Ccircle cx='56' cy='18' r='6'/%3E%3Ccircle cx='64' cy='18' r='6'/%3E%3Ccircle cx='106' cy='18' r='6'/%3E%3Ccircle cx='30' cy='62' r='6'/%3E%3Ccircle cx='60' cy='62' r='6'/%3E%3Ccircle cx='90' cy='62' r='6'/%3E%3C/svg%3E") no-repeat center / contain;
}
.tcard__who {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.tcard__avatar {
  position: relative;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--g-soft);
  color: var(--g);
  display: grid;
  place-items: center;
  overflow: hidden;
  box-shadow: 0 0 0 2px var(--ft-surface);
  flex: none;
  img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}
.tcard__home-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--ft-primary-text);
}
.tcard__body {
  padding: 14px 16px 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
}
.tcard__title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: -0.01em;
}
.tcard__menu {
  margin-left: auto;
  color: var(--ft-muted);
}
.tcard__desc {
  font-size: 13px;
  color: var(--ft-muted);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.tcard__stats {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-top: auto;
  padding-top: 6px;
  font-size: 13px;
  color: var(--ft-text-2);
  font-variant-numeric: tabular-nums;
  span {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .q-icon {
    color: var(--ft-faint);
  }
}
.tcard--new {
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 6px;
  min-height: 190px;
  padding: 20px;
  border: 1.5px dashed var(--ft-border-strong);
  border-radius: var(--ft-radius-lg);
  color: var(--ft-muted);
  text-decoration: none !important;
  transition: 0.15s;
  b {
    color: var(--ft-text);
    font-size: 15px;
  }
  span {
    font-size: 13px;
    max-width: 220px;
  }
  &:hover {
    border-color: var(--ft-primary);
    color: var(--ft-primary-text);
    background: var(--ft-primary-soft);
  }
}
.dash__examples {
  margin-top: 36px;
}
.dash__ex-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 12px;
}
.dash__ex {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  text-align: left;
  font: inherit;
  color: var(--ft-text);
  cursor: pointer;
  > span:nth-child(2) {
    flex: 1;
    display: flex;
    flex-direction: column;
    font-size: 13px;
    b {
      font-size: 14px;
    }
  }
}
.dash__ex-icon {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  background: var(--ft-accent-soft);
  color: var(--ft-accent);
  flex: none;
}
.dash__storage {
  margin-top: 36px;
  font-size: 12.5px;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
</style>
