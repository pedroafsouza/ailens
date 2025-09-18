import * as React from 'react'
import { analyzeDetection, DetectionOptions } from './detectionCore'

function average(arr: number[]) {
  if (arr.length === 0) return 0
  let s = 0
  for (let i = 0; i < arr.length; i++) s += arr[i]
  return s / arr.length
}

export function useObstacleDetector() {
  const OBSTACLE_FRAMES = React.useMemo(() => {
    const v = parseInt(process.env.OBSTACLE_FRAMES ?? '5', 10)
    return Number.isFinite(v) && v > 1 ? Math.min(v, 30) : 5
  }, [])

  const OBSTACLE_THRESHOLD = React.useMemo(() => {
    const v = parseFloat(process.env.OBSTACLE_THRESHOLD ?? '0.35')
    return Number.isFinite(v) && v >= 0 && v <= 1 ? v : 0.35
  }, [])

  const OBSTACLE_HYSTERESIS = React.useMemo(() => {
    const v = parseFloat(process.env.OBSTACLE_HYSTERESIS ?? '0.05')
    return Number.isFinite(v) && v >= 0 && v <= 1 ? v : 0.05
  }, [])

  const OBSTACLE_SUDDEN_DELTA = React.useMemo(() => {
    const v = parseFloat(process.env.OBSTACLE_SUDDEN_DELTA ?? '0.08')
    return Number.isFinite(v) && v >= 0 ? v : 0.08
  }, [])

  const OBSTACLE_MIN_CONFIDENCE = React.useMemo(() => {
    const v = parseFloat(process.env.OBSTACLE_MIN_CONFIDENCE ?? '0.4')
    return Number.isFinite(v) && v >= 0 && v <= 1 ? v : 0.4
  }, [])

  const OBSTACLE_SPEECH_CONFIDENCE = React.useMemo(() => {
    const v = parseFloat(process.env.OBSTACLE_SPEECH_CONFIDENCE ?? '0.8')
    return Number.isFinite(v) && v >= 0 && v <= 1 ? v : 0.8
  }, [])

  const OBSTACLE_MIN_SLOPE = React.useMemo(() => {
    const v = parseFloat(process.env.OBSTACLE_MIN_SLOPE ?? '0.002')
    return Number.isFinite(v) && v >= 0 ? v : 0.002
  }, [])

  const OBSTACLE_ALLOW_SIZE_ONLY = React.useMemo(() => {
    const v = process.env.OBSTACLE_ALLOW_SIZE_ONLY ?? 'true'
    return v === 'true' || v === '1'
  }, [])

  const SMOOTHING_WINDOW = React.useMemo(() => {
    const v = parseInt(process.env.OBSTACLE_SMOOTHING_WINDOW ?? '3', 10)
    return Number.isFinite(v) && v > 0 ? Math.min(v, OBSTACLE_FRAMES) : 3
  }, [OBSTACLE_FRAMES])

  const options: DetectionOptions = React.useMemo(() => ({
    frames: OBSTACLE_FRAMES,
    threshold: OBSTACLE_THRESHOLD,
    hysteresis: OBSTACLE_HYSTERESIS,
    minSlope: OBSTACLE_MIN_SLOPE,
    suddenDelta: OBSTACLE_SUDDEN_DELTA,
    smoothingWindow: SMOOTHING_WINDOW,
    allowSizeOnly: OBSTACLE_ALLOW_SIZE_ONLY,
  }), [OBSTACLE_FRAMES, OBSTACLE_THRESHOLD, OBSTACLE_HYSTERESIS, OBSTACLE_MIN_SLOPE, OBSTACLE_SUDDEN_DELTA, SMOOTHING_WINDOW, OBSTACLE_ALLOW_SIZE_ONLY])

  const DETECTION_LOG_URL = React.useMemo(() => process.env.DETECTION_LOG_URL ?? null, [])
  const DETECTION_LOG_BATCH_SIZE = React.useMemo(() => {
    const v = parseInt(process.env.DETECTION_LOG_BATCH_SIZE ?? '20', 10)
    return Number.isFinite(v) && v > 0 ? v : 20
  }, [])
  const DETECTION_LOG_SEND_IMMEDIATE = React.useMemo(() => {
    const v = process.env.DETECTION_LOG_SEND_IMMEDIATE ?? 'false'
    return v === 'true' || v === '1'
  }, [])
  const DETECTION_LOG_MAX = React.useMemo(() => {
    const v = parseInt(process.env.DETECTION_LOG_MAX ?? '1000', 10)
    return Number.isFinite(v) && v > 0 ? v : 1000
  }, [])

  const logsRef = React.useRef<Array<any>>([])
  const [loggingEnabled, setLoggingEnabled] = React.useState<boolean>(!!DETECTION_LOG_URL)

  const enqueueLog = React.useCallback((event: any) => {
    try {
      logsRef.current.push(event)
      if (logsRef.current.length > DETECTION_LOG_MAX) {
        // drop oldest
        logsRef.current.splice(0, logsRef.current.length - DETECTION_LOG_MAX)
      }
    } catch (e) {}
  }, [DETECTION_LOG_MAX])

  const sendLogs = React.useCallback(async (events?: any[]) => {
    const url = DETECTION_LOG_URL
    if (!url) return { success: false, reason: 'no-url' }
    const toSend = events ?? logsRef.current.slice(0, DETECTION_LOG_BATCH_SIZE)
    if (!toSend || toSend.length === 0) return { success: true }
    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: toSend }),
      })
      if (!events) {
        logsRef.current.splice(0, toSend.length)
      }
      return { success: true }
    } catch (e) {
      console.warn('Failed to upload detection logs:', e)
      return { success: false, reason: String(e) }
    }
  }, [DETECTION_LOG_URL, DETECTION_LOG_BATCH_SIZE])

  const sendLogsToUrl = React.useCallback(async (url: string, events?: any[]) => {
    if (!url) return { success: false, reason: 'no-url' }
    const toSend = events ?? logsRef.current.slice(0, DETECTION_LOG_BATCH_SIZE)
    if (!toSend || toSend.length === 0) return { success: true }
    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: toSend }),
      })
      // on success remove sent events from buffer
      if (!events) {
        logsRef.current.splice(0, toSend.length)
      }
      return { success: true }
    } catch (e) {
      console.warn('Failed to upload detection logs to URL:', url, e)
      return { success: false, reason: String(e) }
    }
  }, [DETECTION_LOG_BATCH_SIZE])

  const clearLogs = React.useCallback(() => {
    logsRef.current = []
  }, [])

  const getRecentLogs = React.useCallback((n = 20) => {
    return logsRef.current.slice(-n)
  }, [])

  const [obstacleDetected, setObstacleDetected] = React.useState(false)
  const [lastHeight, setLastHeight] = React.useState<number | null>(null)
  const [lastConfidence, setLastConfidence] = React.useState<number | null>(null)
  const [lastSmoothed, setLastSmoothed] = React.useState<number | null>(null)
  const [lastSlope, setLastSlope] = React.useState<number | null>(null)
  const [lastCenterX, setLastCenterX] = React.useState<number | null>(null)
  const heightsRef = React.useRef<number[]>([])
  const confidencesRef = React.useRef<number[]>([])
  const obstacleRef = React.useRef<boolean>(false)

  const handleDetection = React.useCallback(
    (payload: { height: number; confidence?: number; centerX?: number }) => {
      const height = payload?.height
      const confidenceArg = payload?.confidence
      const centerXArg = payload?.centerX
      const confidence = typeof confidenceArg === 'number' && isFinite(confidenceArg) ? confidenceArg : null
      const centerX = typeof centerXArg === 'number' && isFinite(centerXArg) ? centerXArg : null

      if (typeof height !== 'number' || !isFinite(height)) return

      heightsRef.current.push(height)
      if (heightsRef.current.length > OBSTACLE_FRAMES) heightsRef.current.shift()
      setLastHeight(height)

      if (confidence != null) {
        confidencesRef.current.push(confidence)
      } else {
        confidencesRef.current.push(0)
      }
      if (confidencesRef.current.length > OBSTACLE_FRAMES) confidencesRef.current.shift()
      setLastConfidence(confidence)
      setLastCenterX(centerX)

      const res = analyzeDetection(heightsRef.current.slice(), confidencesRef.current.slice(), obstacleRef.current, options)

      try {
        if (res.smoothed >= options.threshold) {
          console.log('[ObstacleDebug] smoothed=', res.smoothed, 'slope=', res.slope, 'avgConf=', res.avgConfidence)
        }
      } catch (e) {}

      // update smoothed and slope tracking for debug/UI
      setLastSmoothed(res.smoothed)
      setLastSlope(res.slope)

      try {
        const entry = {
          ts: Date.now(),
          height,
          confidence: confidence ?? null,
          centerX: centerX ?? null,
          smoothed: res.smoothed,
          slope: res.slope,
          detected: res.newDetected,
        }
        if (loggingEnabled) {
          enqueueLog(entry)
          // Send immediately if configured
          if (DETECTION_LOG_SEND_IMMEDIATE && DETECTION_LOG_URL) {
            ;(async () => {
              await sendLogs([entry])
            })()
          } else if (DETECTION_LOG_URL && logsRef.current.length >= DETECTION_LOG_BATCH_SIZE) {
            ;(async () => {
              await sendLogs()
            })()
          }
        }
      } catch (e) {
      }

      if (res.newDetected !== obstacleRef.current) {
        obstacleRef.current = res.newDetected
        setObstacleDetected(res.newDetected)
        console.log('Obstacle state changed:', { newDetected: res.newDetected, smoothed: res.smoothed, slope: res.slope })
      }
    },
    [OBSTACLE_FRAMES, options]
  )

  const reset = React.useCallback(() => {
    heightsRef.current = []
    confidencesRef.current = []
    obstacleRef.current = false
    setObstacleDetected(false)
    setLastHeight(null)
    setLastConfidence(null)
  }, [])

  return {
    handleDetection,
    obstacleDetected,
    lastHeight,
    lastConfidence,
    lastCenterX,
    avgConfidence: confidencesRef.current.length ? average(confidencesRef.current) : null,
    loggingEnabled,
    setLoggingEnabled,
    sendLogs,
    sendLogsToUrl,
    clearLogs,
    getRecentLogs,
    logsCount: () => logsRef.current.length,
    reset,
    OBSTACLE_FRAMES,
    OBSTACLE_THRESHOLD,
    OBSTACLE_HYSTERESIS,
    OBSTACLE_SUDDEN_DELTA,
    OBSTACLE_MIN_CONFIDENCE,
    OBSTACLE_SPEECH_CONFIDENCE,
    OBSTACLE_MIN_SLOPE,
    SMOOTHING_WINDOW,
    OBSTACLE_ALLOW_SIZE_ONLY,
    lastSmoothed,
    lastSlope,
  }
}
