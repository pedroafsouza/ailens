import { usePathname } from 'expo-router'
import { useEffect, useState } from 'react'
import { AppState, AppStateStatus } from 'react-native'

// Global pause state that can be controlled from anywhere
let globalPaused = false
const pauseListeners: Array<(paused: boolean) => void> = []

export function useDetectionPause() {
  const [paused, setPaused] = useState(globalPaused)
  const pathname = usePathname()

  // Track app state changes
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      const shouldPause = nextAppState !== 'active'
      updateGlobalPauseState(shouldPause, 'appState')
    }

    const subscription = AppState.addEventListener('change', handleAppStateChange)
    return () => subscription?.remove()
  }, [])

  // Track navigation to settings page
  useEffect(() => {
    const shouldPause = pathname === '/settings'
    updateGlobalPauseState(shouldPause, 'navigation')
  }, [pathname])

  // Subscribe to global pause state changes
  useEffect(() => {
    const listener = (newPaused: boolean) => {
      setPaused(newPaused)
    }
    pauseListeners.push(listener)

    return () => {
      const index = pauseListeners.indexOf(listener)
      if (index > -1) {
        pauseListeners.splice(index, 1)
      }
    }
  }, [])

  return {
    paused,
    setPaused: (paused: boolean) => updateGlobalPauseState(paused, 'manual')
  }
}

// Track multiple pause reasons
const pauseReasons = new Set<string>()

function updateGlobalPauseState(shouldPause: boolean, reason: string) {
  if (shouldPause) {
    pauseReasons.add(reason)
  } else {
    pauseReasons.delete(reason)
  }

  const newPaused = pauseReasons.size > 0
  
  if (newPaused !== globalPaused) {
    globalPaused = newPaused
    console.log(`Detection ${newPaused ? 'paused' : 'resumed'} due to: ${Array.from(pauseReasons).join(', ') || 'none'}`)
    pauseListeners.forEach(listener => listener(globalPaused))
  }
}

// Convenience function for other hooks/components to check if paused
export function isDetectionPaused(): boolean {
  return globalPaused
}
