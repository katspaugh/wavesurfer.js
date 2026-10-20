import { computeLabelMargins, type LabelBox } from '../label-stacking.js'

const box = (left: number, width: number, top = 0, height = 10): LabelBox => ({
  left,
  right: left + width,
  top,
  height,
})

/**
 * The one-label-at-a-time algorithm the Regions plugin used before this module, for the labels to be
 * compared with: for each label in turn, the labels before it as they ended up (their position with
 * their margin), the ones horizontally in the way sorted from the highest, each moved past in turn.
 */
function reference(boxes: LabelBox[], floors: number[] = []): number[] {
  const margins: number[] = []
  boxes.forEach((own, i) => {
    const earlier = boxes.slice(0, i).map((other, j) => ({
      left: other.left,
      right: other.right,
      top: other.top + margins[j],
      bottom: other.top + margins[j] + other.height,
    }))
    const margin = earlier
      .filter((other) => own.left < other.right && other.left < own.right)
      .sort((a, b) => a.top - b.top)
      .reduce(
        (marginTop, other) => {
          const top = own.top + marginTop
          const bottom = top + own.height
          if (top < other.bottom && other.top < bottom) return other.bottom - own.top + 2
          return marginTop
        },
        floors[i] > 0 && Number.isFinite(floors[i]) ? floors[i] : 0,
      )
    margins.push(margin)
  })
  return margins
}

// A small seeded generator, so a failing layout can be reproduced
function random(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

describe('computeLabelMargins', () => {
  test('gives nothing for no labels and 0 for labels that are clear of each other', () => {
    expect(computeLabelMargins([])).toEqual([])
    expect(computeLabelMargins([box(0, 40), box(100, 40), box(300, 40)])).toEqual([0, 0, 0])
  })

  test('labels that only touch do not overlap', () => {
    expect(computeLabelMargins([box(0, 40), box(40, 40)])).toEqual([0, 0])
  })

  test('moves a label below the one it overlaps, leaving a gap', () => {
    expect(computeLabelMargins([box(0, 40), box(20, 40)])).toEqual([0, 12])
  })

  test('places a label in the first free row instead of summing all prior overlaps', () => {
    expect(computeLabelMargins([box(0, 40), box(50, 40), box(30, 40)])).toEqual([0, 0, 12])
  })

  test('stacks a chain of overlapping labels one row each', () => {
    expect(computeLabelMargins([box(0, 100), box(10, 100), box(20, 100), box(30, 100)])).toEqual([0, 12, 24, 36])
  })

  test('measures a label that was moved at the place it was moved to', () => {
    // The third overlaps only the second, which sits a row down, so it can stay in the first row
    expect(computeLabelMargins([box(0, 40), box(20, 40), box(50, 40)])).toEqual([0, 12, 0])
  })

  test("only labels in the same band of the page are in each other's way", () => {
    expect(computeLabelMargins([box(0, 40, 0), box(20, 40, 100)])).toEqual([0, 0])
  })

  test('a label of no width is in the way of a label it is inside', () => {
    expect(computeLabelMargins([box(0, 40), box(20, 0)])).toEqual([0, 12])
  })

  test('a label that spans far more than the others is in the way of all of them', () => {
    const labels = [box(0, 10000), box(50, 30), box(5000, 30), box(9990, 5)]
    expect(computeLabelMargins(labels)).toEqual(reference(labels))
    expect(computeLabelMargins(labels)).toEqual([0, 12, 12, 12])
  })

  test("labels without finite edges are in nobody's way and do not break the others", () => {
    const labels = [box(0, 40), { left: NaN, right: NaN, top: 0, height: 10 }, box(20, 40), box(-Infinity, Infinity)]
    expect(computeLabelMargins(labels)).toEqual(reference(labels))
  })

  test('gives the same margins as the one-label-at-a-time algorithm on random layouts', () => {
    const next = random(1234)
    for (let layout = 0; layout < 60; layout++) {
      const count = 1 + Math.floor(next() * 250)
      const bands = [0, 0, 0, 120]
      const labels: LabelBox[] = []
      for (let i = 0; i < count; i++) {
        const left = Math.floor(next() * 2000) - 100 + next()
        const wide = next() < 0.03
        const width = wide ? 3000 + next() * 4000 : next() < 0.1 ? 0 : next() * 90
        const height = next() < 0.05 ? 0 : 8 + next() * 20
        labels.push({ left, right: left + width, top: bands[Math.floor(next() * bands.length)], height })
      }
      expect(computeLabelMargins(labels)).toEqual(reference(labels))
    }
  })

  describe('with floors, the least margin a label may have', () => {
    const layout = (seed: number, count = 150): LabelBox[] => {
      const next = random(seed)
      return Array.from({ length: count }, () => {
        const left = Math.floor(next() * 1500) + next()
        const width = next() < 0.03 ? 3000 + next() * 3000 : next() < 0.1 ? 0 : next() * 90
        return { left, right: left + width, top: next() < 0.2 ? 120 : 0, height: 8 + next() * 20 }
      })
    }

    test('lowers a label to its floor even if nothing is in its way', () => {
      expect(computeLabelMargins([box(0, 40), box(100, 40)], [0, 30])).toEqual([0, 30])
    })

    test('moves a label further down if its floor is not enough to clear the ones before it', () => {
      expect(computeLabelMargins([box(0, 40), box(20, 40)], [0, 5])).toEqual([0, 12])
    })

    test('keeps a label at its floor when that already clears the ones before it', () => {
      expect(computeLabelMargins([box(0, 40), box(20, 40)], [0, 30])).toEqual([0, 30])
    })

    test('places the labels after a label that was lowered around it', () => {
      const labels = [box(0, 40), box(100, 40), box(20, 100)]
      // The third overlaps both. With the second left where it falls it can use the row between
      expect(computeLabelMargins(labels)).toEqual([0, 0, 12])
      // With the second kept a row down, that row is taken, and the third goes below it
      expect(computeLabelMargins(labels, [0, 12, 0])).toEqual([0, 12, 24])
    })

    test.each([[undefined], [[]], [[0, 0, 0]], [[NaN, -5, Infinity]]])('%j is no floor at all', (floors) => {
      const labels = [box(0, 40), box(20, 40), box(30, 40)]
      expect(computeLabelMargins(labels, floors as number[] | undefined)).toEqual(computeLabelMargins(labels))
    })

    test('gives the same margins as the one-label-at-a-time algorithm, whatever the floors', () => {
      const next = random(77)
      for (let seed = 0; seed < 40; seed++) {
        const labels = layout(seed + 1000)
        const floors = labels.map(() => (next() < 0.3 ? Math.floor(next() * 80) : 0))
        const margins = computeLabelMargins(labels, floors)
        expect(margins).toEqual(reference(labels, floors))
        margins.forEach((margin, i) => expect(margin).toBeGreaterThanOrEqual(floors[i]))
      }
    })

    test('leaves labels as they were put when given their margins as floors', () => {
      for (let seed = 0; seed < 40; seed++) {
        const labels = layout(seed + 2000)
        const margins = computeLabelMargins(labels)
        expect(computeLabelMargins(labels, margins)).toEqual(margins)
      }
    })

    test('never has a label cover an earlier one it overlaps, whatever the floors', () => {
      const next = random(5)
      for (let seed = 0; seed < 40; seed++) {
        const labels = layout(seed + 3000, 80)
        const floors = labels.map(() => (next() < 0.5 ? Math.floor(next() * 100) : 0))
        const margins = computeLabelMargins(labels, floors)
        labels.forEach((own, i) => {
          for (let j = 0; j < i; j++) {
            const other = labels[j]
            if (!(own.left < other.right && other.left < own.right)) continue
            const [topA, bottomA] = [own.top + margins[i], own.top + margins[i] + own.height]
            const [topB, bottomB] = [other.top + margins[j], other.top + margins[j] + other.height]
            expect(topA < bottomB && topB < bottomA).toBe(false)
          }
        })
      }
    })
  })

  test('handles tens of thousands of labels, most of them clear of each other', () => {
    const labels = Array.from({ length: 30000 }, (_, i) => box(i * 60, 40))
    const margins = computeLabelMargins(labels)
    expect(margins).toHaveLength(30000)
    expect(margins.every((margin) => margin === 0)).toBe(true)
  })
})
