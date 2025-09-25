import * as React from 'react'

export interface NavigationResult {
  direction: 'straight' | 'left' | 'right' | 'stop'
  pathClear: boolean
  obstacleCount: number
  confidence: number
  leftObstacles: number
  centerObstacles: number
  rightObstacles: number
}

export interface DetectionBox {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Navigation guidance based on ROI analysis and obstacle positions
 * Inspired by Kanan Vyas obstacle detection approach
 */
export function useNavigationGuidance() {
  const logCounter = React.useRef(0)
  
  const analyzeDetections = React.useCallback((detections: Array<{ boundingBox: DetectionBox, confidence: number }>): NavigationResult => {
    if (detections.length === 0) {
      return {
        direction: 'straight',
        pathClear: true,
        obstacleCount: 0,
        confidence: 0,
        leftObstacles: 0,
        centerObstacles: 0,
        rightObstacles: 0
      }
    }

    // Analyze obstacle positions for navigation guidance
    // Walking path regions based on ROI analysis
    const LEFT_BOUNDARY = 0.35   // Left 35% of frame
    const RIGHT_BOUNDARY = 0.65  // Right 65% of frame
    
    const leftObstacles = detections.filter(det => {
      const centerX = det.boundingBox.x + (det.boundingBox.width / 2)
      return centerX < LEFT_BOUNDARY
    })
    
    const centerObstacles = detections.filter(det => {
      const centerX = det.boundingBox.x + (det.boundingBox.width / 2)
      return centerX >= LEFT_BOUNDARY && centerX <= RIGHT_BOUNDARY
    })
    
    const rightObstacles = detections.filter(det => {
      const centerX = det.boundingBox.x + (det.boundingBox.width / 2)
      return centerX > RIGHT_BOUNDARY
    })
    
    // Calculate navigation recommendation
    let direction: NavigationResult['direction'] = 'stop' // Default: stop if unsure
    let pathClear = false
    
    if (centerObstacles.length === 0) {
      // Center path is clear
      if (leftObstacles.length === 0 && rightObstacles.length === 0) {
        direction = 'straight'
        pathClear = true
      } else {
        direction = 'straight' // Center clear, proceed
        pathClear = true
      }
    } else {
      // Center blocked, find alternative path
      if (leftObstacles.length === 0 && rightObstacles.length > 0) {
        direction = 'left'
      } else if (rightObstacles.length === 0 && leftObstacles.length > 0) {
        direction = 'right'
      } else if (leftObstacles.length < rightObstacles.length) {
        direction = 'left'
      } else if (rightObstacles.length < leftObstacles.length) {
        direction = 'right'
      } else {
        direction = 'stop' // Both sides blocked
      }
    }
    
    // Calculate average confidence
    const avgConfidence = detections.reduce((sum, det) => sum + det.confidence, 0) / detections.length
    
    // Only log occasionally to prevent spam
    logCounter.current++
    if (logCounter.current % 30 === 0) {
      console.log(`[Navigation] Left: ${leftObstacles.length}, Center: ${centerObstacles.length}, Right: ${rightObstacles.length} → ${direction}`)
    }
    
    return {
      direction,
      pathClear,
      obstacleCount: detections.length,
      confidence: avgConfidence,
      leftObstacles: leftObstacles.length,
      centerObstacles: centerObstacles.length,
      rightObstacles: rightObstacles.length
    }
  }, [])

  return { analyzeDetections }
}
