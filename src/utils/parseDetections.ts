export type ParsedDetection = {
  height: number | null
  confidence: number | null
  centerX: number | null
}

export function parseDetections(result: any): ParsedDetection {
  try {
    if (!result || !Array.isArray(result)) return { height: null, confidence: null, centerX: null }

    let boxesArr: number[][] | null = null
    let scoresArr: number[] | null = null

    function extractBoxes(candidate: any): number[][] | null {
      if (candidate == null) return null
      if (Array.isArray(candidate) && candidate.length > 0 && typeof candidate[0] === 'number') {
        if (candidate.length % 4 === 0 && candidate.length >= 4) {
          const out: number[][] = []
          for (let i = 0; i + 3 < candidate.length; i += 4) {
            out.push([candidate[i], candidate[i + 1], candidate[i + 2], candidate[i + 3]])
          }
          return out
        }
        return null
      }

      // [num,4]
      if (Array.isArray(candidate) && Array.isArray(candidate[0]) && typeof candidate[0][0] === 'number') {
        // candidate is [num,4]
        if (candidate[0].length === 4) return candidate as number[][]
        // candidate is [1,num,4]
        if (Array.isArray(candidate[0]) && Array.isArray(candidate[0][0]) && typeof candidate[0][0][0] === 'number') {
          return candidate[0] as number[][]
        }
      }
      return null
    }

    function extractScores(candidate: any): number[] | null {
      if (candidate == null) return null
      if (Array.isArray(candidate) && candidate.length > 0 && typeof candidate[0] === 'number') return candidate as number[]
      if (Array.isArray(candidate) && Array.isArray(candidate[0]) && typeof candidate[0][0] === 'number') return candidate[0] as number[]
      return null
    }

    for (let i = 0; i < result.length; i++) {
      const entry = result[i]
      if (!boxesArr) boxesArr = extractBoxes(entry)
      if (!scoresArr) scoresArr = extractScores(entry)
    }

    // If we found scores but not boxes, try a second pass for nested structures
    if (!boxesArr) {
      for (let i = 0; i < result.length; i++) {
        const entry = result[i]
        try {
          if (Array.isArray(entry) && Array.isArray(entry[0])) {
            const candidate = entry[0]
            const maybeBoxes = extractBoxes(candidate)
            if (maybeBoxes) {
              boxesArr = maybeBoxes
              break
            }
          }
        } catch (e) {}
      }
    }

    if (!boxesArr || boxesArr.length === 0) return { height: null, confidence: null, centerX: null }

    // Choose scores array that matches number of boxes if possible
    if (scoresArr && scoresArr.length !== boxesArr.length) {
      for (let i = 0; i < result.length; i++) {
        const s = extractScores(result[i])
        if (s && s.length === boxesArr.length) {
          scoresArr = s
          break
        }
      }
    }

    let idx = 0
    if (scoresArr) {
      let best = -Infinity
      let bestIdx = 0
      for (let i = 0; i < Math.min(scoresArr.length, boxesArr.length); i++) {
        const s = scoresArr[i] ?? 0
        if (s > best) {
          best = s
          bestIdx = i
        }
      }
      idx = bestIdx
    }

    const box = boxesArr[idx]
    if (!box || box.length < 4) return { height: null, confidence: null, centerX: null }

    const ymin = box[0]
    const xmin = box[1]
    const ymax = box[2]
    const xmax = box[3]
    const height = Math.max(0, Math.min(1, ymax - ymin))
    const centerX = Math.max(0, Math.min(1, (xmin + xmax) / 2))
    const confidence = scoresArr ? scoresArr[idx] ?? null : null

    return { height, confidence, centerX }
  } catch (e) {
    return { height: null, confidence: null, centerX: null }
  }
}
