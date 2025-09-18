import * as React from 'react'
import { useObstacleDetectionConfig } from './useObstacleDetectionConfig'

interface Detection {
  height: number
  confidence: number
}

interface TensorFlowDetectionProcessorProps {
  boxes: any
  classIds: any
  confidenceScores: any
  frameCount: number
  onDetection: (detection: Detection) => void
  onFallbackDetection: (detection: Detection) => void
  cooldownMs: number
}

export function useTensorFlowDetectionProcessor({
  boxes,
  classIds, 
  confidenceScores,
  frameCount,
  onDetection,
  onFallbackDetection,
  cooldownMs
}: TensorFlowDetectionProcessorProps) {
  
  const config = useObstacleDetectionConfig()
  const lastDetectionTime = React.useRef(0)

  React.useEffect(() => {
    if (!confidenceScores) return

    let highConfidenceDetections = 0
    let bestDetection = null
    let bestConfidence = 0
    
    // Use configuration values instead of hardcoded thresholds
    let CONFIDENCE_THRESHOLD = config.OBSTACLE_MIN_CONFIDENCE * 0.5
    
    // Count detections above base threshold
    for (let i = 0; i < confidenceScores.length; i++) {
      const confidence = Number(confidenceScores[i])
      if (confidence > CONFIDENCE_THRESHOLD) {
        highConfidenceDetections++
      }
    }
    
    // Increase threshold in busy environments
    if (highConfidenceDetections > 5) {
      CONFIDENCE_THRESHOLD = config.OBSTACLE_MIN_CONFIDENCE * 0.8 // 80% of configured minimum
    } else if (highConfidenceDetections > 3) {
      CONFIDENCE_THRESHOLD = config.OBSTACLE_MIN_CONFIDENCE * 0.7 // 70% of configured minimum
    }
    
    // Find best detection with adaptive threshold
    highConfidenceDetections = 0
    for (let i = 0; i < confidenceScores.length; i++) {
      const confidence = Number(confidenceScores[i])
      if (confidence > CONFIDENCE_THRESHOLD) {
        highConfidenceDetections++
        if (confidence > bestConfidence) {
          bestConfidence = confidence
          bestDetection = i
        }
      }
    }

    // Process the best detection if found
    if (bestDetection !== null && boxes) {
      try {
        let box: any = null
        if (Array.isArray(boxes[bestDetection])) {
          box = boxes[bestDetection]
        } else if (typeof boxes[bestDetection * 4] === 'number') {
          const idx = bestDetection * 4
          box = [boxes[idx], boxes[idx + 1], boxes[idx + 2], boxes[idx + 3]]
        }
        
        if (box && Array.isArray(box) && box.length >= 4) {
          const ymin = Number(box[0])
          const xmin = Number(box[1])
          const ymax = Number(box[2])
          const xmax = Number(box[3])
          
          const height = Math.max(0, Math.min(1, ymax - ymin))
          const width = Math.max(0, Math.min(1, xmax - xmin))
          const centerX = (xmin + xmax) / 2
          
          // Center-focused filtering: prioritize walking path
          const horizontalCenter = 0.5
          const centerTolerance = 0.3 // 60% of frame width
          const distanceFromCenter = Math.abs(centerX - horizontalCenter)
          
          const isInCenterPath = distanceFromCenter <= centerTolerance
          const isSignificantSize = height > 0.35 && width > 0.15 // Reasonable obstacle size
          const isHighConfidence = bestConfidence > CONFIDENCE_THRESHOLD // Use the adaptive threshold
          
          // Only process detections in center path with significant size and confidence
          if (isInCenterPath && isSignificantSize && isHighConfidence) {
            const now = Date.now()
            if (now - lastDetectionTime.current >= cooldownMs) {
              console.log(`Center-path obstacle: ${(height * 100).toFixed(0)}cm height, ${(bestConfidence * 100).toFixed(1)}% confidence`)
              
              onDetection({ height, confidence: bestConfidence })
              lastDetectionTime.current = now
            } else {
              // Rate limited - detection too frequent
              if (frameCount % 30 === 0) {
                console.log(`Detection rate limited (${cooldownMs}ms cooldown)`)
              }
            }
          } else {
            // Log filtered detections occasionally for debugging
            if (frameCount % 60 === 0) { // Every 2 seconds
              console.log(`Filtered detection: conf=${(bestConfidence * 100).toFixed(1)}%, center=${isInCenterPath}, size=${isSignificantSize}(h:${(height * 100).toFixed(0)}%, w:${(width * 100).toFixed(0)}%), threshold=${(CONFIDENCE_THRESHOLD * 100).toFixed(1)}%`)
            }
          }
        } else {
          // Fallback for unparseable boxes with high confidence
          if (bestConfidence > 0.5) {
            console.log(`Fallback detection: ${(bestConfidence * 100).toFixed(1)}% confidence`)
            onFallbackDetection({ height: 0.6, confidence: bestConfidence })
          }
        }
      } catch (e) {
        // Final fallback for very high confidence detections
        if (bestConfidence > 0.6) {
          try {
            onFallbackDetection({ height: 0.6, confidence: bestConfidence })
          } catch (e2) {
            // All processing failed - this is not rexpected 
          }
        }
      }
    }
  }, [boxes, classIds, confidenceScores, frameCount, onDetection, onFallbackDetection, cooldownMs])
}
