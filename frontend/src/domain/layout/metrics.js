/**
 * Размеры карточек и отступов для схем древа. Три плотности: компактная, обычная, подробная.
 */

const BASE = {
  compact: { W: 176, H: 68 },
  normal: { W: 220, H: 94 },
  detailed: { W: 244, H: 122 },
}

/**
 * @param {'compact' | 'normal' | 'detailed'} density
 */
export function chartMetrics(density = 'normal') {
  const { W, H } = BASE[density] ?? BASE.normal
  const ROW_GAP = density === 'compact' ? 76 : 92
  return {
    density,
    W,
    H,
    /** Между карточками пары */
    COUPLE_GAP: density === 'compact' ? 28 : 36,
    /** Между братьями/сёстрами */
    SIB_GAP: density === 'compact' ? 18 : 26,
    /** Между группами (семьями) */
    GROUP_GAP: density === 'compact' ? 34 : 46,
    /** Заглушки «Добавить отца / мать» */
    PH_W: Math.round(W * 0.46),
    PH_H: Math.round(H * 0.7),
    /** Зазор между парой заглушек: штрихи 5/5 видны у обоих блоков */
    PH_PAIR_GAP: 35,
    ROW_GAP,
    ROW_H: H + ROW_GAP,
    /** Радиус скругления линий */
    R: 10,
  }
}

/** Подписи поколений относительно центральной персоны. */
export function generationLabel(rel) {
  if (rel === 0) return 'Своё поколение'
  if (rel === -1) return 'Родители'
  if (rel === -2) return 'Бабушки и дедушки'
  if (rel === -3) return 'Прадеды'
  if (rel < -3) return `${'пра'.repeat(-rel - 2)}деды`.replace(/^./, (c) => c.toUpperCase())
  if (rel === 1) return 'Дети'
  if (rel === 2) return 'Внуки'
  if (rel === 3) return 'Правнуки'
  return `${'пра'.repeat(rel - 2)}внуки`.replace(/^./, (c) => c.toUpperCase())
}
