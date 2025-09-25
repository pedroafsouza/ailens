import * as React from 'react'
import { TensorflowModel } from 'react-native-fast-tflite'
import { useFrameProcessor } from 'react-native-vision-camera'
import { useRunOnJS } from 'react-native-worklets-core'
import { useResizePlugin } from 'vision-camera-resize-plugin'
import { useTensorFlowDetectionProcessor } from '../hooks/useTensorFlowDetectionProcessor'

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
  paused?: boolean
  onModelReload?: () => void
}

export function useCameraFrameProcessor({
  model,
  onDetection,
  onFallbackDetection,
  cooldownMs,
  paused = false,
  onModelReload
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

      // Skip processing if detection is paused
      if (paused) {
        return
      }
      
      // PERFORMANCE: Reduce detection FPS - process every 3rd frame (~10 FPS instead of 30 FPS)
      if (frameCountRef.current % 3 !== 0) {
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
      
      // DEBUG: Check if input frames are changing by sampling a few pixels
      if (frameCountRef.current % 60 === 0) {
        // Check a few pixel values to see if frame data is changing
        const pixelCheck = `${resized[0]},${resized[100]},${resized[1000]},${resized[10000]}`
        console.log(`[Frame Input] Frame ${frameCountRef.current} pixel sample: ${pixelCheck}`)
      }
      
      const result = model.runSync([resized])
      
      
      // SSD MobileNet has a specific output format:
      // result[0]: boxes [ymin, xmin, ymax, xmax] for each detection [1, 25, 4] = 100 values (25 detections × 4 coords)
      // result[1]: class IDs [1, 25] = 25 values
      // result[2]: confidence scores [1, 25] = 25 values 
      // result[3]: number of valid detections [1] = 1 value
      
      const rawBoxes = result[0]        // 100 values: 25 detections × 4 coordinates each
      const classIds = result[1]        // 25 values: class IDs 
      const rawConfidences = result[2]  // 25 values: confidence scores
      const numDetections = result[3]   // 1 value: number of valid detections
      
      // DEBUG: Check if raw model outputs are changing
      if (frameCountRef.current % 60 === 0 && rawBoxes?.length >= 4) {
        const rawBoxSample = `${Number(rawBoxes[0]).toFixed(3)},${Number(rawBoxes[1]).toFixed(3)},${Number(rawBoxes[2]).toFixed(3)},${Number(rawBoxes[3]).toFixed(3)}`
        console.log(`[Model Output] Frame ${frameCountRef.current} raw box coords: [${rawBoxSample}]`)
      }
      
      // Additional debugging: try different output interpretations
      if (frameCountRef.current <= 3) {
        console.log(`[SSD Parse Debug] Frame ${frameCountRef.current}:`)
        
        // Safe way to handle typed arrays
        const tryShowValues = (arr: any, name: string) => {
          if (Array.isArray(arr)) {
            console.log(`  - ${name}: Regular array [${arr.slice(0, 5).join(', ')}]`)
          } else if (arr && arr.length !== undefined) {
            // It's a typed array, access elements by index
            const values = []
            for (let i = 0; i < Math.min(5, arr.length); i++) {
              values.push(Number(arr[i]))
            }
            console.log(`  - ${name}: TypedArray[${arr.length}] first 5: [${values.join(', ')}]`)
          } else {
            console.log(`  - ${name}: Unknown type`)
          }
        }
        
        tryShowValues(rawBoxes, 'Boxes from result[0]')
        tryShowValues(classIds, 'ClassIds from result[1]')
        tryShowValues(rawConfidences, 'RawConfidences from result[2]')
        tryShowValues(numDetections, 'NumDetections from result[3]')
      }
      
      // Process SSD MobileNet outputs properly
      const maxDetections = 25  // Updated to match actual model output
      const processedDetections: { boxes: number[], classIds: number[], confidences: number[] } = {
        boxes: [],
        classIds: [],
        confidences: []
      }
      
      // Get number of valid detections (clamp to maxDetections)
      // numDetections is a 1D TypedArray with 1 value: [25]
      const numDetectionsValue = Number(numDetections[0])
      const validDetections = Math.min(maxDetections, Math.max(0, Math.floor(numDetectionsValue || 0)))
      
      for (let i = 0; i < validDetections; i++) {
        // Extract bounding box (4 values per detection)
        // rawBoxes is a flat TypedArray with 100 values (25 detections × 4 coordinates)
        const boxStartIndex = i * 4
        const box = [
          Number(rawBoxes[boxStartIndex]),     // ymin
          Number(rawBoxes[boxStartIndex + 1]), // xmin  
          Number(rawBoxes[boxStartIndex + 2]), // ymax
          Number(rawBoxes[boxStartIndex + 3])  // xmax
        ]
        
        // classIds and rawConfidences are 1D TypedArrays with 25 values each
        const classId = Number(classIds[i])
        let confidence = Number(rawConfidences[i])
        const originalConfidence = confidence
        
        // Apply sigmoid only if confidence appears to be logits (outside 0-1 range or negative)
        // Most TensorFlow Lite models already output probabilities
        if (confidence < 0 || confidence > 1) {
          confidence = 1 / (1 + Math.exp(-confidence))
        }
        
        
        processedDetections.boxes.push(...box)
        processedDetections.classIds.push(classId)
        processedDetections.confidences.push(confidence)
      }
      
      // Use processed detections
      const boxes = processedDetections.boxes
      const confidenceScores = processedDetections.confidences
      
      if (frameCountRef.current <= 3 || frameCountRef.current % 30 === 0) {
        let highConfCount = 0
        let bestConf = 0
        let rawBestConf = 0
        if (confidenceScores && confidenceScores.length > 0 && rawConfidences) {
          for (let i = 0; i < confidenceScores.length; i++) {
            const conf = confidenceScores[i]  // Processed confidence
            const rawConf = Number(rawConfidences[i])  // Raw from model
            
            if (conf > 0.2) highConfCount++
            if (conf > bestConf) bestConf = conf
            if (rawConf > rawBestConf) rawBestConf = rawConf
          }
        }
        console.log(`Frame ${frameCountRef.current}: ${highConfCount} detections (>0.2 confidence), best processed: ${bestConf.toFixed(3)}, best raw: ${rawBestConf.toFixed(3)}`)
      }

      if (boxes && confidenceScores) {
        // Data is already processed - boxes and confidenceScores are regular arrays
        const boxesArray = boxes
        const classIdsArray = processedDetections.classIds  
        const confidenceScoresArray = confidenceScores
        
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
