// Expo 기본 Metro 설정 + 문구 손글씨 폰트(WOFF2, 2026-11-03)를 번들 자산으로 싣는다.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push('woff2');

module.exports = config;
