const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');

class ImageCollector {
  constructor() {
    this.testImageDir = path.join(__dirname, 'test-images');
    this.imageUrls = [
      // Street scenes with pedestrians
      'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=400&h=400&fit=crop', // City street
      'https://images.unsplash.com/photo-1534430480872-3498386e7856?w=400&h=400&fit=crop', // Person walking
      'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&h=400&fit=crop', // Crosswalk
      
      // Roads with vehicles
      'https://images.unsplash.com/photo-1486313585504-1d3e9992b6a0?w=400&h=400&fit=crop', // Street with cars
      'https://images.unsplash.com/photo-1493238792000-8113da705763?w=400&h=400&fit=crop', // Highway
      
      // Road obstacles
      'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=400&h=400&fit=crop', // Construction
      'https://images.unsplash.com/photo-1502570149819-b2260483d302?w=400&h=400&fit=crop', // Road signs
      
      // Empty roads (control cases)
      'https://images.unsplash.com/photo-1583039866647-b3608c8b0c28?w=400&h=400&fit=crop', // Empty road
      'https://images.unsplash.com/photo-1544552866-d3ed42536cfd?w=400&h=400&fit=crop', // Rural road
      
      // Complex scenes
      'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=400&h=400&fit=crop', // Busy street
      'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=400&h=400&fit=crop'  // Urban intersection
    ];
  }

  async downloadImage(url, filename) {
    try {
      console.log(`Downloading: ${filename}`);
      const response = await axios({
        method: 'GET',
        url: url,
        responseType: 'stream',
        timeout: 10000
      });

      const filepath = path.join(this.testImageDir, filename);
      const writer = fs.createWriteStream(filepath);
      
      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on('finish', () => {
          console.log(`✅ Downloaded: ${filename}`);
          resolve(filepath);
        });
        writer.on('error', reject);
      });
    } catch (error) {
      console.error(`❌ Failed to download ${filename}: ${error.message}`);
      return null;
    }
  }

  async collectTestImages() {
    console.log('📥 Collecting Test Images for SSD MobileNet Testing');
    console.log('=================================================\n');

    // Ensure test images directory exists
    fs.ensureDirSync(this.testImageDir);

    console.log(`Downloading ${this.imageUrls.length} test images...`);

    const downloadPromises = this.imageUrls.map((url, index) => {
      const filename = `test-${String(index + 1).padStart(2, '0')}.jpg`;
      return this.downloadImage(url, filename);
    });

    const results = await Promise.allSettled(downloadPromises);
    
    const successful = results.filter(r => r.status === 'fulfilled' && r.value !== null).length;
    const failed = results.length - successful;

    console.log(`\n📊 Download Summary:`);
    console.log(`- Successful: ${successful}`);
    console.log(`- Failed: ${failed}`);
    console.log(`- Total: ${results.length}`);

    if (successful > 0) {
      console.log(`\n✅ Test images ready in: ${this.testImageDir}`);
      console.log('🚀 Run "npm test" to start model testing');
    } else {
      console.log('\n❌ No images downloaded successfully');
      console.log('💡 You can manually add test images to the test-images directory');
    }

    return successful;
  }

  async createSyntheticTestData() {
    console.log('\n🎨 Creating Synthetic Test Data');
    console.log('==============================\n');

    const syntheticDir = path.join(this.testImageDir, 'synthetic');
    fs.ensureDirSync(syntheticDir);

    // Create synthetic test data that mimics the model outputs we're seeing
    const testCases = [
      {
        name: 'stuck-pattern-test.json',
        description: 'Simulates the stuck pattern from mobile app',
        data: {
          boxes: [0.04501655697822571, 0.02252677083015442, 0.9787411689758301, 0.9562513828277588],
          classIds: [71],
          confidences: [0.16796875],
          numDetections: 1,
          metadata: {
            source: 'mobile-app-stuck-pattern',
            boxWidth: 0.9337348127126646,
            boxHeight: 0.9337248407576773,
            expectedStuckDetection: true
          }
        }
      },
      {
        name: 'normal-detection-test.json', 
        description: 'Normal detection pattern',
        data: {
          boxes: [0.3, 0.2, 0.7, 0.6, 0.1, 0.5, 0.4, 0.8],
          classIds: [1, 3], // Person, car
          confidences: [0.85, 0.72],
          numDetections: 2,
          metadata: {
            source: 'synthetic-normal',
            expectedStuckDetection: false
          }
        }
      },
      {
        name: 'edge-case-test.json',
        description: 'Edge case - large but not stuck',
        data: {
          boxes: [0.1, 0.1, 0.8, 0.8],
          classIds: [2],
          confidences: [0.65],
          numDetections: 1,
          metadata: {
            source: 'synthetic-edge-case',
            boxWidth: 0.7,
            boxHeight: 0.7,
            expectedStuckDetection: false
          }
        }
      }
    ];

    for (const testCase of testCases) {
      const filepath = path.join(syntheticDir, testCase.name);
      await fs.writeJson(filepath, testCase, { spaces: 2 });
      console.log(`✅ Created: ${testCase.name} - ${testCase.description}`);
    }

    console.log(`\n📁 Synthetic test data created in: ${syntheticDir}`);
    return testCases.length;
  }
}

async function main() {
  const collector = new ImageCollector();
  
  // Collect real images
  const downloadedCount = await collector.collectTestImages();
  
  // Create synthetic test data
  const syntheticCount = await collector.createSyntheticTestData();
  
  console.log(`\n🎯 Setup Complete!`);
  console.log(`- Real images: ${downloadedCount}`);
  console.log(`- Synthetic test cases: ${syntheticCount}`);
  console.log(`\n▶️  Next steps:`);
  console.log(`   1. Run "npm test" to test model detection logic`);
  console.log(`   2. Compare results with mobile app behavior`);
  console.log(`   3. Analyze differences to identify root cause`);
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = ImageCollector;
