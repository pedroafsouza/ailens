import * as React from 'react'
import { TensorflowModel } from 'react-native-fast-tflite'
import { useFrameProcessor } from 'react-native-vision-camera'
import { useRunOnJS } from 'react-native-worklets-core'
import { useResizePlugin } from 'vision-camera-resize-plugin'
import { useTensorFlowDetectionProcessor } from '../hooks/useTensorFlowDetectionProcessor'

interface Detection {
  height: number
  confidence: number
}

interface DetectionData {
  boxes: any
  classIds: any
  confidenceScores: any
  frameCount: number
}

interface CameraFrameProcessorProps {
  model: TensorflowModel | undefined
  onDetection: (detection: Detection) => void
  onFallbackDetection: (detection: Detection) => void
  cooldownMs: number
}

export function useCameraFrameProcessor({
  model,
  onDetection,
  onFallbackDetection,
  cooldownMs
}: CameraFrameProcessorProps) {
  const { resize } = useResizePlugin()
  const frameCountRef = React.useRef(0)
  const [detectionData, setDetectionData] = React.useState<DetectionData | null>(null)

  // Create a worklet function that passes detection data to React side
  const updateDetectionData = useRunOnJS((data: DetectionData) => {
    setDetectionData(data)
  }, [])

  const frameProcessor = useFrameProcessor(
    (frame) => {
      'worklet'
      
      frameCountRef.current++
      
      if (model == null) {
        return
      }
      
      const resized = resize(frame, {
        scale: {
          width: 320,
          height: 320,
        },
        pixelFormat: 'rgb',
        dataType: 'uint8',
      })
      
      const result = model.runSync([resized])
      
      const boxes = result[0]
      const classIds = result[1] 
      const confidenceScores = result[2]
      
      if (frameCountRef.current <= 3 || frameCountRef.current % 30 === 0) {
        let highConfCount = 0
        let bestConf = 0
        if (confidenceScores) {
          for (let i = 0; i < confidenceScores.length; i++) {
            const conf = Number(confidenceScores[i])
            if (conf > 0.2) highConfCount++
            if (conf > bestConf) bestConf = conf
          }
        }
        console.log(`Frame ${frameCountRef.current}: ${highConfCount} detections (>0.2 confidence), best: ${bestConf.toFixed(3)}`)
      }

      if (boxes && confidenceScores) {
        const boxesArray = Array.isArray(boxes) ? boxes : [...(boxes || [])]
        const classIdsArray = Array.isArray(classIds) ? classIds : [...(classIds || [])]
        const confidenceScoresArray = Array.isArray(confidenceScores) ? confidenceScores : [...(confidenceScores || [])]
        
        updateDetectionData({
          boxes: boxesArray,
          classIds: classIdsArray,
          confidenceScores: confidenceScoresArray,
          frameCount: frameCountRef.current
        })
      }
    },
    [model, updateDetectionData]
  )

  useTensorFlowDetectionProcessor({
    boxes: detectionData?.boxes,
    classIds: detectionData?.classIds,
    confidenceScores: detectionData?.confidenceScores,
    frameCount: detectionData?.frameCount || 0,
    onDetection,
    onFallbackDetection,
    cooldownMs
  })

  return frameProcessor
}

export default useCameraFrameProcessor
