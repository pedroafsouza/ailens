import { useRouter } from 'expo-router'
import * as React from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useDetectionPause } from '../../src/hooks/useDetectionPause'
import { NavigationResult, useNavigationGuidance } from '../../src/hooks/useNavigationGuidance'

export default function DetectionOverlay({
  detected,
  height,
  confidence,
  modelAvailable,
  boundingBox,
  allDetections = [],
}: {
  detected: boolean
  height: number | null
  confidence: number | null
  modelAvailable: boolean
  boundingBox?: {
    x: number
    y: number
    width: number
    height: number
  } | null
  allDetections?: Array<{
    boundingBox: { x: number; y: number; width: number; height: number }
    confidence: number
  }>
}) {
  const router = useRouter()
  const { paused } = useDetectionPause()
  const { analyzeDetections } = useNavigationGuidance()
  
  // Calculate navigation guidance
  const navigationResult: NavigationResult = React.useMemo(() => {
    return analyzeDetections(allDetections)
  }, [allDetections, analyzeDetections])
  
  // Helper function to get direction icon
  const getDirectionIcon = (direction: string) => {
    switch (direction) {
      case 'left': return '⬅️'
      case 'right': return '➡️'
      case 'straight': return '⬆️'
      case 'stop': return '🛑'
      default: return '❓'
    }
  }
  
  // Helper function to get direction style
  const getDirectionStyle = (direction: string) => {
    switch (direction) {
      case 'left': return styles.directionLeft
      case 'right': return styles.directionRight
      case 'straight': return styles.directionStraight
      case 'stop': return styles.directionStop
      default: return {}
    }
  }

  return (
    <View style={styles.container} pointerEvents="box-none">
      {/* Pause Overlay */}
      {paused && (
        <View style={styles.pausedOverlay}>
          <Text style={styles.pausedText}>⏸️ Detection Paused</Text>
        </View>
      )}
      
      {/* Bounding Box Visualization */}
      {boundingBox && detected && !paused && (
        // Only show if bounding box is reasonable size (not huge)
        boundingBox.width < 0.7 && boundingBox.height < 0.6 && 
        (boundingBox.width * boundingBox.height) < 0.4 ? (
          <View 
            style={[
              styles.boundingBox,
              {
                left: `${boundingBox.x * 100}%`,
                top: `${boundingBox.y * 100}%`,
                width: `${boundingBox.width * 100}%`,
                height: `${boundingBox.height * 100}%`,
              }
            ]} 
            pointerEvents="none"
          >
            {/* Optional: Add confidence label inside the box */}
            <View style={styles.confidenceLabel}>
              <Text style={styles.confidenceText}>
                {confidence ? (confidence * 100).toFixed(0) : '0'}%
              </Text>
            </View>
          </View>
        ) : null
      )}
      
      {/* Detection Info Overlay */}
      <View style={styles.overlay} pointerEvents="box-none">
        <Text style={styles.overlayText}>
          {detected ? 'Obstacle detected!' : 'No obstacle'}
        </Text>
        <Text style={styles.overlayText}>
          {height != null ? `Distance: ${height.toFixed(2)}m` : ''}
        </Text>
        <Text style={styles.overlayText}>
          {confidence != null ? `Confidence: ${(confidence * 100).toFixed(1)}%` : ''}
        </Text>
        <Text style={styles.overlayText}>
          {`Model: SSD MobileNet ${modelAvailable ? 'Ready' : 'Loading...'}`}
        </Text>
        
        {/* Navigation Guidance */}
        <View style={styles.navigationSection}>
          <Text style={[styles.overlayText, styles.navigationHeader]}>
            🧭 Navigation
          </Text>
          <Text style={[styles.overlayText, getDirectionStyle(navigationResult.direction)]}>
            {getDirectionIcon(navigationResult.direction)} {navigationResult.direction.toUpperCase()}
          </Text>
          <Text style={styles.navigationDetail}>
            L:{navigationResult.leftObstacles} C:{navigationResult.centerObstacles} R:{navigationResult.rightObstacles}
          </Text>
          {navigationResult.obstacleCount > 0 && (
            <Text style={styles.navigationDetail}>
              Avg Confidence: {(navigationResult.confidence * 100).toFixed(0)}%
            </Text>
          )}
        </View>
        
        {/* Debug info for bounding box */}
        {boundingBox && (
          <Text style={styles.debugText}>
            Box: {(boundingBox.width * 100).toFixed(0)}%×{(boundingBox.height * 100).toFixed(0)}% 
            Area: {((boundingBox.width * boundingBox.height) * 100).toFixed(1)}%
          </Text>
        )}
      </View>

      {/* Settings Button */}
      <TouchableOpacity 
        style={styles.settingsButton} 
        onPress={() => router.push('/settings')}
      >
        <Text style={styles.settingsButtonText}>⚙️</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    top: 0,
    pointerEvents: 'box-none',
  },
  overlay: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 8,
    minWidth: 180,
  },
  overlayText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 2,
  },
  settingsButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 50,
    height: 50,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  settingsButtonText: {
    fontSize: 24,
  },
  pausedOverlay: {
    position: 'absolute',
    top: '40%',
    left: 20,
    right: 20,
    padding: 16,
    backgroundColor: 'rgba(255, 165, 0, 0.9)',
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  pausedText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  boundingBox: {
    position: 'absolute',
    borderWidth: 3,
    borderColor: '#ff0000',
    backgroundColor: 'rgba(255, 0, 0, 0.15)',
    borderRadius: 4,
    shadowColor: '#ff0000',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 3,
  },
  confidenceLabel: {
    position: 'absolute',
    top: -25,
    left: 0,
    backgroundColor: 'rgba(255, 0, 0, 0.9)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    minWidth: 40,
    alignItems: 'center',
  },
  confidenceText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  debugText: {
    color: '#ffff00',
    fontSize: 10,
    fontWeight: '400',
    marginTop: 4,
  },
  navigationSection: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.3)',
  },
  navigationHeader: {
    fontWeight: 'bold',
    color: '#87CEEB',
  },
  navigationDetail: {
    color: '#cccccc',
    fontSize: 12,
    fontWeight: '400',
    marginTop: 2,
  },
  directionLeft: {
    color: '#FFD700', // Gold for left
  },
  directionRight: {
    color: '#FFD700', // Gold for right
  },
  directionStraight: {
    color: '#90EE90', // Light green for straight
  },
  directionStop: {
    color: '#FF6B6B', // Red for stop
  },
})
