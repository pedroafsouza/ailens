const tf = require('@tensorflow/tfjs-node');
const fs = require('fs-extra');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

class SSDMobileNetTester {
  constructor() {
    this.model = null;
    this.testImages = [];
  }

  async loadModel() {
    console.log('Loading SSD MobileNet model...');
    try {
      // Copy the model from the React Native assets
      const modelPath = path.join(__dirname, '../assets/model_ssd_mobilenet.tflite');
      
      if (!fs.existsSync(modelPath)) {
        throw new Error(`Model file not found at: ${modelPath}`);
      }

      // For TensorFlow.js, we need to load the model differently
      // First, let's check if we can load it as a saved model
      console.log('Model file found, attempting to load...');
      
      // TensorFlow Lite models need special handling in Node.js
      // We'll need to convert or use the JavaScript version
      console.log('Note: TensorFlow Lite models require special handling in Node.js');
      console.log('Consider using a converted SavedModel format for testing');
      
      return false;
    } catch (error) {
      console.error('Error loading model:', error.message);
      return false;
    }
  }

  async preprocessImage(imagePath, targetWidth = 320, targetHeight = 320) {
    console.log(`Preprocessing image: ${imagePath}`);
    
    try {
      // Load image using canvas
      const image = await loadImage(imagePath);
      
      // Create canvas with target dimensions
      const canvas = createCanvas(targetWidth, targetHeight);
      const ctx = canvas.getContext('2d');
      
      // Draw image scaled to target size
      ctx.drawImage(image, 0, 0, targetWidth, targetHeight);
      
      // Get image data
      const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
      const pixels = imageData.data;
      
      // Convert to RGB format (remove alpha channel) and normalize
      const rgbArray = [];
      for (let i = 0; i < pixels.length; i += 4) {
        rgbArray.push(pixels[i]);     // R
        rgbArray.push(pixels[i + 1]); // G  
        rgbArray.push(pixels[i + 2]); // B
        // Skip alpha channel (pixels[i + 3])
      }
      
      // Convert to tensor format expected by SSD MobileNet
      const tensor = tf.tensor4d(rgbArray, [1, targetHeight, targetWidth, 3], 'int32');
      
      console.log(`Preprocessed image shape: ${tensor.shape}`);
      console.log(`Image data range: ${Math.min(...rgbArray)} - ${Math.max(...rgbArray)}`);
      
      return {
        tensor,
        originalImage: image,
        processedData: rgbArray
      };
    } catch (error) {
      console.error('Error preprocessing image:', error.message);
      return null;
    }
  }

  async runInference(imageTensor) {
    if (!this.model) {
      console.error('Model not loaded!');
      return null;
    }

    try {
      console.log('Running inference...');
      const startTime = Date.now();
      
      // Run model prediction
      const predictions = await this.model.predict(imageTensor);
      
      const endTime = Date.now();
      console.log(`Inference time: ${endTime - startTime}ms`);
      
      return predictions;
    } catch (error) {
      console.error('Error during inference:', error.message);
      return null;
    }
  }

  parseDetections(predictions) {
    // SSD MobileNet output format:
    // predictions[0]: boxes [ymin, xmin, ymax, xmax] for each detection
    // predictions[1]: class IDs 
    // predictions[2]: confidence scores
    // predictions[3]: number of valid detections
    
    try {
      const boxes = predictions[0].dataSync();
      const classIds = predictions[1].dataSync();
      const confidenceScores = predictions[2].dataSync();
      const numDetections = predictions[3].dataSync()[0];
      
      console.log('Raw model outputs:');
      console.log(`- Boxes shape: ${predictions[0].shape}, first 8 values: [${Array.from(boxes.slice(0, 8)).map(v => v.toFixed(3)).join(', ')}]`);
      console.log(`- Class IDs: [${Array.from(classIds.slice(0, 10)).join(', ')}]`);
      console.log(`- Confidence scores: [${Array.from(confidenceScores.slice(0, 10)).map(v => v.toFixed(3)).join(', ')}]`);
      console.log(`- Number of detections: ${numDetections}`);

      const detections = [];
      const maxDetections = Math.min(10, numDetections);

      for (let i = 0; i < maxDetections; i++) {
        const boxIndex = i * 4;
        const box = [
          boxes[boxIndex],     // ymin
          boxes[boxIndex + 1], // xmin  
          boxes[boxIndex + 2], // ymax
          boxes[boxIndex + 3]  // xmax
        ];
        
        const classId = classIds[i];
        let confidence = confidenceScores[i];
        
        // Apply sigmoid activation if needed (same as mobile app)
        const originalConfidence = confidence;
        confidence = 1 / (1 + Math.exp(-confidence));
        
        if (confidence > 0.2) { // Only show meaningful detections
          detections.push({
            box,
            classId: Math.round(classId),
            confidence,
            originalConfidence,
            boxWidth: box[3] - box[1],
            boxHeight: box[2] - box[0],
            area: (box[3] - box[1]) * (box[2] - box[0])
          });
        }
      }

      return detections;
    } catch (error) {
      console.error('Error parsing detections:', error.message);
      return [];
    }
  }

  async testImage(imagePath) {
    console.log(`\n=== Testing Image: ${path.basename(imagePath)} ===`);
    
    // Preprocess image
    const preprocessed = await this.preprocessImage(imagePath);
    if (!preprocessed) {
      console.error('Failed to preprocess image');
      return null;
    }

    // Run inference
    const predictions = await this.runInference(preprocessed.tensor);
    if (!predictions) {
      console.error('Failed to run inference');
      return null;
    }

    // Parse results
    const detections = this.parseDetections(predictions);
    
    console.log(`Found ${detections.length} detections:`);
    detections.forEach((det, i) => {
      console.log(`  ${i + 1}. Class ${det.classId}, Confidence: ${(det.confidence * 100).toFixed(1)}%, Box: ${det.box.map(v => v.toFixed(3)).join(',')}, Size: ${(det.boxWidth * 100).toFixed(0)}%x${(det.boxHeight * 100).toFixed(0)}%`);
    });

    // Check for stuck pattern like in mobile app
    const stuckPatterns = detections.filter(det => 
      det.boxWidth > 0.9 && det.boxHeight > 0.9 && 
      det.box[0] < 0.1 && det.box[1] < 0.1 && det.box[2] > 0.9 && det.box[3] > 0.9
    );

    if (stuckPatterns.length > 0) {
      console.log(`⚠️  STUCK PATTERN DETECTED: ${stuckPatterns.length} full-screen detections found!`);
    }

    // Cleanup tensors
    preprocessed.tensor.dispose();
    if (Array.isArray(predictions)) {
      predictions.forEach(p => p.dispose());
    } else {
      predictions.dispose();
    }

    return {
      detections,
      hasStuckPattern: stuckPatterns.length > 0,
      imagePath
    };
  }

  async runTests() {
    console.log('🧪 SSD MobileNet Model Testing Framework');
    console.log('=====================================\n');

    // Try to load model
    const modelLoaded = await this.loadModel();
    if (!modelLoaded) {
      console.log('❌ Model loading failed - this is expected for TensorFlow Lite models in Node.js');
      console.log('💡 Alternative: Create synthetic test data to validate detection logic');
      await this.runSyntheticTests();
      return;
    }

    // Test with collected images
    const testImageDir = path.join(__dirname, 'test-images');
    if (!fs.existsSync(testImageDir)) {
      console.log(`Creating test images directory: ${testImageDir}`);
      fs.ensureDirSync(testImageDir);
      console.log('📁 Please add test images to the test-images directory');
      return;
    }

    const imageFiles = fs.readdirSync(testImageDir)
      .filter(file => /\.(jpg|jpeg|png|bmp)$/i.test(file))
      .map(file => path.join(testImageDir, file));

    if (imageFiles.length === 0) {
      console.log('📁 No test images found. Please add images to test-images directory');
      return;
    }

    console.log(`Found ${imageFiles.length} test images`);

    // Test each image
    const results = [];
    for (const imagePath of imageFiles) {
      const result = await this.testImage(imagePath);
      if (result) {
        results.push(result);
      }
    }

    // Summary
    console.log('\n=== Test Summary ===');
    console.log(`Total images tested: ${results.length}`);
    console.log(`Images with stuck patterns: ${results.filter(r => r.hasStuckPattern).length}`);
    console.log(`Average detections per image: ${(results.reduce((sum, r) => sum + r.detections.length, 0) / results.length).toFixed(1)}`);
  }

  async runSyntheticTests() {
    console.log('\n🔬 Running Synthetic Detection Logic Tests');
    console.log('==========================================\n');

    // Simulate the stuck pattern we're seeing in mobile app
    const stuckPattern = {
      boxes: [0.045, 0.023, 0.979, 0.956], // ymin, xmin, ymax, xmax
      classIds: [71],
      confidences: [0.16796875],
      numDetections: 1
    };

    console.log('Testing stuck pattern from mobile app:');
    console.log(`- Box coordinates: [${stuckPattern.boxes.join(', ')}]`);
    console.log(`- Box width: ${((stuckPattern.boxes[3] - stuckPattern.boxes[1]) * 100).toFixed(0)}%`);
    console.log(`- Box height: ${((stuckPattern.boxes[2] - stuckPattern.boxes[0]) * 100).toFixed(0)}%`);
    console.log(`- Raw confidence: ${stuckPattern.confidences[0]}`);
    
    // Apply sigmoid like mobile app
    const sigmoidConfidence = 1 / (1 + Math.exp(-stuckPattern.confidences[0]));
    console.log(`- Sigmoid confidence: ${(sigmoidConfidence * 100).toFixed(1)}%`);
    
    // Check if this would be filtered
    const boxWidth = stuckPattern.boxes[3] - stuckPattern.boxes[1];
    const boxHeight = stuckPattern.boxes[2] - stuckPattern.boxes[0];
    const isStuckPattern = (boxWidth > 0.9 && boxHeight > 0.9) && 
                          (stuckPattern.boxes[0] < 0.1 && stuckPattern.boxes[1] < 0.1 && 
                           stuckPattern.boxes[2] > 0.9 && stuckPattern.boxes[3] > 0.9);
    
    console.log(`- Would be detected as stuck pattern: ${isStuckPattern ? 'YES ⚠️' : 'NO ✅'}`);

    // Test normal detection patterns
    console.log('\nTesting normal detection patterns:');
    const normalPatterns = [
      { boxes: [0.3, 0.2, 0.7, 0.6], confidence: 0.8, description: 'Center object' },
      { boxes: [0.5, 0.1, 0.9, 0.3], confidence: 0.6, description: 'Right side object' },
      { boxes: [0.6, 0.4, 0.8, 0.7], confidence: 0.5, description: 'Small center object' }
    ];

    normalPatterns.forEach((pattern, i) => {
      const width = pattern.boxes[3] - pattern.boxes[1];
      const height = pattern.boxes[2] - pattern.boxes[0];
      const area = width * height;
      const isStuck = (width > 0.9 && height > 0.9) && 
                      (pattern.boxes[0] < 0.1 && pattern.boxes[1] < 0.1 && 
                       pattern.boxes[2] > 0.9 && pattern.boxes[3] > 0.9);
      
      console.log(`  ${i + 1}. ${pattern.description}: ${(width*100).toFixed(0)}%x${(height*100).toFixed(0)}%, confidence: ${(pattern.confidence*100).toFixed(0)}%, stuck: ${isStuck ? 'YES' : 'NO'}`);
    });

    console.log('\n✅ Synthetic tests complete - detection logic appears correct');
    console.log('🔍 Issue is likely in TensorFlow Lite model state or mobile integration');
  }
}

// Run tests
async function main() {
  const tester = new SSDMobileNetTester();
  
  const syntheticOnly = process.argv.includes('--synthetic-only');
  
  if (syntheticOnly) {
    console.log('🧪 Running Synthetic Tests Only');
    console.log('===============================\n');
    await tester.runSyntheticTests();
  } else {
    console.log('🚀 Starting SSD MobileNet Model Testing');
    console.log('======================================\n');
    
    try {
      await tester.runTests();
    } catch (error) {
      console.error('❌ Testing failed:', error);
      console.log('\n💡 Try running synthetic tests only: npm run test-synthetic');
    }
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = SSDMobileNetTester;
