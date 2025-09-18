import * as React from 'react'
import { StyleSheet, Text, View } from 'react-native'

export default function DetectionOverlay({
  detected,
  height,
  confidence,
  modelAvailable,
}: {
  detected: boolean
  height: number | null
  confidence: number | null
  modelAvailable: boolean
}) {
  return (
  <View style={styles.overlay} pointerEvents="box-none">
      <Text style={styles.overlayText}>
        {detected ? 'Obstacle detected!' : 'No obstacle'}
      </Text>
      <Text style={styles.overlayText}>
        {height != null ? `h: ${height.toFixed(3)}` : ''}
      </Text>
      <Text style={styles.overlayText}>
        {confidence != null ? `conf: ${confidence.toFixed(2)}` : ''}
      </Text>
      <Text style={styles.overlayText}>
        {`model: ${modelAvailable ? 'yes' : 'no'}`}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    padding: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 8,
  },
  overlayText: {
    color: 'white',
    fontSize: 12,
  },
})
