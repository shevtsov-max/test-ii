<script setup>
// Декоративная схема древа (иллюстрация для лендинга и страниц входа)
const W = 118
const H = 46
const cards = [
  { x: 20, y: 30, g: 'M' },
  { x: 150, y: 30, g: 'F' },
  { x: 290, y: 30, g: 'M' },
  { x: 420, y: 30, g: 'F' },
  { x: 85, y: 150, g: 'M' },
  { x: 355, y: 150, g: 'F' },
  { x: 40, y: 270, g: 'F' },
  { x: 220, y: 270, g: 'M', me: true },
  { x: 400, y: 270, g: 'F' },
]
const c = (i) => ({ x: cards[i].x + W / 2, y: cards[i].y + H / 2 })
const couple = (a, b) => `M ${cards[a].x + W} ${c(a).y} L ${cards[b].x} ${c(b).y}`
const drop = (ax, ay, kids, busY) =>
  kids
    .map((k) => {
      const kx = c(k).x
      const r = Math.min(10, Math.abs(kx - ax) / 2)
      const s = Math.sign(kx - ax) || 1
      return `M ${ax} ${ay} L ${ax} ${busY - r} Q ${ax} ${busY} ${ax + s * r} ${busY} L ${kx - s * r} ${busY} Q ${kx} ${busY} ${kx} ${busY + r} L ${kx} ${cards[k].y}`
    })
    .join(' ')
const paths = [
  couple(0, 1),
  couple(2, 3),
  couple(4, 5),
  drop((cards[0].x + W + cards[1].x) / 2, c(0).y, [4], 118),
  drop((cards[2].x + W + cards[3].x) / 2, c(2).y, [5], 118),
  drop((cards[4].x + W + cards[5].x) / 2, c(4).y, [6, 7, 8], 238),
]
</script>

<template>
  <svg viewBox="0 0 560 340" class="ht" aria-hidden="true">
    <path v-for="(d, i) in paths" :key="i" :d="d" class="ht__line" />
    <g v-for="(k, i) in cards" :key="i" :transform="`translate(${k.x} ${k.y})`">
      <g :class="['ht__card', `g-${k.g}`, { me: k.me }]" :style="{ animationDelay: i * 70 + 'ms' }">
        <rect :width="W" :height="H" rx="11" class="ht__bg" />
        <circle cx="23" :cy="H / 2" r="14" class="ht__av" />
        <rect x="44" y="14" :width="k.me ? 56 : 50" height="7" rx="3.5" class="ht__t1" />
        <rect x="44" y="27" width="34" height="6" rx="3" class="ht__t2" />
      </g>
    </g>
  </svg>
</template>

<style scoped lang="scss">
.ht {
  width: 100%;
  height: auto;
  overflow: visible;
}
.ht__line {
  fill: none;
  stroke: var(--ft-line);
  stroke-width: 1.6;
  stroke-linecap: round;
}
.ht__card {
  animation: pop 0.6s var(--ft-ease) both;
  --g: var(--ft-unknown);
  &.g-M {
    --g: var(--ft-male);
    --gs: var(--ft-male-soft);
  }
  &.g-F {
    --g: var(--ft-female);
    --gs: var(--ft-female-soft);
  }
}
.ht__bg {
  fill: var(--ft-surface);
  stroke: color-mix(in srgb, var(--g) 50%, transparent);
  stroke-width: 1.5;
  filter: drop-shadow(0 4px 10px rgba(30, 24, 16, 0.08));
}
.ht__av {
  fill: var(--gs);
}
.ht__t1 {
  fill: color-mix(in srgb, var(--ft-text) 70%, transparent);
}
.ht__t2 {
  fill: color-mix(in srgb, var(--ft-muted) 45%, transparent);
}
.me .ht__bg {
  fill: var(--ft-primary);
  stroke: var(--ft-primary);
}
.me .ht__av {
  fill: #fff;
}
.me .ht__t1,
.me .ht__t2 {
  fill: rgba(255, 255, 255, 0.85);
}
@keyframes pop {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
}
</style>
