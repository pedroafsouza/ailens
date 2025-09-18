import * as React from 'react'
import { useObstacleDetectionConfig } from './useObstacleDetectionConfig'

// Improved spatial analysis for walking hazards - considers small ground-level obstacles
function isWalkingHazard(box: number[], confidence: number, frameWidth = 320, frameHeight = 320): boolean {
  const [ymin, xmin, ymax, xmax] = box
  
  // Calculate dimensions and position
  const height = ymax - ymin
  const width = xmax - xmin
  const centerX = (xmin + xmax) / 2
  const centerY = (ymin + ymax) / 2
  const area = height * width
  const aspectRatio = width / height
  
  // EXCLUDE: Obvious non-hazards
  
  // 1. Tiny noise (very small AND very low confidence)
  if (area < 0.005 && confidence < 0.4) return false // < 0.5% frame AND low confidence
  
  // 2. Sky/ceiling objects (unless they're large and could be overhead hazards)
  if (ymax < 0.2 && area < 0.1) return false // Top 20% AND small
  
  // 3. Very wide thin horizontal bands (floor lines, horizons)
  if (aspectRatio > 6 && height < 0.08 && centerY > 0.6) return false // Wide, thin, bottom area
  
  // 4. Full-width floor/wall spans
  if (width > 0.9 && centerY > 0.8) return false // Nearly full width in bottom area
  
  // INCLUDE: Walking hazards (including small ground-level ones)
  
  // 5. Ground-level objects (boxes, curbs, etc.) - even if small
  const isGroundLevel = ymax > 0.5 // Bottom half of frame
  const isReasonableSize = area > 0.002 // > 0.2% of frame (quite small)
  const isWalkingPath = Math.abs(centerX - 0.5) < 0.4 // Within walking path
  
  if (isGroundLevel && isReasonableSize && isWalkingPath) {
    // Small ground objects need much higher confidence to be considered hazards
    if (confidence > 0.6) return true  // Increased from 0.4 to 0.6
  }
  
  // 6. Larger objects anywhere in walking area - be much more selective
  if (area > 0.05 && isWalkingPath && confidence > 0.5) return true // > 5% frame, much higher confidence
  
  // 7. High confidence objects (probably real regardless of size) - be very restrictive
  if (confidence > 0.8 && area > 0.01 && isWalkingPath) return true // Very confident detection, in path
  
  // Default: not a hazard
  return false
}

interface Detection {
  height: number
  confidence: number
}

interface TrackedTarget {
  box: number[]  // [ymin, xmin, ymax, xmax]
  confidence: number
  height: number
  centerX: number
  centerY: number
  area: number
  lastSeen: number 
  trackingId: string
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
  
  // Target tracking state
  const currentTarget = React.useRef<TrackedTarget | null>(null)
  const lastReportedDistance = React.useRef<number | null>(null)
  const TARGET_LOSS_FRAMES = 30 // Lose lock after 30 frames without detection
  const TARGET_MATCH_THRESHOLD = 0.3 // IoU threshold for matching detections
  const MIN_DISTANCE_CHANGE = 0.1 // Minimum distance change to report (10cm)
  
  // Calculate Intersection over Union for box matching
  const calculateIoU = React.useCallback((box1: number[], box2: number[]): number => {
    const [y1min, x1min, y1max, x1max] = box1
    const [y2min, x2min, y2max, x2max] = box2
    
    const intersectionXMin = Math.max(x1min, x2min)
    const intersectionYMin = Math.max(y1min, y2min)
    const intersectionXMax = Math.min(x1max, x2max)
    const intersectionYMax = Math.min(y1max, y2max)
    
    const intersectionWidth = Math.max(0, intersectionXMax - intersectionXMin)
    const intersectionHeight = Math.max(0, intersectionYMax - intersectionYMin)
    const intersectionArea = intersectionWidth * intersectionHeight
    
    const box1Area = (x1max - x1min) * (y1max - y1min)
    const box2Area = (x2max - x2min) * (y2max - y2min)
    const unionArea = box1Area + box2Area - intersectionArea
    
    return unionArea > 0 ? intersectionArea / unionArea : 0
  }, [])
  
  // Convert height to distance estimate (simplified)
  const heightToDistance = React.useCallback((height: number): number => {
    // Rough conversion: larger heights = closer objects
    // This is a simplified model - real distance would need camera calibration
    return Math.max(0.3, 2.0 - (height * 1.5))
  }, [])

  React.useEffect(() => {
    if (!confidenceScores) return

    // Step 1: Parse all valid detections from this frame
    const currentDetections: TrackedTarget[] = []
    let CONFIDENCE_THRESHOLD = config.OBSTACLE_MIN_CONFIDENCE * 0.7
    
    for (let i = 0; i < confidenceScores.length; i++) {
      const confidence = Number(confidenceScores[i])
      if (confidence < CONFIDENCE_THRESHOLD) continue
      
      // Get the bounding box for spatial analysis
      let box: number[] | null = null
      if (Array.isArray(boxes[i])) {
        box = boxes[i]
      } else if (typeof boxes[i * 4] === 'number') {
        const idx = i * 4
        box = [boxes[idx], boxes[idx + 1], boxes[idx + 2], boxes[idx + 3]]
      }
      
      if (!box) continue
      
      // Use spatial analysis to filter for walking hazards
      const isHazard = isWalkingHazard(box, confidence)
      if (!isHazard) continue
      
      // Create detection object
      const [ymin, xmin, ymax, xmax] = box
      const height = ymax - ymin
      const width = xmax - xmin
      const centerX = (xmin + xmax) / 2
      const centerY = (ymin + ymax) / 2
      const area = height * width
      
      currentDetections.push({
        box,
        confidence,
        height,
        centerX,
        centerY,
        area,
        lastSeen: frameCount,
        trackingId: `${frameCount}-${i}` // Temporary ID
      })
    }
    
    // Step 2: Target tracking logic
    let trackedObstacle: TrackedTarget | null = null
    
    if (currentTarget.current) {
      // Try to find matching detection for current target
      const target = currentTarget.current
      let bestMatch: TrackedTarget | null = null
      let bestIoU = 0
      
      for (const detection of currentDetections) {
        const iou = calculateIoU(target.box, detection.box)
        if (iou > TARGET_MATCH_THRESHOLD && iou > bestIoU) {
          bestMatch = detection
          bestIoU = iou
        }
      }
      
      if (bestMatch) {
        // Update existing target with new information
        trackedObstacle = {
          ...bestMatch,
          trackingId: target.trackingId, // Keep same tracking ID
          lastSeen: frameCount
        }
        currentTarget.current = trackedObstacle
        
        console.log(`[TargetTrack] Updated target ${target.trackingId}, IoU: ${bestIoU.toFixed(3)}, conf: ${bestMatch.confidence.toFixed(3)}`)
      } else {
        // Check if target has been lost for too long
        const framesSinceLastSeen = frameCount - target.lastSeen
        if (framesSinceLastSeen > TARGET_LOSS_FRAMES) {
          console.log(`[TargetTrack] Lost target ${target.trackingId} after ${framesSinceLastSeen} frames`)
          currentTarget.current = null
          lastReportedDistance.current = null // Clear distance tracking
        } else {
          // Keep existing target but mark as not updated
          trackedObstacle = target
          console.log(`[TargetTrack] Target ${target.trackingId} not found, frames since last seen: ${framesSinceLastSeen}`)
        }
      }
    }
    
    // Step 3: Acquire new target if none exists
    if (!trackedObstacle && currentDetections.length > 0) {
      // Find closest detection (largest height = closest in simple model)
      const closestDetection = currentDetections.reduce((closest, current) => 
        current.height > closest.height ? current : closest
      )
      
      trackedObstacle = {
        ...closestDetection,
        trackingId: `target-${frameCount}`
      }
      currentTarget.current = trackedObstacle
      
      console.log(`[TargetTrack] Acquired new target ${trackedObstacle.trackingId}, height: ${trackedObstacle.height.toFixed(3)}, conf: ${trackedObstacle.confidence.toFixed(3)}`)
    }
    
    // Step 4: Report tracked obstacle (with movement filtering)
    if (trackedObstacle) {
      const distance = heightToDistance(trackedObstacle.height)
      
      // Check if distance has changed significantly
      const lastDistance = lastReportedDistance.current
      const distanceChanged = lastDistance === null || Math.abs(distance - lastDistance) >= MIN_DISTANCE_CHANGE
      
      if (distanceChanged) {
        const detection: Detection = {
          height: distance,
          confidence: trackedObstacle.confidence
        }
        
        // Check rate limiting
        const now = Date.now()
        if (now - lastDetectionTime.current >= cooldownMs) {
          lastDetectionTime.current = now
          lastReportedDistance.current = distance
          onDetection(detection)
          
          console.log(`[TargetTrack] Reporting obstacle: ${(distance * 100).toFixed(0)}cm distance, ${(trackedObstacle.confidence * 100).toFixed(1)}% confidence (changed by ${lastDistance ? Math.abs(distance - lastDistance).toFixed(2) : 'N/A'}m)`)
        } else {
          // Still report for logging but note rate limiting
          onFallbackDetection(detection)
          console.log(`[TargetTrack] Rate limited: ${(distance * 100).toFixed(0)}cm distance, ${(trackedObstacle.confidence * 100).toFixed(1)}% confidence`)
        }
      } else {
        // Distance hasn't changed significantly - suppress report
        console.log(`[TargetTrack] Suppressed static obstacle: ${(distance * 100).toFixed(0)}cm distance (no significant movement)`)
      }
    } else if (currentTarget.current === null) {
      // No target and no new acquisitions - clear state if needed
      console.log(`[TargetTrack] No obstacles detected in frame ${frameCount}`)
    }
  }, [boxes, classIds, confidenceScores, frameCount, onDetection, onFallbackDetection, cooldownMs, config.OBSTACLE_MIN_CONFIDENCE, calculateIoU, heightToDistance])
}
