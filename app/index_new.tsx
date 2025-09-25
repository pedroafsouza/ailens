import * as React from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { useTensorflowModel } from 'react-native-fast-tflite'
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera'

import { SonarHaptics } from '../src/components/SonarHaptics'
import { useCameraFrameProcessor } from '../src/hooks/useCameraFrameProcessor'
import { useDetectionPause } from '../src/hooks/useDetectionPause'
import { useObstacleDetectionConfig } from '../src/hooks/useObstacleDetectionConfig'
import { useObstacleDetector } from '../src/hooks/useObstacleDetector'
import DetectionOverlay from './components/DetectionOverlay'

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

export default function App(): React.ReactNode {
  const config = useObstacleDetectionConfig()
  const { paused } = useDetectionPause()
  const { hasPermission, requestPermission } = useCameraPermission()
  const device = useCameraDevice('back')

  const model = useTensorflowModel(require('../assets/model_ssd_mobilenet.tflite'))
  const actualModel = model.state === 'loaded' ? model.model : undefined

  React.useEffect(() => {
    if (actualModel == null) return
    console.log(`SSD MobileNet model loaded successfully: ${actualModel.inputs.length} inputs, ${actualModel.outputs.length} outputs`)
  }, [actualModel])

  const {
    handleDetection,
    obstacleDetected,
    lastHeight,
    lastConfidence,
  } = useObstacleDetector()

  // State declarations for bounding box and detections
  const [currentBoundingBox, setCurrentBoundingBox] = React.useState<Detection['boundingBox'] | null>(null)
  const [allDetections, setAllDetections] = React.useState<Array<{
    boundingBox: { x: number; y: number; width: number; height: number }
    confidence: number
  }>>([])
  const [latestDetections, setLatestDetections] = React.useState<Detection[]>([])
  const boundingBoxTimeoutRef = React.useRef<number | null>(null)
  
  React.useEffect(() => {
    // Convert latest detections to format expected by navigation guidance
    const formattedDetections = latestDetections.map(det => ({
      boundingBox: det.boundingBox || { x: 0, y: 0, width: 0, height: 0 },
      confidence: det.confidence
    }))
    setAllDetections(formattedDetections)
  }, [latestDetections])

  // Clear bounding box when no obstacle is detected
  React.useEffect(() => {
    if (!obstacleDetected) {
      setCurrentBoundingBox(null)
      if (boundingBoxTimeoutRef.current) {
        clearTimeout(boundingBoxTimeoutRef.current)
        boundingBoxTimeoutRef.current = null
      }
    }
  }, [obstacleDetected])

  const onDetection = React.useCallback((detection: Detection) => {
    if (paused) return
    console.log(`[SSD MobileNet] Obstacle detected: ${detection.height.toFixed(3)}m height, ${(detection.confidence * 100).toFixed(1)}% confidence`)
    setCurrentBoundingBox(detection.boundingBox || null)
    
    // Clear previous timeout and set new one
    if (boundingBoxTimeoutRef.current) {
      clearTimeout(boundingBoxTimeoutRef.current)
    }
    boundingBoxTimeoutRef.current = setTimeout(() => {
      setCurrentBoundingBox(null)
    }, 500) as unknown as number
    
    handleDetection(detection)
  }, [paused, handleDetection])

  const onFallbackDetection = React.useCallback((detection: Detection) => {
    // Capture all detections for navigation guidance (including those below primary threshold)
    setLatestDetections(prev => {
      const newDetections = [...prev, detection]
      return newDetections.slice(-5) // Keep last 5 detections
    })
  }, [])

  const frameProcessor = useCameraFrameProcessor({
    model: actualModel,
    onDetection,
    onFallbackDetection,
    cooldownMs: config.DETECTION_COOLDOWN_MS,
    paused
  })

  React.useEffect(() => {
    if (!hasPermission) {
      requestPermission()
    }
  }, [hasPermission, requestPermission])

  if (!hasPermission) {
    return (
      <View style={styles.container}>
        <Text>Camera permission required</Text>
      </View>
    )
  }

  if (!device) {
    return (
      <View style={styles.container}>
        <Text>Camera not available</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Camera
        device={device}
        isActive={true}
        frameProcessor={frameProcessor}
        style={StyleSheet.absoluteFill}
      />

      {model.state === 'loading' && (
        <ActivityIndicator size="small" color="white" />
      )}

      {model.state === 'error' && (
        <Text>Failed to load SSD MobileNet model! {model.error.message}</Text>
      )}

      <DetectionOverlay 
        detected={obstacleDetected} 
        height={lastHeight} 
        confidence={lastConfidence} 
        modelAvailable={!!actualModel}
        boundingBox={currentBoundingBox}
        allDetections={allDetections}
      />

      <SonarHaptics 
        obstacleDetected={obstacleDetected}
        obstacleHeight={lastHeight}
        obstacleConfidence={lastConfidence}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
