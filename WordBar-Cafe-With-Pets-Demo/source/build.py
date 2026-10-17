import json
t=open('template.html').read()
cast=json.load(open('../v3/cast.json'))
d=json.load(open('../v3/items/items.json'))
decor={'items':d['items'],'window':d['window'],'machine':d['machine'],'theme':d['theme']}
used={'pugclassic','lion','owl2','dog','rabbit','hollandlop','redpanda','koala','penguin','dachshund','parrot','corgi'}
pets=[p for p in json.load(open('../pets52/pets.json')) if p['id'] in used]
for p in pets: p.pop('alts',None)
t=t.replace('__CAST__',json.dumps(cast)).replace('__PETS__',json.dumps(pets)).replace('__DRINKS__',open('../cafe2/drinks.json').read()).replace('__DECOR__',json.dumps(decor))
open('wordbar-cafe-pets.html','w').write(t);print(len(t))
