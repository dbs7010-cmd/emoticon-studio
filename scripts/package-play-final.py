"""Keep only uploadable PNGs in the two Google Play language folders."""
from pathlib import Path
from PIL import Image, ImageDraw
import hashlib, json

root=Path(__file__).resolve().parents[1]
out=root/'dist/구글스토어-업로드용-일본-대만'
proof=root/'verification/play-final-20261031'
records=[]
for language in ['일본어','대만-번체']:
    folder=out/language
    Image.open(root/'assets/icon.png').convert('RGBA').resize((512,512),Image.Resampling.LANCZOS).save(folder/'01-앱아이콘.png',optimize=True)
    expected={'01-앱아이콘.png':(512,512),'02-그래픽이미지.png':(1024,500)}
    for sub,size in [('03-휴대전화-스크린샷',(1080,1920)),('04-7인치-태블릿',(1080,1920)),('05-10인치-태블릿',(1440,2560))]:
        images=sorted((folder/sub).glob('*.png'))
        assert len(images)==5,(language,sub,len(images))
        expected.update({p.relative_to(folder).as_posix():size for p in images})
    files=sorted(p for p in folder.rglob('*') if p.is_file())
    assert len(files)==17,(language,len(files))
    for p in files:
        name=p.relative_to(folder).as_posix()
        assert name in expected,p
        with Image.open(p) as im:
            assert im.size==expected[name],(p,im.size)
            mode='RGBA' if name=='01-앱아이콘.png' else 'RGB'
            converted=im.convert(mode)
        converted.save(p,optimize=True)
        limit=1024*1024 if name=='01-앱아이콘.png' else 8*1024*1024
        assert p.stat().st_size<=limit,(p,p.stat().st_size)
        records.append({'file':p.relative_to(out).as_posix(),'size':expected[name],'mode':mode,'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
canvas=Image.new('RGB',(1200,790),'#f4f2ed');d=ImageDraw.Draw(canvas)
for row,language in enumerate(['일본어','대만-번체']):
    for i,p in enumerate(sorted((out/language/'03-휴대전화-스크린샷').glob('*.png'))):
        im=Image.open(p);im.thumbnail((195,347));x=10+i*200;y=30+row*390
        canvas.paste(im,(x,y));d.text((x,y-20),('JA' if row==0 else 'TW')+' / '+p.stem,fill='#222222')
    feature=Image.open(out/language/'02-그래픽이미지.png');feature.thumbnail((190,200));canvas.paste(feature,(1005,120+row*390))
proof.mkdir(parents=True,exist_ok=True)
canvas.save(proof/'preview.jpg',quality=94)
(proof/'delivery-manifest.json').write_text(json.dumps({'status':'READY_NOT_UPLOADED','totalPngs':len(records),'records':records},ensure_ascii=False,indent=2),encoding='utf-8')
print('PASS: 34 upload PNGs only; two languages; sizes, color modes and limits verified.')
