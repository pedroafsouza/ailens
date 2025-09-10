const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname, {
  isCSSEnabled: true,
  resolver: {
    sourceExts: ["jsx", "js", "ts", "tsx", "cjs", "json"],
  },
});

config.resolver.assetExts.push("tflite");

module.exports = config;
