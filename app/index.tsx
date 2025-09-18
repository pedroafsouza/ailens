import * as React from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { useTensorflowModel } from 'react-native-fast-tflite'
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera'

import { SonarHaptics } from '../src/components/SonarHaptics'
import { useCameraFrameProcessor } from '../src/hooks/useCameraFrameProcessor'
import { useObstacleDetectionConfig } from '../src/hooks/useObstacleDetectionConfig'
import { useObstacleDetector } from '../src/hooks/useObstacleDetector'
import DetectionOverlay from './components/DetectionOverlay'

interface Detection {
  height: number
  confidence: number
}

export default function App(): React.ReactNode {
  const config = useObstacleDetectionConfig()
  const { hasPermission, requestPermission } = useCameraPermission()
  const device = useCameraDevice('back')

  const model = useTensorflowModel(require('../assets/model.tflite'))
  const actualModel = model.state === 'loaded' ? model.model : undefined

  React.useEffect(() => {
    if (actualModel == null) return
    console.log(`TensorFlow model loaded successfully: ${actualModel.inputs.length} inputs, ${actualModel.outputs.length} outputs`)
  }, [actualModel])

  const {
    handleDetection,
    obstacleDetected,
    lastHeight,
    lastConfidence,
  } = useObstacleDetector()

  const onDetection = React.useCallback((detection: Detection) => {
    console.log(`Obstacle detected: ${detection.height.toFixed(3)}m height, ${(detection.confidence * 100).toFixed(1)}% confidence`)
    handleDetection(detection)
  }, [handleDetection])

  const onFallbackDetection = React.useCallback((detection: Detection) => {
    console.log(`Fallback detection: ${detection.height.toFixed(3)}m height, ${(detection.confidence * 100).toFixed(1)}% confidence`)
    handleDetection(detection)
  }, [handleDetection])

  const frameProcessor = useCameraFrameProcessor({
    model: actualModel,
    onDetection,
    onFallbackDetection,
    cooldownMs: config.DETECTION_COOLDOWN_MS
  })

  React.useEffect(() => {
    if (!hasPermission) {
      console.log('Requesting camera permission...')
      requestPermission().then(granted => {
        console.log(`Camera permission ${granted ? 'granted' : 'denied'}`)
      })
    }
  }, [hasPermission, requestPermission])

  if (model.state === 'loading') {
    console.log('Loading TensorFlow model...')
  } else if (model.state === 'error') {
    console.error('Failed to load TensorFlow model:', model.error.message)
  }

  return (
    <View style={styles.container}>
      {hasPermission && device != null ? (
        <Camera
          device={device}
          style={StyleSheet.absoluteFill}
          isActive={true}
          frameProcessor={frameProcessor}
          pixelFormat="yuv"
        />
      ) : (
        <Text>No Camera available.</Text>
      )}

      {model.state === 'loading' && (
        <ActivityIndicator size="small" color="white" />
      )}

      {model.state === 'error' && (
        <Text>Failed to load model! {model.error.message}</Text>
      )}

      <DetectionOverlay 
        detected={obstacleDetected} 
        height={lastHeight} 
        confidence={lastConfidence} 
        modelAvailable={!!actualModel} 
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