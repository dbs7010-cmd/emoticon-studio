"""Validate native Android captures and package store-ready RGB copies."""
import pathlib,json,hashlib,zipfile
from PIL import Image,ImageOps,ImageDraw
root=pathlib.Path(__file__).resolve().parents[2]
src=root/'verification/play-tablet-20261031';out=root/'dist/google-play-tablets-20261031'
out.mkdir(parents=True,exist_ok=True)
records=[]
for lang in ['ko','ja','zh-Hant']:
    for size,wh in [('7-inch',(1080,1920)),('10-inch',(1440,2560))]:
        files=sorted((src/lang/size).glob('*.png'))
        assert len(files)==5,(lang,size,len(files))
        dest=out/lang/size;dest.mkdir(parents=True,exist_ok=True)
        for f in files:
            im=Image.open(f);assert im.size==wh,(f,im.size)
            target=dest/f.name;im.convert('RGB').save(target,optimize=True)
            assert target.stat().st_size<8*1024*1024
            records.append({'file':target.relative_to(out).as_posix(),'width':wh[0],'height':wh[1],'bytes':target.stat().st_size,'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'source':f.relative_to(root).as_posix()})
    with zipfile.ZipFile(out/f'EMOTI-PLAY-TABLETS-{lang}-20261031.zip','w',zipfile.ZIP_DEFLATED) as z:
        for f in sorted((out/lang).rglob('*.png')):z.write(f,f.relative_to(out))
manifest={'status':'READY_NOT_UPLOADED','platform':'android','captureType':'native Android emulator, prepared demo artwork','apk':'internal review vc25; not proof of production device QA','densityDpi':280,'records':records}
(out/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
canvas=Image.new('RGB',(1000,790),'#f6f4ef');d=ImageDraw.Draw(canvas)
for row,size in enumerate(['7-inch','10-inch']):
    for col,f in enumerate(sorted((out/'ko'/size).glob('*.png'))):
        im=Image.open(f);im.thumbnail((180,330));x=10+col*200;y=35+row*390
        canvas.paste(im,(x,y));d.text((x,y-22),size+' / '+f.stem,fill='#252525')
canvas.save(out/'preview.jpg',quality=90)
(out/'README.md').write_text('''# Google Play 태블릿 스크린샷

- ko: 한국어 / ja: 일본어 / zh-Hant: 중국어 번체(대만)
- 각 언어의 `7-inch` PNG 5장 → Play의 **7인치 태블릿 스크린샷** 칸
- 각 언어의 `10-inch` PNG 5장 → **10인치 태블릿 스크린샷** 칸
- 파일 번호 순서대로 한 번에 선택하세요. ZIP은 압축을 풀고 PNG만 올립니다.
- 7인치 1080×1920 / 10인치 1440×2560 / 9:16 / RGB PNG / 각 8MB 미만
- 실제 Android 에뮬레이터 앱 화면입니다. 콘 원본으로 촬영용 세트를 준비했습니다.
- 검수 vc25 APK 촬영이며 결제·실기기 출시 검증 완료를 뜻하지 않습니다.
- iPhone·iPad 이미지를 전용한 파일이 아닙니다. 앱 화면에 홍보 문구나 기기 프레임을 덧붙이지 않았습니다.

Google 규격: https://support.google.com/googleplay/android-developer/answer/9866151?hl=ko
''',encoding='utf-8')
print(f'PASS: {len(records)} RGB PNGs, dimensions and 8 MB limit; three locale ZIPs.')
