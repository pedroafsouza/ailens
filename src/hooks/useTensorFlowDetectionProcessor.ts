import * as React from 'react'
import { useObstacleDetectionConfig } from './useObstacleDetectionConfig'

// Trust the COCO-trained model more - minimal filtering for walking hazards
function isWalkingHazard(box: number[], confidence: number, frameWidth = 320, frameHeight = 320): boolean {
  const [ymin, xmin, ymax, xmax] = box
  
  // Calculate basic properties
  const height = ymax - ymin
  const width = xmax - xmin
  const centerX = (xmin + xmax) / 2
  const area = height * width
  
  // Debug logging for rejections
  const debugInfo = {
    confidence: confidence.toFixed(3),
    area: area.toFixed(4),
    centerX: centerX.toFixed(3),
    ymax: ymax.toFixed(3),
    aspectRatio: (width/height).toFixed(2)
  }
  
  // TRUST THE MODEL - Minimal filtering to reduce false rejections
  
  // 1. Lower confidence threshold - trust the model's sigmoid scores
  if (confidence < 0.25) {
    // console.log(`[Filter] REJECT confidence: ${debugInfo.confidence} < 0.25`)
    return false // Lowered from 0.55 to 0.25 - trust model more
  }
  
  // 2. More permissive size filtering 
  if (area < 0.002) {
    console.log(`[Filter] REJECT area too small: ${debugInfo.area} < 0.002`)
    return false // Very small objects only (< 0.2% of frame)
  }
  if (area > 0.9) {
    console.log(`[Filter] REJECT area too large: ${debugInfo.area} > 0.9`)
    return false   // Only reject obviously full-screen detections
  }
  
  // 3. Broader position filtering - don't over-constrain walking area
  const isInReasonableArea = centerX >= 0.1 && centerX <= 0.9 // 80% of screen width
  if (!isInReasonableArea) {
    console.log(`[Filter] REJECT position: centerX=${debugInfo.centerX} not in [0.1, 0.9]`)
    return false
  }
  
  // 4. More lenient ground requirement - allow elevated obstacles
  const isReachable = ymax > 0.3 // Extends into bottom 70% of frame (was 60%)
  if (!isReachable) {
    console.log(`[Filter] REJECT not grounded: ymax=${debugInfo.ymax} <= 0.3`)
    return false
  }
  
  // 5. Remove overly strict size-based requirements
  // Trust that the model's confidence already accounts for relevance
  
  // 6. More lenient aspect ratio - allow wider objects
  const aspectRatio = width / height
  if (aspectRatio > 5.0) {
    console.log(`[Filter] REJECT aspect ratio: ${debugInfo.aspectRatio} > 5.0`)
    return false // Only reject extremely wide objects (was 3.0)
  }
  
  // If we get here, it's a valid walking hazard
  console.log(`[Filter] ACCEPT: conf=${debugInfo.confidence}, area=${debugInfo.area}, pos=${debugInfo.centerX}, ground=${debugInfo.ymax}`)
  
  // TRUST THE MODEL - it's COCO-trained and knows what obstacles look like
  return true
}

interface Detection {
  height: number
  confidence: number
  boundingBox?: {
    x: number
    y: number
    width: number
    height: number
  }
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
  const lastReportedDistance = React.useRef(0)
  const stableDetectionCount = React.useRef(0)
  const currentStableDistance = React.useRef(0)
  
  // Simple approach: No target tracking, just find closest obstacle each frame
  // BUT add stability and smoothing for practical use
  
  // Convert height to distance estimate (simplified)
  const heightToDistance = React.useCallback((height: number): number => {
    // Rough conversion: larger heights = closer objects
    // This is a simplified model - real distance would need camera calibration
    return Math.max(0.3, 2.0 - (height * 1.5))
  }, [])

  React.useEffect(() => {
    if (!confidenceScores) return
    
    // Simple approach: Process all detections each frame, find closest obstacle
    if (frameCount <= 0) return
    
    // Step 1: Extract all valid detections from model output
    const currentDetections: Array<{
      box: number[]
      confidence: number
      height: number
      area: number
    }> = []
    
    if (boxes && confidenceScores) {
      const numDetections = Math.min(10, Math.floor(boxes.length / 4))
      
      for (let i = 0; i < numDetections; i++) {
        const boxIndex = i * 4
        const box = [
          Number(boxes[boxIndex]),     // ymin
          Number(boxes[boxIndex + 1]), // xmin
          Number(boxes[boxIndex + 2]), // ymax
          Number(boxes[boxIndex + 3])  // xmax
        ]
        
        const confidence = Number(confidenceScores[i])
        
        // Skip invalid detections
        if (isNaN(confidence) || box.some(isNaN)) continue
        
        // Calculate detection properties
        const [ymin, xmin, ymax, xmax] = box
        const height = ymax - ymin
        const width = xmax - xmin
        const area = height * width
        
        // Apply filtering - trust the model but filter obvious noise
        if (isWalkingHazard(box, confidence)) {
          currentDetections.push({
            box,
            confidence,
            height,
            area
          })
        }
      }
    }
    
    // Step 2: Find closest obstacle with stability filtering
    if (currentDetections.length > 0) {
      // Sort by height (descending) to get closest obstacle first
      const sortedByCloseness = currentDetections.sort((a, b) => b.height - a.height)
      const closestObstacle = sortedByCloseness[0]
      
      // Convert to distance and add stability
      const distance = heightToDistance(closestObstacle.height)
      const distanceCm = Math.round(distance * 100)
      
      // STABILITY: Only report if distance is stable or significantly different
      const distanceDiff = Math.abs(distanceCm - currentStableDistance.current)
      
      if (distanceDiff <= 10) {
        // Distance is stable (within 10cm) - count consecutive stable detections
        stableDetectionCount.current++
      } else {
        // Distance changed significantly - reset stability counter
        stableDetectionCount.current = 1
        currentStableDistance.current = distanceCm
      }
      
      // Only report if we have stable detection for 3+ frames AND meaningful change
      const meaningfulChange = Math.abs(distanceCm - lastReportedDistance.current) >= 20 // 20cm threshold
      const isStable = stableDetectionCount.current >= 3
      
      if (isStable && (meaningfulChange || lastReportedDistance.current === 0)) {
        const detection: Detection = {
          height: distance,
          confidence: closestObstacle.confidence,
          boundingBox: {
            x: closestObstacle.box[1], // xmin (normalized)
            y: closestObstacle.box[0], // ymin (normalized)  
            width: closestObstacle.box[3] - closestObstacle.box[1], // width
            height: closestObstacle.box[2] - closestObstacle.box[0]  // height
          }
        }
        
        // Rate limiting - only report if enough time has passed
        const currentTime = Date.now()
        if (currentTime - lastDetectionTime.current >= cooldownMs) {
          console.log(`[Stable Detection] Obstacle confirmed: ${distanceCm}cm distance, ${(closestObstacle.confidence * 100).toFixed(1)}% confidence (stable for ${stableDetectionCount.current} frames)`)
          onDetection(detection)
          lastDetectionTime.current = currentTime
          lastReportedDistance.current = distanceCm
        }
      }
    } else {
      // No detections - reset stability tracking
      stableDetectionCount.current = 0
      currentStableDistance.current = 0
    }
    
    // Log detection summary periodically
    if (frameCount % 30 === 0) {
      console.log(`[Simple Detection] Frame ${frameCount}: ${currentDetections.length} valid obstacles detected`)
      if (currentDetections.length > 0) {
        const closest = currentDetections.sort((a, b) => b.height - a.height)[0]
        const distance = heightToDistance(closest.height)
        console.log(`[Simple Detection] Closest: ${(distance * 100).toFixed(0)}cm, ${(closest.confidence * 100).toFixed(1)}% confidence`)
      }
    }
  }, [boxes, classIds, confidenceScores, frameCount, onDetection, onFallbackDetection, cooldownMs, heightToDistance])

  return null
}

export default useTensorFlowDetectionProcessor
