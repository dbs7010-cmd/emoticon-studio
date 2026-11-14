# 브러시 대응표 (v2 · 무료 10 + PRO 20)

문서 ID(`F01`·`P01`…)는 **앱 ID 가 아니다.** 앱이 저장하는 값은 `엔진 ID` 칸이고, 효과가 같으면
예전 이름을 그대로 쓴다. 이 표는 v2 구성표를 받은 45.31 에 작성했다.

## 어디에 무엇이 저장되나 (바꾸기 전에 확인한 것)

| 무엇 | 어디에 | 형식 |
|---|---|---|
| 지금 브러시 | `Project.brush` (`BrushSettings`) | `{ preset?, base?, opacity?, stabilizer?, width?, eraserWidth? }` |
| 브러시 이름 | `BrushSettings.preset` — **문자열 합집합**. 예전 이름은 하나도 지우지 않았다 | `'ink' | 'soft' | … | 'glowpen'` |
| 기본 브러시 | `BrushSettings.base` — 엔진의 펜·붓·연필 | `'pen' | 'brush' | 'pencil'` |
| 즐겨찾기 3칸 | `Store.favoriteBrushes` — **45.31 에 더한 선택 항목**. 없으면 기본값으로 연다 | `string[]`(최대 3) |
| 그린 그림 | 레이어 PNG (`Project.slots[].work` / `finalImage`) | 래스터 — 브러시를 바꿔도 **이미 그린 그림은 변하지 않는다** |

그림이 래스터로 저장되기 때문에, 브러시를 고쳐도 **저장된 작품의 겉모습은 바뀌지 않는다.**
바뀔 수 있는 것은 "옛 그림을 다시 열어 **이어 그릴 때**의 새 획"뿐이다. 그래서 겉모습이 달라지는
개선은 **새 엔진 ID 로** 넣고 예전 ID 를 남겼다(마커·붓펜·연필).

## 무료 10

| 문서 | 제품명 | 엔진 ID | 원본 후보 | 어떻게 했나 |
|---|---|---|---|---|
| F01 | 기본 펜 | `base:pen` | classic/pen | 기존 그대로. 원본의 압력·속도 굵기는 쓰지 않는다(균일 펜이 목표) |
| F02 | 자연 잉크 | `inknatural` | experimental/irregular_ink | **새로.** dab 을 획 방향으로 눕혀(ratio 1.15·angle along) 가장자리만 미세하게 변한다. 중심선은 손을 그대로 따른다 |
| F03 | 테이퍼 펜 | `ink` | classic/pointy_ink | 기존 재사용. 원본의 `stroke_duration 1.18`(획 길이에 따른 가늘어짐)이 기존 `taper:16` 과 같은 뜻이라 그대로 썼다 |
| F04 | 붓펜 | `brushpen2` | ramon/PenBrush | **새로.** 압력이 없으므로 **속도**로 굵기를 바꾼다(천천히 굵게·빠르게 가늘게). 예전 `brushpen`(고정 굵기)은 호환용으로 남는다 |
| F05 | 연필 | `pencil2` | deevad/2B_pencil | **새로.** 옅은 dab 을 촘촘히 찍고 종이결을 건다. 예전 `base:pencil`(반투명 선 + 점)은 호환용으로 남는다 |
| F06 | 색연필 | `colorpencil` | tanda/pencil-2b | **새로.** F05 보다 결이 굵고(grainScale 3) 진해, 덧칠하면 같은 골에 색이 쌓인다 |
| F07 | 불투명 채색붓 | `opaque` | ramon/100%_Opaque | **새로.** hardness .95·opaque 1 — 한 획 안에서 겹쳐도 면이 고르다 |
| F08 | 마커 | `marker2` | ramon/Marker | **새로.** 원본대로 진행 방향에 직각인 납작 dab(ratio 2.6·angle dir). 45.29 의 빗살이 사라진다. 예전 `marker` 는 그대로 남는다 |
| F09 | 에어브러시 | `airbrush` | deevad/airbrush | 기존 재사용 · **PRO → 무료** |
| F10 | 납작 펜 | `flat` | classic/calligraphy | **새로.** 팁 각도 46° 고정(원본 45.92°). 진행 방향과 이루는 각으로 굵기가 달라진다. 예전 `chisel`(고정 굵기)은 호환용으로 남는다 |

## PRO 20

| 문서 | 제품명 | 엔진 ID | 원본 후보 | 어떻게 했나 |
|---|---|---|---|---|
| P01 | 거친 잉크 | `inkrough` | classic/textured_ink | **새로.** hardness 1 로 속은 꽉 차고, 자리 흔들림으로 가장자리만 거칠다 |
| P02 | 드라이 잉크 | `rough` | classic/dry_brush | 기존 재사용(안쪽이 끊기는 결). P01 과는 '가장자리 vs 안쪽'으로 갈린다 |
| P03 | 붓결 잉크 | `bristle` | deevad/rigger_brush | **새로.** 원본은 결을 못 보여 줬다 → 털 9가닥을 획 방향으로 눕혀 직접 만들었다 |
| P04 | 볼펜 | `ballpen` | deevad/ballpen | **새로.** opaque .2·hardness .2 를 옮겨 가늘고 옅게. 해칭을 겹쳐 쌓는 용도 |
| P05 | 크레용 | `crayon` | ramon/Pastel_1 | 기존 재사용(결을 파내는 방식). P07 과 **다른 알고리즘**이다 |
| P06 | 분필 | `chalk` | deevad/chalk | 기존 재사용(성긴 결 마스크) |
| P07 | 소프트 파스텔 | `pastel` | ramon/Pastel_1 | **새로.** 같은 원본이지만 크레용과 달리 dab+종이결로 곱게 넓게 앉는다 |
| P08 | 목탄 | `charcoal` | classic/charcoal | **새로.** hardness .2·offset 1.6 을 옮겨 큰 결이 불규칙하게. 색은 고른 색 그대로(검정 고정 없음) |
| P09 | 연필 옆면 | `pencilside` | Dieterle/8B_Pencil#1 | **새로.** 원본은 tilt 의존 → 손가락에는 기울기가 없어 **넓은 접촉면을 고정 프로필**로 뒀다 |
| P10 | 입자 음영 | `grainshade` | ramon/Grain | **새로.** 원본의 색 끌림(smudge=1)은 **넣지 않았다**. 미세 입자만 쌓인다 |
| P11 | 점묘 | `pointil` | classic/puantilism | **새로.** 원본의 smudge·tilt 대신 경로 둘레에 흩뿌린다. 점선(일정 간격)과 다르다 |
| P12 | 스프레이 | `spray` | deevad/spray | **새로.** P11 보다 넓고 촘촘하며 크기가 제각각 |
| P13 | 드라이 평붓 | `dryflat` | deevad/rough | **새로.** 털 13가닥 + 군데군데 닿지 않음(drop .35). P02 의 확대판이 아니다 |
| P14 | 워시 | `wash` | deevad/watercolor_glazing | **새로.** 얇은 색을 겹쳐 쌓는다. 물감 물리 시늉은 하지 않는다 |
| P15 | 가장자리 수채 | `wateredge` | deevad/watercolor_expressive | **새로.** 획이 마를 때 **가장자리만 찾아** 진하게 한다(`poolEdge`). 이름만으로 되는 효과가 아니다 |
| P16 | 오일 파스텔 | `oilpastel` | tanda/oil-01-paint | **새로.** 원본은 oil paint 라 참고만 했다. 두껍고 눌린 왁스가 되도록 따로 잡았다 |
| P17 | 테두리 펜 | `outline` | — | 45.29 재사용. 획 전체를 다시 긋고 가운데를 파낸다(선분마다 합성하지 않는다) |
| P18 | 점선 펜 | `dotted` | — | 45.29 재사용. 획 길이를 위상으로 써서 **이동 속도와 무관하게** 간격이 일정하다 |
| P19 | 평행선 펜 | `parallelpen` | — | **새로.** 곡선 법선 방향으로 나란한 세 줄. 획 전체를 다시 그어 급회전에서도 이음매가 없다 |
| P20 | 발광 펜 | `glowpen` | ramon/Glow_Airbrush | **새로.** 흐린 번짐 + 또렷한 중심선. 배경을 밝게 만들지는 않는다 |

## 목록에서 내렸지만 **지우지 않은** 것

엔진과 저장 형식에 그대로 남아, 그 값을 쓰는 저장본이 예전과 똑같이 그려진다.
그 브러시로 그리는 중이면 브러시 판이 한 줄로 알린다.

| 엔진 ID | 예전 이름 | 왜 내렸나 |
|---|---|---|
| `marker` | 마커(구형) | 빗살 결함. `marker2` 로 갈았다 |
| `brushpen` | 붓펜(구형) | 굵기가 변하지 않아 F04 기준 미달. `brushpen2` 로 갈았다 |
| `base:pencil` | 연필(구형) | 질감이 약해 F05 기준 미달. `pencil2` 로 갈았다 |
| `soft` | 부드러운 펜 | v2 구성에 없다. 호환 항목으로만 유지(30종에 세지 않는다) |
| `grain` | 결 연필 | v2 구성에 없다 |
| `calligraphy` | 캘리그래피 | F10 을 `flat` 으로 새로 만들며 자리를 넘겼다 |
| `chisel` | 납작펜(구형) | 고정 굵기라 F10 기준 미달 |
| `base:brush` | 붓(구형) | 45.29 에 `brushpen` 으로 옮겼고, v2 에서 다시 `brushpen2` 로 갔다 |

## 라이선스

원본 브러시 설정과 참고한 국소 알고리즘의 출처는 libmypaint / mypaint-brushes(ISC)다.
받은 꾸러미의 `licenses/` 와 `SOURCE_AND_LICENSE.md` 를 저장소 밖 자료로 함께 보관한다.
**.myb 파일 자체를 앱에 넣지 않았고**, 엔진을 통째로 바꾸지도 않았다 — 필요한 계산만 옮겼다.
