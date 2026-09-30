/**
 * Контурная упаковка (как в алгоритме Reingold–Tilford): у каждой фигуры для каждой строки
 * хранится занятый отрезок [min, max]. Фигуры сдвигаются вплотную без пересечений.
 */

export class Shape {
  nodes = []
  links = []
  /** @type {Map<number, [number, number]>} */
  contour = new Map()

  add(n) {
    this.nodes.push(n)
    this.extend(n.row, n.x - n.w / 2, n.x + n.w / 2)
    return n
  }

  extend(row, a, b) {
    const c = this.contour.get(row)
    if (!c) this.contour.set(row, [a, b])
    else {
      if (a < c[0]) c[0] = a
      if (b > c[1]) c[1] = b
    }
  }

  shift(dx) {
    if (!dx) return
    for (const n of this.nodes) n.x += dx
    for (const c of this.contour.values()) {
      c[0] += dx
      c[1] += dx
    }
  }

  merge(o) {
    for (const n of o.nodes) this.nodes.push(n)
    for (const l of o.links) this.links.push(l)
    for (const [r, [a, b]] of o.contour) this.extend(r, a, b)
  }

  get minX() {
    let m = Infinity
    for (const [a] of this.contour.values()) m = Math.min(m, a)
    return m
  }
  get maxX() {
    let m = -Infinity
    for (const [, b] of this.contour.values()) m = Math.max(m, b)
    return m
  }
}

export const constGap = (g) => () => g

/** Сдвиг, который нужно применить к B, чтобы он оказался справа от A. */
export function rightOffset(A, B, gap) {
  let dx = -Infinity
  let common = false
  for (const [r, [, amax]] of A.contour) {
    const bc = B.contour.get(r)
    if (!bc) continue
    common = true
    dx = Math.max(dx, amax + gap(r) - bc[0])
  }
  if (!common) {
    if (!A.nodes.length || !B.nodes.length) return 0
    return A.maxX + gap(0) - B.minX
  }
  return dx
}

/** Максимальный сдвиг B (может быть отрицательным), при котором B остаётся слева от A. */
export function leftLimit(A, B, gap) {
  let dx = Infinity
  for (const [r, [amin]] of A.contour) {
    const bc = B.contour.get(r)
    if (!bc) continue
    dx = Math.min(dx, amin - gap(r) - bc[1])
  }
  return dx
}

export function packRow(shapes, gap) {
  const out = new Shape()
  for (const s of shapes) {
    if (out.nodes.length) s.shift(rightOffset(out, s, gap))
    out.merge(s)
  }
  return out
}

export const centerOf = (nodes) => {
  if (!nodes.length) return 0
  let lo = Infinity
  let hi = -Infinity
  for (const n of nodes) {
    if (n.x < lo) lo = n.x
    if (n.x > hi) hi = n.x
  }
  return (lo + hi) / 2
}

/** На сколько B должен сдвинуться вправо, чтобы не пересекаться с A в общих строках (−∞, если общих строк нет). */
export function overlapShift(A, B, gap) {
  let dx = -Infinity
  for (const [r, [, amax]] of A.contour) {
    const bc = B.contour.get(r)
    if (bc) dx = Math.max(dx, amax + gap - bc[0])
  }
  return dx
}
