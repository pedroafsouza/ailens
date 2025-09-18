import * as React from 'react'

export interface ObstacleDetectionConfig {
  OBSTACLE_THRESHOLD: number
  OBSTACLE_MIN_CONFIDENCE: number
  OBSTACLE_HYSTERESIS: number
  OBSTACLE_FRAMES: number
  OBSTACLE_SMOOTHING_WINDOW: number
  OBSTACLE_MIN_SLOPE: number
  OBSTACLE_SUDDEN_DELTA: number
  OBSTACLE_ALLOW_SIZE_ONLY: boolean
  OBSTACLE_SPEECH_CONFIDENCE: number
  OBSTACLE_HAPTIC_REPEAT_MS: number
  DETECTION_COOLDOWN_MS: number
}

export function useObstacleDetectionConfig(): ObstacleDetectionConfig {
  return React.useMemo(() => {
    const config: ObstacleDetectionConfig = {
      OBSTACLE_THRESHOLD: parseFloat(process.env.OBSTACLE_THRESHOLD ?? '0.4'),
      OBSTACLE_MIN_CONFIDENCE: parseFloat(process.env.OBSTACLE_MIN_CONFIDENCE ?? '0.45'),
      OBSTACLE_HYSTERESIS: parseFloat(process.env.OBSTACLE_HYSTERESIS ?? '0.12'),
      OBSTACLE_FRAMES: parseInt(process.env.OBSTACLE_FRAMES ?? '12', 10),
      OBSTACLE_SMOOTHING_WINDOW: parseInt(process.env.OBSTACLE_SMOOTHING_WINDOW ?? '6', 10),
      OBSTACLE_MIN_SLOPE: parseFloat(process.env.OBSTACLE_MIN_SLOPE ?? '0.008'),
      OBSTACLE_SUDDEN_DELTA: parseFloat(process.env.OBSTACLE_SUDDEN_DELTA ?? '0.15'),
      OBSTACLE_ALLOW_SIZE_ONLY: (process.env.OBSTACLE_ALLOW_SIZE_ONLY ?? 'false') === 'true',
      OBSTACLE_SPEECH_CONFIDENCE: parseFloat(process.env.OBSTACLE_SPEECH_CONFIDENCE ?? '0.8'),
      OBSTACLE_HAPTIC_REPEAT_MS: parseInt(process.env.OBSTACLE_HAPTIC_REPEAT_MS ?? '2000', 10),
      DETECTION_COOLDOWN_MS: parseInt(process.env.DETECTION_COOLDOWN_MS ?? '150', 10),
    }

    console.log('Loaded obstacle detection config:', config)
    return config
  }, [])
}
