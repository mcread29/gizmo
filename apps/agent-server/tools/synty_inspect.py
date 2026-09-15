import bpy, json
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
for file in [ROOT/'polygon-prototype/Characters/SK_Character_Male_Face_01.fbx', ROOT/'polygon-prototype/FBX/SM_Prop_Sword_01.fbx']:
 bpy.ops.import_scene.fbx(filepath=str(file))
for o in bpy.data.objects:
 print('OBJECT',o.name,o.type, list(o.location),list(o.rotation_euler),list(o.scale))
 if o.type=='ARMATURE':
  for b in o.data.bones: print('BONE',b.name,b.parent.name if b.parent else '-',tuple(round(x,4) for x in o.matrix_world@b.head_local),tuple(round(x,4) for x in o.matrix_world@b.tail_local))
 if o.type=='MESH':
  vs=[o.matrix_world@v.co for v in o.data.vertices];print('BOUNDS', [min(v[i] for v in vs) for i in range(3)],[max(v[i] for v in vs) for i in range(3)])
for im in bpy.data.images: print('IMAGE',im.name,im.filepath)
import sys
sys.path.insert(0,str(ROOT/'tools'))
from marth_anims import node_matrix,mul
g=json.loads((ROOT/'assets/marth.gltf').read_text());p={c:i for i,n in enumerate(g['nodes']) for c in n.get('children',[])}
def world(i):return mul(world(p[i]),node_matrix(g['nodes'][i])) if i in p else node_matrix(g['nodes'][i])
for i,n in enumerate(g['nodes']):
 if n.get('name','').startswith('JOBJ'): print('MARTH',i,n['name'],g['nodes'][p[i]].get('name') if i in p else '-', [round(world(i)[k][3],4) for k in range(3)])
print('SKINS',g['skins'])
