/**
 * Stacking of overlapping labels, without the DOM: given where each label sits
 * when it has no margin, work out the margin-top that moves it below the
 * labels it would otherwise cover. The Regions plugin measures the labels once,
 * calls this, and writes the margins back, so a pass costs one layout and
 * time in proportion to the overlaps, not to the number of labels squared.
 */

/** A label's box in the same coordinates for every label, as getBoundingClientRect() reports it */
export type LabelBox = {
  left: number
  right: number
  top: number
  height: number
}

/** The space left between a label and the one it was moved below, in pixels */
const GAP = 2

// Labels are looked up by the columns of this width they span
const COLUMN_WIDTH = 128

// A label spanning more columns than this is checked against every other label instead
const MAX_COLUMNS = 32

/**
 * The margin-top, in pixels, for each label, which are placed in the order
 * given: a label is moved down until it clears every earlier label that is
 * horizontally in its way, so earlier labels keep their place and later ones
 * make room. A label that is moved is measured at the position it was moved
 * to when later ones are placed around it.
 *
 * A label may be given a floor, a margin it starts from and is not moved above, for keeping a label
 * where it was put: it is still moved further down if it needs to be to clear the earlier ones. Given
 * the margins a layout came out with as the floors, the same labels come out as they were.
 *
 * @param boxes where each label sits with a margin of 0, in placing order
 * @param floors the least margin-top of each label, in the same order; none, or one that is not a
 *   positive number, is no floor
 * @returns the margin-top for each label, in the same order
 */
export function computeLabelMargins(boxes: LabelBox[], floors?: number[]): number[] {
  const margins = new Array<number>(boxes.length).fill(0)
  // Where each label ended up, vertically, once its margin was applied
  const placedTop = new Array<number>(boxes.length).fill(0)
  const placedBottom = new Array<number>(boxes.length).fill(0)

  // Placed labels, by the columns they span; those too wide for that are kept apart
  const columns = new Map<number, number[]>()
  const wide: number[] = []
  // The label a candidate was last looked at for, so one that spans several columns is checked once
  const lookedAt = new Array<number>(boxes.length).fill(-1)

  for (let i = 0; i < boxes.length; i++) {
    const box = boxes[i]
    const candidates: number[] = []

    const consider = (j: number) => {
      if (lookedAt[j] === i) return
      lookedAt[j] = i
      const other = boxes[j]
      if (box.left < other.right && other.left < box.right) candidates.push(j)
    }

    const first = Math.floor(box.left / COLUMN_WIDTH)
    const last = Math.floor(box.right / COLUMN_WIDTH)
    const gridded = Number.isFinite(first) && Number.isFinite(last) && last - first <= MAX_COLUMNS

    if (gridded) {
      wide.forEach(consider)
      for (let column = first; column <= last; column++) columns.get(column)?.forEach(consider)
    } else {
      for (let j = 0; j < i; j++) consider(j)
    }

    // Among the labels in the way, the highest first, and those level in the order they were placed
    candidates.sort((a, b) => placedTop[a] - placedTop[b] || a - b)

    const floor = floors?.[i]
    let margin = floor !== undefined && Number.isFinite(floor) && floor > 0 ? floor : 0
    for (const j of candidates) {
      const top = box.top + margin
      const bottom = top + box.height
      if (top < placedBottom[j] && placedTop[j] < bottom) {
        margin = placedBottom[j] - box.top + GAP
      }
    }

    margins[i] = margin
    placedTop[i] = box.top + margin
    placedBottom[i] = placedTop[i] + box.height

    if (gridded) {
      for (let column = first; column <= last; column++) {
        const placed = columns.get(column)
        if (placed) placed.push(i)
        else columns.set(column, [i])
      }
    } else {
      wide.push(i)
    }
  }

  return margins
}
