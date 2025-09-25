# SSD MobileNet Model Testing Framework

This framework tests the SSD MobileNet model outside the mobile app environment to debug the persistent detection issues.

## Problem Context

The mobile app is experiencing a critical issue where the SSD MobileNet model becomes "stuck" after the first detection, consistently returning identical coordinates:
- Bounding box: [0.045, 0.023, 0.979, 0.956] 
- Confidence: ~0.168
- This represents 95% of the screen, indicating model freeze

## Testing Approach

1. **Synthetic Testing**: Test detection logic with known data patterns
2. **Image Testing**: Test model with real-world road/obstacle images  
3. **Stuck Detection Validation**: Verify our stuck detection algorithms work correctly
4. **Model Behavior Analysis**: Compare desktop vs mobile model behavior

## Quick Start

### Setup
```bash
# Install dependencies
npm install

# Download test images
npm run setup
```

### Run Tests
```bash
# Full test suite (synthetic + images)
npm test

# Synthetic tests only (no model loading required)
npm run test-synthetic

# Complete setup and testing
npm run full-test
```

## Test Components

### 1. Synthetic Tests (`runSyntheticTests()`)
- Tests detection logic without actual model inference
- Validates stuck detection algorithms
- Uses patterns from actual mobile app data
- **No model loading required** - always works

### 2. Image Tests (`testWithImages()`) 
- Loads actual SSD MobileNet model
- Tests with real road/obstacle images
- Compares outputs to mobile behavior
- **Requires working TensorFlow.js environment**

### 3. Stuck Detection Tests
- Validates the stuck pattern detection logic
- Tests box size calculations
- Verifies confidence thresholds
- Matches mobile app implementation

## Expected Outputs

### Normal Behavior
- Variable bounding boxes
- Confidence scores 20-95%
- Multiple object classes
- Box sizes 10-70% of screen

### Stuck Pattern (Mobile Issue)
- Identical coordinates across frames
- Fixed confidence ~16.8%
- Always class 71 (clock in COCO)
- Box covers 95% of screen

## Test Image Sources

Test images cover various scenarios:
- Street scenes with pedestrians
- Roads with vehicles  
- Construction/obstacles
- Empty roads (control cases)
- Complex urban intersections

## Debugging Mobile Issues

### If Desktop Tests Pass
- Issue is mobile-specific integration
- Check TensorFlow Lite setup
- Verify model file integrity
- Test frame preprocessing pipeline

### If Desktop Tests Also Stuck
- Model file is corrupted
- TensorFlow version compatibility
- Need alternative model

### If Synthetic Tests Fail
- Detection logic errors
- Stuck detection algorithm issues
- Port fixes back to mobile app

## Key Files

- `test-model.js`: Main testing framework
- `collect-images.js`: Downloads test images
- `test-images/synthetic/`: Synthetic test data
- `package.json`: Dependencies and scripts

## Model Limitations in Node.js

⚠️ **Important**: TensorFlow Lite models may not load properly in Node.js environment. If model loading fails:

1. Use synthetic tests to validate detection logic
2. Consider converting to TensorFlow.js format
3. Test with TensorFlow.js saved model instead

The synthetic tests are designed to work without model loading and validate the critical stuck detection logic used in the mobile app.

## Next Steps

1. **Run synthetic tests** to validate detection logic
2. **Compare results** with mobile app behavior  
3. **Identify root cause** of stuck detection
4. **Implement fixes** in mobile app
5. **Test with real model** if TensorFlow.js setup works

## Mobile App Integration

Fixes identified here should be applied to:
- `src/hooks/useTensorFlowDetectionProcessor.ts`
- Stuck detection monitoring logic
- Box size calculation algorithms  
- Confidence threshold handling
