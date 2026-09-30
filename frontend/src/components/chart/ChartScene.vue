<script setup>
/**
 * Содержимое схемы древа в SVG: линии, значки пар, карточки, заглушки.
 * Только рисование — перемещение камеры и выбор делает TreeChart.
 * Цвета задаются атрибутами (палитра), поэтому та же сцена годится для экспорта.
 */
import { computed } from 'vue'
import { cardGeom, cardModel } from './card'
import { svgIcon } from './icons'
import { font } from './text'
import { statusInfo } from '@/domain/model'

const props = defineProps({
  nodes: { type: Array, required: true },
  edges: { type: Array, required: true },
  tree: { type: Object, required: true },
  metrics: { type: Object, required: true },
  palette: { type: Object, required: true },
  opts: { type: Object, required: true },
  relationOf: { type: Function, default: () => '' },
  lod: { type: String, default: 'full' },
  selectedId: { type: String, default: null },
  homeId: { type: String, default: null },
  /** Персоны из переданных родственникам веток (Set): замок на карточке, без кнопок правки */
  locked: { type: Object, default: null },
  highlight: { type: Object, default: null },
  dim: Boolean,
  interactive: Boolean,
  animate: Boolean,
  entering: { type: Object, default: null },
  pulseKey: { type: String, default: null },
  idPrefix: { type: String, default: 'c' },
  fontsVersion: { type: Number, default: 0 },
})
const emit = defineEmits(['select', 'open', 'add', 'edit', 'expand', 'placeholder', 'context', 'badge', 'hover'])

const P = computed(() => props.palette)
const G = computed(() => cardGeom(props.metrics))
const id = (s) => `${props.idPrefix}-${s}`

// Кеш содержимого карточек: пересчитывается при смене персоны или настроек
const cache = new WeakMap()
const sig = computed(() => JSON.stringify([props.opts, props.metrics.density, props.palette.surface, props.fontsVersion, props.homeId]))
function model(n) {
  const p = props.tree.persons[n.personId]
  if (!p) return null
  const key = sig.value + '|' + n.row + '|' + (props.opts.relation ? props.relationOf(p.id) : '')
  let entry = cache.get(p)
  if (entry?.key === key) return entry.m
  const m = cardModel(p, {
    tree: props.tree,
    opts: props.opts,
    M: props.metrics,
    P: props.palette,
    relation: props.opts.relation && p.id !== props.homeId ? props.relationOf(p.id) : '',
    row: n.row,
  })
  cache.set(p, { key, m })
  return m
}

const avatarSrc = (p) => {
  if (!props.opts.photos || !p?.avatarId) return null
  const m = props.tree.media?.[p.avatarId]
  return m?.thumb ?? m?.src ?? null
}

const hl = (e) => !!props.highlight && e.persons.length > 1 && e.persons.every((x) => props.highlight.has(x))
const sortedEdges = computed(() => {
  if (!props.highlight) return props.edges
  const a = []
  const b = []
  for (const e of props.edges) (hl(e) ? b : a).push(e)
  return [...a, ...b]
})
const badges = computed(() => props.edges.filter((e) => e.badge && e.familyId))

function nodeStyle(n) {
  const st = { transform: `translate(${n.left}px, ${n.top}px)` }
  const en = props.entering
  if (en?.keys.has(n.key)) {
    st['--fx'] = en.origin.left - n.left + 'px'
    st['--fy'] = en.origin.top - n.top + 'px'
    st['--delay'] = Math.min(800, 260 + Math.abs((n.row ?? 0) - (en.origin.row ?? 0)) * 120) + 'ms'
  }
  return st
}
const isDim = (n) => props.dim && props.highlight && n.personId && !props.highlight.has(n.personId)

function edgeStroke(e) {
  if (hl(e)) return { stroke: P.value.lineStrong, 'stroke-width': 2.6 }
  return { stroke: P.value.line, 'stroke-width': e.kind === 'couple' || e.kind === 'arc' ? 1.8 : 1.6 }
}
const dash = (e) => (e.dashed ? (e.childLink ? '7 5' : '5 5') : e.status === 'divorced' || e.status === 'separated' ? '2 5' : undefined)

const icon = (name) => svgIcon(name)
const statusIcon = (s) => svgIcon(statusInfo(s).icon)
function statusColor(s) {
  if (s === 'married' || s === 'widowed') return P.value.primary
  if (s === 'engaged' || s === 'partners') return '#8B5CF6'
  return P.value.muted
}

const on = (name, n, e) => {
  if (props.interactive) emit(name, n, e)
}
</script>

<template>
  <g class="cs" :class="[`cs--${lod}`, { 'cs--anim': animate, 'cs--interactive': interactive }]" font-family="'Inter Variable', Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif">
    <defs>
      <clipPath :id="id('card')"><rect :width="G.W" :height="G.H" :rx="G.R" /></clipPath>
      <clipPath :id="id('av')" clipPathUnits="objectBoundingBox"><circle cx="0.5" cy="0.5" r="0.5" /></clipPath>
      <linearGradient :id="id('home')" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" :stop-color="P.primary2" />
        <stop offset="0.55" :stop-color="P.primary" />
        <stop offset="1" :stop-color="P.primaryDark" />
      </linearGradient>
    </defs>

    <!-- Линии -->
    <g class="cs__edges">
      <path
        v-for="e in sortedEdges"
        :key="e.key"
        :d="e.d"
        fill="none"
        v-bind="edgeStroke(e)"
        :stroke-dasharray="dash(e)"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="cs__edge"
        :style="animate ? { d: `path('${e.d}')` } : undefined"
      />
    </g>

    <!-- Значки пар (статус отношений) -->
    <g v-if="lod !== 'dots'" class="cs__badges">
      <g
        v-for="e in badges"
        :key="'b-' + e.key"
        class="cs__badge"
        :transform="`translate(${e.badge.x} ${e.badge.y})`"
        @click.stop="on('badge', e)"
        @pointerdown.stop
      >
        <title>{{ statusInfo(e.status).label }} — изменить отношения</title>
        <circle r="11" :fill="P.surface" :stroke="P.line" stroke-width="1.5" />
        <svg v-if="statusIcon(e.status)" x="-7" y="-7" width="14" height="14" :viewBox="statusIcon(e.status).viewBox">
          <path v-for="(d, i) in statusIcon(e.status).paths" :key="i" :d="d" :fill="statusColor(e.status)" />
        </svg>
      </g>
    </g>

    <!-- Карточки -->
    <TransitionGroup tag="g" name="nd" move-class="nd-nomove" class="cs__nodes">
      <g
        v-for="n in nodes"
        :key="n.key"
        class="nd"
        :class="{
          'nd--sel': n.personId && n.personId === selectedId,
          'nd--dim': isDim(n),
          'nd--enter': entering?.keys.has(n.key),
          'nd--pulse': pulseKey === n.key,
        }"
        :style="nodeStyle(n)"
        :data-key="n.key"
        @pointerenter="on('hover', n)"
        @pointerleave="on('hover', null)"
      >
        <g class="nd__in">
          <!-- Заглушка «Добавить отца / мать» -->
          <g v-if="n.kind === 'placeholder'" class="nd__ph" @click.stop="on('placeholder', n, $event)">
            <rect
              :width="n.w"
              :height="n.h"
              rx="12"
              :fill="P.surface"
              fill-opacity="0.55"
              :stroke="n.role === 'father' ? P.male : P.female"
              stroke-opacity="0.6"
              stroke-width="1.5"
              stroke-dasharray="5 4"
            />
            <text :x="n.w / 2" :y="n.h / 2 - 3" text-anchor="middle" :fill="P.muted" :font-size="lod === 'full' ? 12 : 16" font-weight="600">+ Добавить</text>
            <text :x="n.w / 2" :y="n.h / 2 + 13" text-anchor="middle" :fill="P.muted" :font-size="lod === 'full' ? 12 : 16">{{ n.role === 'father' ? 'отца' : 'мать' }}</text>
          </g>

          <template v-else-if="model(n)">
            <!-- Точки (сильное отдаление) -->
            <g v-if="lod === 'dots'" @click.stop="on('select', n, $event)" @dblclick.stop="on('open', n, $event)">
              <rect :width="n.w" :height="n.h" :rx="G.R" :fill="n.personId === homeId ? P.primary : model(n).soft" :stroke="model(n).accent" stroke-width="3" />
            </g>

            <!-- Упрощённая карточка (отдаление) -->
            <g v-else-if="lod === 'simple'" @click.stop="on('select', n, $event)" @dblclick.stop="on('open', n, $event)" @contextmenu.prevent.stop="on('context', n, $event)">
              <rect :width="n.w" :height="n.h" :rx="G.R" :fill="n.personId === homeId ? `url(#${id('home')})` : P.surface" :stroke="model(n).accent" stroke-width="2.5" />
              <rect x="0" y="0" width="7" :height="n.h" :fill="model(n).accent" :clip-path="`url(#${id('card')})`" />
              <text
                :x="n.w / 2 + 3"
                :y="n.h / 2 - 2"
                text-anchor="middle"
                :fill="n.personId === homeId ? '#fff' : P.text"
                :font-size="22"
                font-weight="700"
              >{{ tree.persons[n.personId].firstName || '—' }}</text>
              <text :x="n.w / 2 + 3" :y="n.h / 2 + 22" text-anchor="middle" :fill="n.personId === homeId ? '#fff' : P.muted" :font-size="18" font-weight="600">
                {{ tree.persons[n.personId].lastName || tree.persons[n.personId].birthName }}
              </text>
            </g>

            <!-- Полная карточка -->
            <g v-else @click.stop="on('select', n, $event)" @dblclick.stop="on('open', n, $event)" @contextmenu.prevent.stop="on('context', n, $event)">
              <rect
                v-if="n.personId === selectedId && interactive"
                x="-5"
                y="-5"
                :width="n.w + 10"
                :height="n.h + 10"
                :rx="G.R + 5"
                fill="none"
                :stroke="P.primary"
                stroke-opacity="0.35"
                stroke-width="4"
              />
              <rect x="0" y="3" :width="n.w" :height="n.h" :rx="G.R" :fill="P.shadow" />
              <g :clip-path="`url(#${id('card')})`">
                <rect :width="n.w" :height="n.h" :fill="n.personId === homeId ? `url(#${id('home')})` : P.surface" />
                <rect v-if="n.personId !== homeId" :width="4" :height="n.h" :fill="model(n).accent" />
                <rect v-if="n.focus && n.personId !== homeId" x="4" :width="n.w" :height="n.h" :fill="model(n).soft" fill-opacity="0.55" />
              </g>
              <rect
                :width="n.w"
                :height="n.h"
                :rx="G.R"
                fill="none"
                :stroke="n.personId === homeId ? P.primaryDark : model(n).accent"
                :stroke-opacity="n.focus || n.personId === homeId ? 1 : 0.45"
                :stroke-width="n.focus ? 2 : 1.3"
                :stroke-dasharray="n.dup ? '6 4' : undefined"
              />

              <!-- Аватар -->
              <g :transform="`translate(${G.avX} ${(n.h - G.av) / 2})`">
                <circle :cx="G.av / 2" :cy="G.av / 2" :r="G.av / 2" :fill="n.personId === homeId ? '#fff' : model(n).gender[1]" />
                <image
                  v-if="avatarSrc(tree.persons[n.personId])"
                  :href="avatarSrc(tree.persons[n.personId])"
                  :width="G.av"
                  :height="G.av"
                  preserveAspectRatio="xMidYMid slice"
                  :clip-path="`url(#${id('av')})`"
                />
                <svg v-else :width="G.av" :height="G.av" viewBox="0 0 64 64">
                  <g :fill="model(n).gender[0]">
                    <template v-if="tree.persons[n.personId].gender === 'F'">
                      <path
                        fill-opacity="0.55"
                        d="M32 11c-10 0-15.5 7.5-15.5 17 0 7 1.5 13-2.5 18 4 1.5 8 1.8 11 1.2L32 50l7-2.8c3 .6 7 .3 11-1.2-4-5-2.5-11-2.5-18 0-9.5-5.5-17-15.5-17z"
                      />
                      <circle cx="32" cy="29" r="10.5" fill-opacity="0.3" />
                      <path d="M12 64c1.5-11 9.5-16 20-16s18.5 5 20 16z" fill-opacity="0.42" />
                    </template>
                    <template v-else>
                      <circle cx="32" cy="26" r="11.5" fill-opacity="0.3" />
                      <path d="M20.5 24c0-8 5-12.5 11.5-12.5S43.5 16 43.5 24c-2-4-6-6-11.5-6s-9.5 2-11.5 6z" fill-opacity="0.55" />
                      <path d="M11 64c1.5-12 10-17.5 21-17.5S51.5 52 53 64z" fill-opacity="0.42" />
                    </template>
                  </g>
                </svg>
                <circle
                  :cx="G.av / 2"
                  :cy="G.av / 2"
                  :r="G.av / 2 - 0.75"
                  fill="none"
                  :stroke="n.personId === homeId ? '#fff' : model(n).gender[0]"
                  stroke-opacity="0.9"
                  stroke-width="1.5"
                />
              </g>

              <!-- Текст -->
              <template v-if="n.personId === homeId">
                <g :transform="`translate(${G.tx} ${G.rel.y - G.rel.size + 1})`">
                  <svg v-if="icon('sym_r_home')" :width="G.rel.size + 2" :height="G.rel.size + 2" :viewBox="icon('sym_r_home').viewBox">
                    <path v-for="(d, i) in icon('sym_r_home').paths" :key="i" :d="d" fill="#fff" />
                  </svg>
                </g>
                <text :x="G.tx + G.rel.size + 5" :y="G.rel.y" fill="#fff" :font-size="G.rel.size" font-weight="750" letter-spacing="0.06em">ЭТО ВЫ</text>
              </template>
              <text v-else-if="model(n).rel" :x="G.tx" :y="G.rel.y" :fill="model(n).accent" :font-size="G.rel.size" font-weight="650">
                {{ model(n).rel }}
              </text>
              <text
                v-for="(line, i) in model(n).lines"
                :key="i"
                :x="G.tx"
                :y="G.name.y + i * G.name.lh + (model(n).lines.length === 1 && G.name.lines === 2 ? G.name.lh / 2 : 0)"
                :fill="n.personId === homeId ? '#fff' : P.text"
                :font-size="G.name.size"
                :font-weight="i === 1 ? 700 : 600"
              >
                {{ line }}
              </text>
              <text v-if="model(n).years" :x="G.tx" :y="G.years.y" :fill="n.personId === homeId ? 'rgba(255,255,255,0.88)' : P.muted" :font-size="G.years.size" font-weight="500">
                {{ model(n).years }}
              </text>
              <template v-for="x in G.extra" :key="x.key">
                <text v-if="model(n).extra[x.key]" :x="G.tx" :y="x.y" :fill="n.personId === homeId ? 'rgba(255,255,255,0.85)' : P.muted" :font-size="x.size">
                  {{ model(n).extra[x.key] }}
                </text>
              </template>

              <!-- Избранное и повтор -->
              <path
                v-if="tree.persons[n.personId].favorite"
                :transform="`translate(${n.w - (locked?.has(n.personId) ? 40 : 22)} 6) scale(0.62)`"
                d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"
                :fill="P.star"
              />
              <g v-if="locked?.has(n.personId) && icon('sym_r_lock')" :transform="`translate(${n.w - 21} 7)`">
                <title>Ветку ведёт родственник — только просмотр</title>
                <svg width="14" height="14" :viewBox="icon('sym_r_lock').viewBox">
                  <path v-for="(d, i) in icon('sym_r_lock').paths" :key="i" :d="d" :fill="n.personId === homeId ? '#fff' : P.muted" />
                </svg>
              </g>
              <title v-if="n.dup">Эта персона уже есть на схеме — здесь показан повтор</title>
            </g>
          </template>

          <!-- Кнопки (только на экране) -->
          <template v-if="interactive && n.kind === 'person' && lod === 'full'">
            <g v-if="n.moreUp" class="nd__btn nd__btn--show" :transform="`translate(${n.w / 2} -1)`" @click.stop="on('expand', n, 'up')" @pointerdown.stop>
              <title>Показать предков</title>
              <circle r="11" :fill="model(n)?.accent ?? P.line" />
              <svg v-if="icon('sym_r_keyboard_arrow_up')" x="-8" y="-8" width="16" height="16" :viewBox="icon('sym_r_keyboard_arrow_up').viewBox">
                <path v-for="(d, i) in icon('sym_r_keyboard_arrow_up').paths" :key="i" :d="d" fill="#fff" />
              </svg>
            </g>
            <g v-if="n.moreDown" class="nd__btn nd__btn--show" :transform="`translate(${n.w - 22} ${n.h + 1})`" @click.stop="on('expand', n, 'down')" @pointerdown.stop>
              <title>Показать потомков ({{ n.hiddenKids }})</title>
              <rect x="-17" y="-10" width="34" height="20" rx="10" :fill="model(n)?.accent ?? P.line" />
              <svg v-if="icon('sym_r_keyboard_arrow_down')" x="-15" y="-8" width="16" height="16" :viewBox="icon('sym_r_keyboard_arrow_down').viewBox">
                <path v-for="(d, i) in icon('sym_r_keyboard_arrow_down').paths" :key="i" :d="d" fill="#fff" />
              </svg>
              <text x="7" y="4" text-anchor="middle" fill="#fff" font-size="11" font-weight="700">{{ n.hiddenKids }}</text>
            </g>
            <g v-if="!locked?.has(n.personId)" class="nd__btn nd__btn--hover" :transform="`translate(${n.w - 16} 16)`" @click.stop="on('edit', n, $event)" @pointerdown.stop>
              <title>Изменить</title>
              <circle r="12" :fill="n.personId === homeId ? 'rgba(255,255,255,0.22)' : P.surface2" />
              <svg v-if="icon('sym_r_edit')" x="-8" y="-8" width="16" height="16" :viewBox="icon('sym_r_edit').viewBox">
                <path v-for="(d, i) in icon('sym_r_edit').paths" :key="i" :d="d" :fill="n.personId === homeId ? '#fff' : P.muted" />
              </svg>
            </g>
            <g
              v-if="!locked?.has(n.personId)"
              class="nd__btn nd__btn--add"
              :class="{ 'nd__btn--show': n.personId === selectedId }" :transform="`translate(${n.w / 2} ${n.h})`" @click.stop="on('add', n, $event)" @pointerdown.stop>
              <title>Добавить родственника</title>
              <circle r="12" :fill="P.primary" :stroke="P.surface" stroke-width="2" />
              <svg v-if="icon('sym_r_add')" x="-9" y="-9" width="18" height="18" :viewBox="icon('sym_r_add').viewBox">
                <path v-for="(d, i) in icon('sym_r_add').paths" :key="i" :d="d" fill="#fff" />
              </svg>
            </g>
          </template>
        </g>
      </g>
    </TransitionGroup>
  </g>
</template>

<style scoped lang="scss">
.cs {
  font-family: 'Inter Variable', Inter, system-ui, sans-serif;
  --ease: cubic-bezier(0.22, 0.8, 0.26, 1);
}
.cs__edge {
  transition: stroke 0.2s;
}
.cs--anim .cs__edge {
  transition:
    d 0.45s var(--ease),
    stroke 0.2s;
}
.nd {
  cursor: default;
}
.cs--interactive .nd {
  cursor: pointer;
}
.cs--anim .nd {
  transition:
    transform var(--move-ms, 0.45s) var(--ease),
    opacity 0.2s;
}
.nd--dim {
  opacity: 0.35;
}
.nd__in {
  transform-box: fill-box;
}
.nd--enter .nd__in {
  animation: ndGrow 0.75s cubic-bezier(0.2, 0.8, 0.25, 1) var(--delay, 0ms) backwards;
}
.nd--pulse .nd__in {
  animation: ndPulse 0.7s ease-out 2;
}
.nd__btn {
  cursor: pointer;
  transition:
    opacity 0.15s,
    transform 0.15s;
}
.nd__btn--hover,
.nd__btn--add {
  opacity: 0;
}
.nd:hover .nd__btn--hover,
.nd:hover .nd__btn--add,
.nd__btn--show {
  opacity: 1;
}
.nd__btn:hover {
  filter: brightness(1.08);
}
.nd__ph {
  cursor: pointer;
  rect {
    transition:
      fill-opacity 0.15s,
      stroke-opacity 0.15s;
  }
  &:hover rect {
    fill-opacity: 1;
    stroke-opacity: 1;
    stroke-dasharray: none;
  }
}
.cs__badge {
  cursor: pointer;
  circle {
    transition: stroke 0.15s;
  }
  &:hover circle {
    stroke-width: 2;
  }
}
/* Перемещение карточек анимирует свой transition; FLIP из TransitionGroup затёр бы позицию */
.nd-nomove {
  transition: opacity 0.2s !important;
}
.nd-enter-active {
  animation: ndIn 0.35s ease-out;
}
.nd-leave-active {
  transition: opacity 0.3s ease;
  pointer-events: none;
}
.nd-leave-to {
  opacity: 0;
}
@keyframes ndIn {
  from {
    opacity: 0;
  }
}
@keyframes ndGrow {
  from {
    opacity: 0;
    transform: translate(var(--fx, 0), var(--fy, 0)) scale(0.55);
  }
}
@keyframes ndPulse {
  40% {
    transform: scale(1.04);
  }
}
</style>
