// Launch window background for Android, applied on every `expo prebuild`.
//
// Why (38.5차, 원인 확인): the generated launch theme `Theme.App.SplashScreen` uses the template bitmap
// `@drawable/splashscreen_logo` as the WHOLE window background. All five density PNGs have transparent pixels
// and there is no solid colour behind them, so until React Native draws its first frame the transparent parts
// show the empty window — black. The app itself is light (#F4F4F5 / activityBackground #F7F4EE).
//
// This plugin gives the launch window the app's light activity colour instead. It is only used while the
// expo-splash-screen plugin is not configured (no final splash asset yet); once that plugin is added it owns
// the launch styles and this one is not registered (see app.config.js).
const { withAndroidStyles } = require('expo/config-plugins');

const SPLASH_THEME = 'Theme.App.SplashScreen';
const LIGHT = '@color/activityBackground';

// Parsed styles.xml (xml2js shape used by Expo mods).
function applyLaunchBackground(styles) {
  const list = styles?.resources?.style ?? [];
  const splash = list.find(s => s.$?.name === SPLASH_THEME);
  if (!splash) return styles;
  splash.item = (splash.item ?? []).filter(item => item.$?.name !== 'android:windowBackground');
  splash.item.push({ $: { name: 'android:windowBackground' }, _: LIGHT });
  return styles;
}

// Same change on an already generated styles.xml text (used to update android/ without a clean prebuild).
function applyToStylesXml(xml) {
  const theme = new RegExp(`(<style name="${SPLASH_THEME.replace(/\./g, '\\.')}"[^>]*>)([\\s\\S]*?)(</style>)`);
  const match = xml.match(theme);
  if (!match) return xml;
  const body = /<item name="android:windowBackground">[^<]*<\/item>/.test(match[2])
    ? match[2].replace(/<item name="android:windowBackground">[^<]*<\/item>/, `<item name="android:windowBackground">${LIGHT}</item>`)
    : `${match[2]}  <item name="android:windowBackground">${LIGHT}</item>\n  `;
  return xml.replace(theme, `$1${body}$3`);
}

const withLaunchBackground = config => withAndroidStyles(config, mod => {
  mod.modResults = applyLaunchBackground(mod.modResults);
  return mod;
});

module.exports = withLaunchBackground;
module.exports.applyLaunchBackground = applyLaunchBackground;
module.exports.applyToStylesXml = applyToStylesXml;
module.exports.LIGHT = LIGHT;
