"""Extract keyframe bindings from the provided .fig decoded schema, retaining source IDs."""
import json,pathlib,sys
nodes=json.loads(pathlib.Path(sys.argv[1]).read_text())['nodeChanges']
gid=lambda g:f"{g['sessionID']}:{g['localID']}"
index={gid(n['guid']):n for n in nodes};children={}
for n in nodes:
 if 'parentIndex' in n: children.setdefault(gid(n['parentIndex']['guid']),[]).append(n)
roots={gid(n['guid']):int(n['timelineDuration'])/1e6 for n in nodes if n.get('timelineDuration')}
def trackid(value):
 if isinstance(value,dict):
  if 'keyframeTrackId' in value:return gid(value['keyframeTrackId']['guid'])
  for v in value.values():
   result=trackid(v)
   if result:return result
 elif isinstance(value,list):
  for v in value:
   result=trackid(v)
   if result:return result
out={}
for node in nodes:
 tracks=[]
 for entry in node.get('parameterConsumptionMap',{}).get('entries',[]):
  key=trackid(entry)
  if not key:continue
  frames=sorted(children.get(key,[]),key=lambda n:int(n.get('timelinePosition','0')))
  if not frames:continue
  tracks.append({'field':entry['variableField'],'frames':[{'at':int(n.get('timelinePosition','0'))/1e6,'value':n['keyframeValue']['value'],'ease':n.get('easingData',{'easingType':'LINEAR'})} for n in frames]})
 if tracks:
  parent=node
  while gid(parent['guid']) not in roots and parent.get('parentIndex'): parent=index[gid(parent['parentIndex']['guid'])]
  root=gid(parent['guid'])
  if root in roots:out[gid(node['guid'])]={'name':node.get('name'),'root':root,'duration':roots[root],'tracks':tracks}
pathlib.Path('apps/web/src/design/motion-data.json').write_text(json.dumps(out,ensure_ascii=False,separators=(',',':')))
print(len(out),'animated nodes exported')
