const fs = require('fs');
const path = require('path');

console.log('🔍 AILens Model Testing Setup Validation\n');

// Check if required files exist
const checks = [
  {
    name: 'Model file (TFLite)',
    path: path.join(__dirname, '../assets/model_ssd_mobilenet.tflite'),
    required: true
  },
  {
    name: 'Test images directory',
    path: path.join(__dirname, 'test-images'),
    required: false
  },
  {
    name: 'Results directory', 
    path: path.join(__dirname, 'results'),
    required: false
  }
];

let allGood = true;

checks.forEach(check => {
  const exists = fs.existsSync(check.path);
  const status = exists ? '✅' : (check.required ? '❌' : '⚠️');
  const message = exists ? 'Found' : 'Missing';
  
  console.log(`${status} ${check.name}: ${message}`);
  
  if (!exists && check.required) {
    allGood = false;
  }
  
  if (exists && check.name.includes('Model file')) {
    const stats = fs.statSync(check.path);
    console.log(`   Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
  }
});

console.log('\n📋 Node.js Environment:');
console.log(`✅ Node.js version: ${process.version}`);
console.log(`✅ Platform: ${process.platform} ${process.arch}`);

console.log('\n📦 Dependencies Check:');
try {
  require('@tensorflow/tfjs-node');
  console.log('✅ @tensorflow/tfjs-node: Available');
} catch (e) {
  console.log('❌ @tensorflow/tfjs-node: Not available');
  console.log(`   Error: ${e.message}`);
  allGood = false;
}

try {
  require('canvas');
  console.log('✅ canvas: Available');
} catch (e) {
  console.log('❌ canvas: Not available');
  console.log(`   Error: ${e.message}`);
  allGood = false;
}

try {
  require('axios');
  console.log('✅ axios: Available');
} catch (e) {
  console.log('❌ axios: Not available');
  allGood = false;
}

console.log('\n🎯 Summary:');
if (allGood) {
  console.log('✅ All checks passed! Ready to run model tests.');
  console.log('\nNext steps:');
  console.log('1. npm run setup    # Download test images');
  console.log('2. npm run test     # Run full model tests');
} else {
  console.log('❌ Some issues found. Please resolve them before testing.');
  console.log('\nTo install Visual Studio Build Tools:');
  console.log('1. Download from: https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022');
  console.log('2. Install with "C++ build tools" workload');
  console.log('3. Run: npm install');
}
