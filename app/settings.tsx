import Slider from '@react-native-community/slider'
import { Stack } from 'expo-router'
import React from 'react'
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native'
import { useObstacleDetectionConfig, type ObstacleDetectionConfig } from '../src/hooks/useObstacleDetectionConfig'

export default function SettingsScreen() {
  const config = useObstacleDetectionConfig()
  
  // Use the live config values and update function
  const handleSliderChange = React.useCallback((key: keyof typeof config, value: number | boolean) => {
    config.updateConfig({ [key]: value })
  }, [config])

  const SettingSlider = ({ 
    title, 
    configKey,
    minimumValue, 
    maximumValue, 
    step = 0.01,
    unit = '',
    description 
  }: {
    title: string
    configKey: keyof ObstacleDetectionConfig
    minimumValue: number
    maximumValue: number
    step?: number
    unit?: string
    description?: string
  }) => (
    <View style={styles.settingContainer}>
      <View style={styles.settingHeader}>
        <Text style={styles.settingTitle}>{title}</Text>
        <Text style={styles.settingValue}>
          {typeof config[configKey] === 'number' 
            ? (config[configKey] as number).toFixed(step >= 1 ? 0 : step >= 0.1 ? 1 : step >= 0.01 ? 2 : 3)
            : config[configKey]
          }{unit}
        </Text>
      </View>
      {description && (
        <Text style={styles.settingDescription}>{description}</Text>
      )}
      <Slider
        style={styles.slider}
        minimumValue={minimumValue}
        maximumValue={maximumValue}
        value={config[configKey] as number}
        onValueChange={(value) => handleSliderChange(configKey, value)}
        step={step}
        minimumTrackTintColor="#007AFF"
        maximumTrackTintColor="#E5E5EA"
        thumbTintColor="#007AFF"
      />
      <View style={styles.sliderLabels}>
        <Text style={styles.sliderLabel}>{minimumValue}{unit}</Text>
        <Text style={styles.sliderLabel}>{maximumValue}{unit}</Text>
      </View>
    </View>
  )

  const SettingSwitch = ({ 
    title, 
    configKey,
    description 
  }: {
    title: string
    configKey: keyof ObstacleDetectionConfig
    description?: string
  }) => (
    <View style={styles.settingContainer}>
      <View style={styles.switchContainer}>
        <View style={styles.switchText}>
          <Text style={styles.settingTitle}>{title}</Text>
          {description && (
            <Text style={styles.settingDescription}>{description}</Text>
          )}
        </View>
        <Switch
          value={config[configKey] as boolean}
          onValueChange={(value) => handleSliderChange(configKey, value)}
          trackColor={{ false: '#E5E5EA', true: '#34C759' }}
          thumbColor="#FFFFFF"
        />
      </View>
    </View>
  )

  return (
    <>
      <Stack.Screen 
        options={{ 
          title: 'Detection Settings',
          headerStyle: { backgroundColor: '#000' },
          headerTintColor: '#fff'
        }} 
      />
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Detection Thresholds</Text>
          
          <SettingSlider
            title="Obstacle Threshold"
            configKey="OBSTACLE_THRESHOLD"
            minimumValue={0.1}
            maximumValue={1.0}
            step={0.05}
            description="Minimum height threshold for obstacle detection. Higher = only taller obstacles."
          />
          
          <SettingSlider
            title="Minimum Confidence"
            configKey="OBSTACLE_MIN_CONFIDENCE"
            minimumValue={0.1}
            maximumValue={1.0}
            step={0.05}
            unit="%"
            description="AI confidence required for detection. Higher = fewer false positives."
          />
          
          <SettingSlider
            title="Hysteresis"
            configKey="OBSTACLE_HYSTERESIS"
            minimumValue={0.05}
            maximumValue={0.5}
            step={0.05}
            description="Buffer zone to prevent rapid on/off switching. Higher = more stable."
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Temporal Stability</Text>
          
          <SettingSlider
            title="Detection Frames"
            configKey="OBSTACLE_FRAMES"
            minimumValue={5}
            maximumValue={50}
            step={1}
            unit=" frames"
            description="Number of frames to analyze. Higher = more stable but slower response."
          />
          
          <SettingSlider
            title="Smoothing Window"
            configKey="OBSTACLE_SMOOTHING_WINDOW"
            minimumValue={3}
            maximumValue={20}
            step={1}
            unit=" frames"
            description="Smoothing window size. Higher = smoother but less responsive."
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Movement Detection</Text>
          
          <SettingSlider
            title="Minimum Slope"
            configKey="OBSTACLE_MIN_SLOPE"
            minimumValue={0.001}
            maximumValue={0.1}
            step={0.001}
            description="Minimum slope change to trigger state change. Higher = less sensitive."
          />
          
          <SettingSlider
            title="Sudden Delta"
            configKey="OBSTACLE_SUDDEN_DELTA"
            minimumValue={0.05}
            maximumValue={0.5}
            step={0.05}
            description="Threshold for sudden obstacle appearance. Higher = requires bigger jumps."
          />
          
          <SettingSwitch
            title="Allow Size-Only Detection"
            configKey="OBSTACLE_ALLOW_SIZE_ONLY"
            description="Allow detection based on size alone, without movement requirements."
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Feedback Settings</Text>
          
          <SettingSlider
            title="Speech Confidence"
            configKey="OBSTACLE_SPEECH_CONFIDENCE"
            minimumValue={0.5}
            maximumValue={1.0}
            step={0.05}
            unit="%"
            description="Confidence required for speech announcements. Higher = only very confident detections."
          />
          
          <SettingSlider
            title="Haptic Repeat Interval"
            configKey="OBSTACLE_HAPTIC_REPEAT_MS"
            minimumValue={500}
            maximumValue={5000}
            step={100}
            unit="ms"
            description="Time between haptic feedback repeats. Higher = less frequent vibrations."
          />
          
          <SettingSlider
            title="Detection Cooldown"
            configKey="DETECTION_COOLDOWN_MS"
            minimumValue={100}
            maximumValue={2000}
            step={50}
            unit="ms"
            description="Minimum time between detection reports. Higher = less frequent updates."
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.settingContainer}>
            <View style={styles.switchContainer}>
              <View style={styles.switchText}>
                <Text style={styles.settingTitle}>Reset to Defaults</Text>
                <Text style={styles.settingDescription}>
                  Restore all settings to their original values from the .env file.
                </Text>
              </View>
              <Switch
                value={false}
                onValueChange={() => config.resetToDefaults()}
                trackColor={{ false: '#E5E5EA', true: '#FF3B30' }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Settings changes take effect immediately and are shared across all detection components.
          </Text>
          <Text style={styles.footerText}>
            Future version will include save/load presets and persistence.
          </Text>
        </View>
      </ScrollView>
    </>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  section: {
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
    marginTop: 8,
  },
  settingContainer: {
    marginBottom: 24,
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    padding: 16,
  },
  settingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
  },
  settingValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  settingDescription: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 12,
    lineHeight: 20,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  sliderLabel: {
    fontSize: 12,
    color: '#8E8E93',
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  switchText: {
    flex: 1,
    marginRight: 16,
  },
  footer: {
    padding: 20,
    paddingBottom: 40,
  },
  footerText: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 20,
  },
})
