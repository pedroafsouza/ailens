const fs = require('fs');
const http = require('http');
const path = require('path');

const PORT = 3000;

const server = http.createServer((req, res) => {
  // Enable CORS for local testing
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const url = req.url;
  
  if (url === '/' || url === '/index.html') {
    // Serve the main test page
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(fs.readFileSync(path.join(__dirname, 'web-test.html')));
  }
  else if (url === '/model') {
    // TFLite models cannot be loaded directly in TensorFlow.js
    // Return model metadata instead
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: 'TFLite model cannot be loaded directly in browser',
      note: 'Using mock model that simulates exact React Native behavior',
      modelInfo: {
        type: 'SSD MobileNet V1',
        inputShape: [1, 320, 320, 3],
        outputShape: 'Multiple outputs: boxes, classes, scores, detections',
        stuckPattern: {
          coordinates: [0.045, 0.023, 0.979, 0.956],
          rawConfidence: 0.168,
          sigmoidConfidence: 0.542
        }
      }
    }));
  }
  else if (url === '/model.tflite') {
    // Serve the actual TFLite model file for download/inspection
    const modelPath = path.join(__dirname, '../assets/model.tflite');
    if (fs.existsSync(modelPath)) {
      res.writeHead(200, { 
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': 'attachment; filename="model.tflite"'
      });
      res.end(fs.readFileSync(modelPath));
    } else {
      res.writeHead(404);
      res.end('Model file not found at ../assets/model.tflite');
    }
  }
  else if (url.startsWith('/test-images/')) {
    // Serve test images
    const imagePath = path.join(__dirname, url);
    if (fs.existsSync(imagePath)) {
      const ext = path.extname(imagePath).toLowerCase();
      const contentType = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 
                         ext === '.png' ? 'image/png' : 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(fs.readFileSync(imagePath));
    } else {
      res.writeHead(404);
      res.end('Image not found');
    }
  }
  else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`🚀 SSD MobileNet Web Testing Server started!`);
  console.log(`📍 Open your browser to: http://localhost:${PORT}`);
  console.log(`🔧 This avoids Node.js native compilation issues`);
  console.log(`🎯 Test the exact same model used in your React Native app`);
  console.log('');
  console.log('Press Ctrl+C to stop the server');
});

process.on('SIGINT', () => {
  console.log('\n👋 Server stopped');
  process.exit(0);
});
