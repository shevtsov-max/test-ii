import { describe, it, expect } from 'vitest'
import { romanovTree } from '@/data/romanovs'
import { demoTree } from '@/data/seed'
import { FamilyGraph } from '@/domain/graph'
import { computeChart } from '@/domain/layout'

function overlaps(nodes) {
  const byRow = new Map()
  for (const n of nodes) {
    const key = n.row ?? n.gen
    const arr = byRow.get(key) ?? []
    arr.push(n)
    byRow.set(key, arr)
  }
  const bad = []
  for (const arr of byRow.values()) {
    arr.sort((a, b) => a.left - b.left)
    for (let i = 1; i < arr.length; i++) if (arr[i].left < arr[i - 1].left + arr[i - 1].w - 0.5 && (arr[i].row !== undefined)) bad.push([arr[i - 1].key, arr[i].key])
  }
  return bad
}

describe('layouts', () => {
  for (const [name, mk, focus] of [['romanovs', romanovTree, 'nik2'], ['romanovs-charles', romanovTree, 'charles'], ['demo', demoTree, 'me']]) {
    for (const scope of ['direct', 'family', 'blood', 'all']) {
      it(`${name} ${scope}`, () => {
        const G = new FamilyGraph(mk())
        const t0 = performance.now()
        const L = computeChart(G, focus, { view: 'tree', scope, up: 4, down: 3, density: 'normal', placeholders: true })
        const ms = performance.now() - t0
        const bad = overlaps(L.nodes)
        console.log(name, scope, 'nodes', L.nodes.length, 'edges', L.edges.length, 'overlaps', bad.length, ms.toFixed(1) + 'ms', 'width', Math.round(L.bounds.maxX - L.bounds.minX))
        expect(bad).toEqual([])
      })
    }
  }
  it('pedigree', () => {
    const G = new FamilyGraph(romanovTree())
    const L = computeChart(G, 'charles', { view: 'pedigree', scope: 'family', up: 6, down: 1, density: 'normal', placeholders: true })
    console.log('pedigree nodes', L.nodes.length, L.edges.length)
    expect(L.nodes.length).toBeGreaterThan(5)
  })
})
