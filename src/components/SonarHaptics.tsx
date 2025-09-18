import * as Haptics from 'expo-haptics'
import * as React from 'react'

interface SonarHapticsProps {
  obstacleDetected: boolean
  obstacleHeight: number | null
  obstacleConfidence: number | null
}

export function SonarHaptics({ obstacleDetected, obstacleHeight, obstacleConfidence }: SonarHapticsProps) {
  const hapticIntervalRef = React.useRef<number | null>(null)
  const currentSonarInterval = React.useRef<number | null>(null)
  
  React.useEffect(() => {
    if (obstacleDetected && obstacleHeight !== null && obstacleConfidence !== null) {
      const normalizedDistance = Math.max(0, Math.min(1, (obstacleHeight - 0.25) / (1.0 - 0.25)))
      
      const maxInterval = 1000
      const minInterval = 200
      const hapticInterval = Math.round(maxInterval - (normalizedDistance * (maxInterval - minInterval)))
      
      const hapticStyle = obstacleConfidence > 0.6 
        ? Haptics.ImpactFeedbackStyle.Heavy
        : obstacleConfidence > 0.4 
        ? Haptics.ImpactFeedbackStyle.Medium 
        : Haptics.ImpactFeedbackStyle.Light
      
      const intervalChanged = currentSonarInterval.current === null || 
                            Math.abs(hapticInterval - currentSonarInterval.current) > 50
      
      if (intervalChanged) {
        console.log(`Sonar update: ${hapticInterval}ms interval, ${hapticStyle} intensity, ${(obstacleHeight * 100).toFixed(0)}cm distance`)
        
        if (hapticIntervalRef.current) {
          clearInterval(hapticIntervalRef.current)
          hapticIntervalRef.current = null
        }
        
        currentSonarInterval.current = hapticInterval
        
        try {
          Haptics.impactAsync(hapticStyle).catch((err) => {
            console.log(`SONAR: Update haptic failed:`, err)
          })
        } catch (syncErr) {
          console.log(`SONAR: Update haptic sync error:`, syncErr)
        }
        
        // Set up new sonar interval
        hapticIntervalRef.current = setInterval(() => {
          try {
            Haptics.impactAsync(hapticStyle).catch(() => {
            })
          } catch (syncErr) {
            // Sync errors are also expected and not critical
          }
        }, hapticInterval) as unknown as number
      }
      
    } else {
      if (hapticIntervalRef.current !== null) {
        console.log(`Sonar stopped - no obstacles`)
        clearInterval(hapticIntervalRef.current)
        hapticIntervalRef.current = null
        currentSonarInterval.current = null
      }
    }
    
    return () => {
      if (hapticIntervalRef.current) {
        clearInterval(hapticIntervalRef.current)
        hapticIntervalRef.current = null
        currentSonarInterval.current = null
      }
    }
  }, [obstacleDetected, obstacleHeight, obstacleConfidence])

  return null
}
