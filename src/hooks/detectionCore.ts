export type DetectionOptions = {
  frames: number
  threshold: number
  hysteresis: number
  minSlope: number
  suddenDelta: number
  smoothingWindow: number
  allowSizeOnly: boolean
}

export type DetectionResult = {
  newDetected: boolean
  smoothed: number
  slope: number
  avgConfidence: number | null
}

export function analyzeDetection(
  heights: number[],
  confidences: number[],
  previousDetected: boolean,
  options: DetectionOptions
): DetectionResult {
  const {
    frames,
    threshold,
    hysteresis,
    minSlope,
    suddenDelta,
    smoothingWindow,
    allowSizeOnly,
  } = options

  function average(arr: number[]) {
    if (!arr || arr.length === 0) return 0
    return arr.reduce((s, v) => s + v, 0) / arr.length
  }

  function movingAverageSeries(values: number[], window: number) {
    const out: number[] = []
    for (let i = 0; i < values.length; i++) {
      const start = Math.max(0, i - (window - 1))
      let s = 0
      let count = 0
      for (let j = start; j <= i; j++) {
        s += values[j]
        count++
      }
      out.push(s / count)
    }
    return out
  }

  function linearRegressionSlope(values: number[]) {
    const n = values.length
    if (n <= 1) return 0
    const meanX = (n - 1) / 2
    const meanY = average(values)
    let num = 0
    let denom = 0
    for (let i = 0; i < n; i++) {
      const dx = i - meanX
      num += dx * (values[i] - meanY)
      denom += dx * dx
    }
    return denom === 0 ? 0 : num / denom
  }

  const raw = heights.slice(-frames)
  const confRaw = confidences.slice(-frames)

  const smoothSeries = movingAverageSeries(raw, smoothingWindow)
  const smoothed = smoothSeries[smoothSeries.length - 1] ?? 0

  const regressionWindow = Math.max(2, Math.min(smoothSeries.length, frames))
  const regressionValues = smoothSeries.slice(smoothSeries.length - regressionWindow)
  const slope = linearRegressionSlope(regressionValues)

  const avgConfidence = confRaw.length ? average(confRaw) : null

  const enterThreshold = threshold
  const exitThreshold = Math.max(0, threshold - hysteresis)
  const instantDelta = Math.min(0.15, hysteresis * 3)
  const instantClose = smoothed >= enterThreshold + instantDelta
  const prevSmoothed = smoothSeries.length >= 2 ? smoothSeries[smoothSeries.length - 2] : null
  const suddenIncrease = prevSmoothed != null && smoothed - prevSmoothed >= suddenDelta

  let newDetected = previousDetected

  // Use either smoothed value or the latest raw measurement to trigger detection.
  const latestRaw = raw[raw.length - 1] ?? 0
  const crossesEnter = (smoothed >= enterThreshold || latestRaw >= enterThreshold)
    && (allowSizeOnly || slope >= minSlope)

  if (!previousDetected) {
    if (crossesEnter || instantClose || suddenIncrease) {
      newDetected = true
    }
  } else {
    if ((smoothed <= exitThreshold && latestRaw <= enterThreshold) || slope <= -minSlope) {
      newDetected = false
    }
  }

  return { newDetected, smoothed, slope, avgConfidence }
}
