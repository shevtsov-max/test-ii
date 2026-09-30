<script setup>
/** Юридические документы: соглашение, политика, согласие на обработку ПДн, согласие на рассылку. Тексты — src/app/legal.js. */
import { computed } from 'vue'
import { api } from '@/api'
import { DOCUMENT_ROUTES, DOCUMENT_TITLES, legalDocument } from '@/app/legal'

const props = defineProps({
  doc: { type: String, default: 'privacy' },
})
const d = computed(() => legalDocument(props.doc))
const revision = computed(() => new Date(d.value.version).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }))
const tabs = ['terms', 'privacy', 'personal_data', 'marketing'].map((k) => ({ key: k, route: DOCUMENT_ROUTES[k], title: DOCUMENT_TITLES[k] }))
const localMode = api.mode !== 'graphql'
</script>

<template>
  <div class="lg">
    <div class="lg__wrap">
      <nav class="lg__tabs">
        <router-link v-for="t in tabs" :key="t.key" :to="{ name: t.route }" :class="{ active: doc === t.key }">{{ t.title }}</router-link>
      </nav>
      <h1 class="lg__title">{{ d.title }}</h1>
      <div class="lg__rev">Редакция от {{ revision }}</div>

      <div v-if="localMode" class="lg__note">
        <q-icon name="sym_r_info" size="18px" />
        <span>Демо-версия работает без сервера: древо и учётные записи хранятся только в вашем браузере и никуда не передаются.</span>
      </div>
      <div v-else-if="!d.operator.filled" class="lg__note lg__note--warn">
        <q-icon name="sym_r_warning" size="18px" />
        <span>Реквизиты оператора не заполнены: задайте OPERATOR_NAME, OPERATOR_INN и OPERATOR_ADDRESS в настройках сервера.</span>
      </div>

      <article class="lg__body">
        <p class="lg__lead">{{ d.lead }}</p>
        <section v-for="s in d.sections" :key="s.title">
          <h2>{{ s.title }}</h2>
          <template v-for="(item, i) in s.items" :key="i">
            <ul v-if="typeof item === 'object'">
              <li v-for="li in item.list" :key="li">{{ li }}</li>
            </ul>
            <p v-else>{{ item }}</p>
          </template>
        </section>
      </article>
    </div>
  </div>
</template>

<style scoped lang="scss">
.lg__wrap {
  max-width: 800px;
  margin: 0 auto;
  padding: 40px 20px 80px;
}
.lg__tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 4px;
  border-radius: 12px;
  background: var(--ft-surface-3);
  margin-bottom: 28px;
  a {
    padding: 7px 12px;
    border-radius: 9px;
    color: var(--ft-text-2);
    font-weight: 600;
    font-size: 13px;
    &:hover {
      text-decoration: none;
      color: var(--ft-text);
    }
    &.active {
      background: var(--ft-surface);
      color: var(--ft-text);
      box-shadow: var(--ft-shadow-xs);
    }
  }
}
.lg__title {
  margin: 0;
  font-family: var(--ft-font-display);
  font-size: clamp(26px, 4vw, 38px);
  font-weight: 600;
  line-height: 1.15;
}
.lg__rev {
  margin-top: 8px;
  color: var(--ft-muted);
  font-size: 13.5px;
}
.lg__note {
  display: flex;
  gap: 10px;
  margin-top: 20px;
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--ft-info-soft);
  color: var(--ft-text-2);
  font-size: 13.5px;
  line-height: 1.5;
  .q-icon {
    color: var(--ft-info);
    flex: none;
    margin-top: 1px;
  }
}
.lg__note--warn {
  background: var(--ft-warning-soft);
  .q-icon {
    color: var(--ft-warning);
  }
}
.lg__body {
  margin-top: 24px;
  font-size: 15px;
  line-height: 1.7;
  color: var(--ft-text-2);
  h2 {
    margin: 30px 0 8px;
    font-size: 18px;
    font-weight: 700;
    color: var(--ft-text);
  }
  p {
    margin: 0 0 10px;
  }
  ul {
    padding-left: 22px;
    margin: 0 0 10px;
    li + li {
      margin-top: 4px;
    }
  }
}
.lg__lead {
  font-size: 16.5px;
  color: var(--ft-text) !important;
}
</style>
