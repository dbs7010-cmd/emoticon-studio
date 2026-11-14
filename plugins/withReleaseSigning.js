// Release signing for Android, applied on every `expo prebuild`.
//
// android/ is a generated folder (git-ignored), so hand edits to android/app/build.gradle are lost on
// `prebuild --clean`. This plugin puts the same change back every time.
//
// What it does to app/build.gradle:
//   - adds signingConfigs.release, filled ONLY from ~/.gradle/gradle.properties (or GRADLE_USER_HOME) or
//     environment variables: EMOTICON_UPLOAD_STORE_FILE / _STORE_PASSWORD / _KEY_ALIAS / _KEY_PASSWORD.
//     No value lives in the repo.
//   - release buildType signs with that upload key. The template's `signingConfig signingConfigs.debug` is gone.
//   - a task-graph guard: bundle*Release (AAB) never runs without the upload key. assembleRelease (APK) may use
//     the debug key only when EMOTICON_ALLOW_DEBUG_SIGNED_RELEASE=1 — for internal review APKs, never for Play.
// If the template changes shape, this throws instead of silently leaving debug signing in place.
const { withAppBuildGradle } = require('expo/config-plugins');

const MARKER = '// @emoticon-release-signing';

const HELPER = `${MARKER}
// Release signing values are never stored in this repo. They are read from ~/.gradle/gradle.properties
// (or GRADLE_USER_HOME) or environment variables. See docs/RELEASE_SIGNING.md.
def emoticonSigning = { String name -> (findProperty(name) ?: System.getenv(name)) }
def emoticonUploadConfigured = emoticonSigning('EMOTICON_UPLOAD_STORE_FILE') != null
def emoticonAllowDebugRelease = emoticonSigning('EMOTICON_ALLOW_DEBUG_SIGNED_RELEASE') == '1'

android {
`;

const DEBUG_SIGNING = `        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }`;

const WITH_RELEASE_SIGNING = `        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
        release {
            if (emoticonUploadConfigured) {
                storeFile file(emoticonSigning('EMOTICON_UPLOAD_STORE_FILE'))
                storePassword emoticonSigning('EMOTICON_UPLOAD_STORE_PASSWORD')
                keyAlias emoticonSigning('EMOTICON_UPLOAD_KEY_ALIAS')
                keyPassword emoticonSigning('EMOTICON_UPLOAD_KEY_PASSWORD')
            }
        }
    }`;

const TEMPLATE_RELEASE_LINE = `            // Caution! In production, you need to generate your own keystore file.
            // see https://reactnative.dev/docs/signed-apk-android.
            signingConfig signingConfigs.debug
`;

const RELEASE_LINE = `            // Release builds are signed with the upload key only. Internal review APKs may opt into the debug key
            // with EMOTICON_ALLOW_DEBUG_SIGNED_RELEASE=1; app bundles (AAB) never can (see guard at the end of this file).
            signingConfig emoticonUploadConfigured ? signingConfigs.release : (emoticonAllowDebugRelease ? signingConfigs.debug : signingConfigs.release)
`;

const GUARD = `
${MARKER} guard
gradle.taskGraph.whenReady { graph ->
    // Only this app module's tasks: library modules run bundleLibRuntimeToJarRelease etc. for every release APK.
    def names = graph.allTasks.findAll { it.project == project }.collect { it.name }
    def bundling = names.any { it == 'bundleRelease' || it == 'signReleaseBundle' || it == 'packageReleaseBundle' }
    def packaging = names.any { it == 'packageRelease' || it == 'assembleRelease' }
    if ((bundling || packaging) && !emoticonUploadConfigured) {
        if (bundling || !emoticonAllowDebugRelease) {
            throw new GradleException('Release signing is not configured. Set EMOTICON_UPLOAD_STORE_FILE, EMOTICON_UPLOAD_STORE_PASSWORD, EMOTICON_UPLOAD_KEY_ALIAS and EMOTICON_UPLOAD_KEY_PASSWORD in ~/.gradle/gradle.properties or the environment (docs/RELEASE_SIGNING.md). Release app bundles are never signed with the debug key.')
        }
    }
    if ((bundling || packaging) && emoticonUploadConfigured) {
        ['EMOTICON_UPLOAD_STORE_PASSWORD', 'EMOTICON_UPLOAD_KEY_ALIAS', 'EMOTICON_UPLOAD_KEY_PASSWORD'].each { key ->
            if (!emoticonSigning(key)) throw new GradleException('Release signing value is missing: ' + key)
        }
        if (!file(emoticonSigning('EMOTICON_UPLOAD_STORE_FILE')).exists()) throw new GradleException('Upload keystore file not found (EMOTICON_UPLOAD_STORE_FILE).')
    }
}
`;

function applyReleaseSigning(contents) {
  if (contents.includes(MARKER)) return contents;
  const count = (text, part) => text.split(part).length - 1;
  if (count(contents, '\nandroid {\n') !== 1) throw new Error('withReleaseSigning: expected one "android {" block in app/build.gradle');
  if (count(contents, DEBUG_SIGNING) !== 1) throw new Error('withReleaseSigning: debug signingConfig block not found — template changed, update plugins/withReleaseSigning.js');
  if (count(contents, TEMPLATE_RELEASE_LINE) !== 1) throw new Error('withReleaseSigning: release buildType debug signing line not found — template changed, update plugins/withReleaseSigning.js');
  return contents
    .replace('\nandroid {\n', () => '\n' + HELPER)
    .replace(DEBUG_SIGNING, () => WITH_RELEASE_SIGNING)
    .replace(TEMPLATE_RELEASE_LINE, () => RELEASE_LINE)
    .replace(/\s*$/, '\n') + GUARD;
}

const withReleaseSigning = config => withAppBuildGradle(config, mod => {
  if (mod.modResults.language !== 'groovy') throw new Error('withReleaseSigning: only Groovy app/build.gradle is supported');
  mod.modResults.contents = applyReleaseSigning(mod.modResults.contents);
  return mod;
});

module.exports = withReleaseSigning;
module.exports.applyReleaseSigning = applyReleaseSigning;
module.exports.MARKER = MARKER;
