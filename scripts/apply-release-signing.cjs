#!/usr/bin/env node
// 이미 생성된 android/ 에 서명 플러그인과 똑같은 변환을 적용한다(prebuild 를 다시 돌리지 않고).
// 다음 `expo prebuild` 는 app.config.js 의 plugins/withReleaseSigning 이 같은 결과를 만든다.
const fs = require('fs');
const path = require('path');
const { applyReleaseSigning, MARKER } = require('../plugins/withReleaseSigning.js');

const file = path.resolve(__dirname, '../android/app/build.gradle');
if (!fs.existsSync(file)) { console.error('android/app/build.gradle 이 없어요 — npx expo prebuild --platform android'); process.exit(1); }
const before = fs.readFileSync(file, 'utf8');
if (before.includes(MARKER)) { console.log('이미 적용돼 있어요: ' + path.relative(process.cwd(), file)); process.exit(0); }
fs.writeFileSync(file, applyReleaseSigning(before));
console.log('출시 서명 변환을 적용했어요: ' + path.relative(process.cwd(), file));
