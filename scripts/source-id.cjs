#!/usr/bin/env node
// SOURCE_ID — 이 APK 가 어느 소스에서 나왔는지 가리키는 값.
//
// 커밋하지 않은 채로 빌드하므로 커밋 해시로는 소스를 가리킬 수 없다. 그래서 앱 안으로 들어가는
// 파일 전부의 내용을 해시한다.
//
// 1. 추적 파일만 해시하면 틀린다. 이 앱의 작업 상당수가 아직 미커밋 신규 파일이다
//    (src/components/motion-baker.tsx, src/services/pro.ts …). 그래서 두 목록을 합쳐 쓴다:
//      git ls-files                        추적 파일
//      git ls-files -o --exclude-standard  미추적 파일 (.gitignore 는 존중 — node_modules 는 안 들어온다)
//
// 2. **빌드에 들어가는 것만** 넣는다. 문서·검사 스크립트까지 넣으면 값이 소스가 아니라 문서를
//    가리키게 되고, SOURCE_ID 를 적은 문서 자신이 목록에 들어가 값이 절대 재현되지 않는다
//    (이전 기록이 실제로 그랬다).
const BUILD_INPUT = [
  /^index\.ts$/,            // Metro 진입점
  /^App\.tsx$/,
  /^src\//,                 // 앱 코드 전부 — 미추적 신규 파일 포함
  /^assets\//,              // 아이콘·스플래시. app.json 이 가리키고 APK 안으로 들어간다
  /^app\.json$/,            // 패키지 이름·버전·아이콘·권한
  /^app\.config\.js$/,   // 빌드 구성 — 내부 검수 빌드인지 출시 빌드인지가 여기서 갈린다
  /^package\.json$/,
  /^package-lock\.json$/,   // node_modules 자체 대신 이것이 의존성을 고정한다
  /^tsconfig\.json$/,
];
// 들어가지 않는 것과 그 이유:
//   android/      expo prebuild 가 app.json·package.json 에서 만들어 내는 결과물. 입력이 아니라 출력.
//   docs/         문서. 빌드에 들어가지 않는다.
//   scripts/      검사 스크립트. 앱 안으로 들어가지 않는다.
//   server/       영수증 검증 서버. 앱이 아니라 서버에서 돈다.
//   verification/ 검증 캡처.
//   eas.json      클라우드 빌드 설정. 이 APK 는 로컬 gradle 로 만들었다.
//   node_modules/ .gitignore 에 있어 목록에 잡히지 않는다 — package-lock.json 이 가리킨다.
const { execFileSync } = require('child_process');
const { createHash } = require('crypto');
const { readFileSync, statSync } = require('fs');

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).split('\n').map(s => s.trim()).filter(Boolean);
const isFile = path => { try { return statSync(path).isFile(); } catch { return false; } };

const tracked = git('ls-files'), untracked = git('ls-files', '-o', '--exclude-standard');
const files = [...new Set([...tracked, ...untracked])]
  .filter(path => BUILD_INPUT.some(rule => rule.test(path)) && isFile(path))
  .sort();

const lines = files.map(path => `${createHash('sha256').update(readFileSync(path)).digest('hex')}  ${path}`);
const id = createHash('sha256').update(lines.join('\n')).digest('hex');

const untrackedInBuild = files.filter(path => untracked.includes(path));
if (process.argv.includes('--list')) console.log(lines.join('\n'));
console.log(`SOURCE_ID ${id}`);
console.log(`files     ${files.length} (미추적 ${untrackedInBuild.length}개 포함)`);
if (process.argv.includes('--new')) console.log(untrackedInBuild.join('\n'));
