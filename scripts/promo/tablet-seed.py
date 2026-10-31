"""Prepare an isolated emulator demo store from the actual Corn PNG assets."""
import json, pathlib, sys, copy
from PIL import Image
root=pathlib.Path(__file__).resolve().parents[2]
out=root/'verification/release-handoff-20261030/tablet-seed'
out.mkdir(exist_ok=True)
base=json.loads((root/'verification/release-handoff-20261030/tablet-before/store-a.json').read_text(encoding='utf-8'))
names={'ko':'콘의 하루','ja':'コーンの一日','zh-Hant':'小玉米的一天'}
layers={'ko':'그림 1','ja':'絵 1','zh-Hant':'圖層 1'}
for i,pose in enumerate(['cheer','wave','heart','bow','sad','nod','angry','shy']):
    im=Image.open(root/f'assets/mascot/corn-{pose}.png').convert('RGBA')
    im.resize((360,360),Image.Resampling.LANCZOS).save(out/f'tablet-corn-{i}.png')
for lang,title in names.items():
    store=copy.deepcopy(base); p=store['projects'][0]
    p['projectName']=title;p['characterName']='';store['revision']=100
    for i,s in enumerate(p['slots']):
        for key in ['finalImage','qa','work','motion','motionImage']: s.pop(key,None)
        s['done']=i<8;s['status']='REVIEW' if i<8 else 'EMPTY'
        if i<8:
            img={'path':f'tablet-corn-{i}.png','width':360,'height':360}
            s['finalImage']=img
            s['work']={'version':1,'activeLayerId':'draw-1','references':[], 'layers':[{'id':'draw-1','name':layers[lang],'visible':True,'opacity':1,'x':0,'y':0,'scale':1,'rotation':0,'image':img}]}
    store['introDone']=True
    (out/f'{lang}.json').write_text(json.dumps(store,ensure_ascii=False),encoding='utf-8')
print('Prepared real Corn artwork, eight demo slots, three locales. No app source changed.')
