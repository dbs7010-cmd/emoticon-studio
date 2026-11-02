// 문구 손글씨 폰트 목록(2026-11-03). 앱 쪽 목록(src/design/fonts.ts)과 key 가 같아야 한다 — scripts 의 테스트가 맞춰 본다.
// 모두 Google Fonts(github.com/google/fonts/ofl) · SIL Open Font License 1.1.
const FONT_FILES = [
  { key: 'gaegu', lang: 'ko', source: 'Gaegu-Regular.ttf' },
  { key: 'nanumpen', lang: 'ko', source: 'NanumPenScript-Regular.ttf' },
  { key: 'jua', lang: 'ko', source: 'Jua-Regular.ttf' },
  { key: 'poorstory', lang: 'ko', source: 'PoorStory-Regular.ttf' },
  { key: 'gamjaflower', lang: 'ko', source: 'GamjaFlower-Regular.ttf' },
  { key: 'himelody', lang: 'ko', source: 'HiMelody-Regular.ttf' },
  { key: 'singleday', lang: 'ko', source: 'SingleDay-Regular.ttf' },
  { key: 'cutefont', lang: 'ko', source: 'CuteFont-Regular.ttf' },
  { key: 'yeonsung', lang: 'ko', source: 'YeonSung-Regular.ttf' },
  { key: 'dokdo', lang: 'ko', source: 'EastSeaDokdo-Regular.ttf' },
  { key: 'yomogi', lang: 'ja', source: 'Yomogi-Regular.ttf' },
  { key: 'kleeone', lang: 'ja', source: 'KleeOne-Regular.ttf' },
  { key: 'hachimaru', lang: 'ja', source: 'HachiMaruPop-Regular.ttf' },
  { key: 'yusei', lang: 'ja', source: 'YuseiMagic-Regular.ttf' },
  { key: 'kurenaido', lang: 'ja', source: 'ZenKurenaido-Regular.ttf' },
  { key: 'huninn', lang: 'zh-Hant', source: 'Huninn-Regular.ttf' },
  { key: 'iansui', lang: 'zh-Hant', source: 'Iansui-Regular.ttf' },
  { key: 'wenkai', lang: 'zh-Hant', source: 'LXGWWenKaiTC-Regular.ttf' },
];
module.exports = { FONT_FILES };
