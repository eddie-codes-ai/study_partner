// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// expo-sqlite's web implementation loads a wa-sqlite .wasm binary; Metro
// needs to know to treat it as an asset rather than trying to parse it as JS.
config.resolver.assetExts.push('wasm');

module.exports = config;
