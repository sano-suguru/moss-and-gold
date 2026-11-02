import { writeFileSync, mkdirSync } from 'fs';
import { VS_FULL, FS_LIGHT, FS_SCENE, FS_BLIT, VS_SPRITE, FS_SPRITE, VS_SHADOW, FS_SHADOW } from '../src/shaders';
mkdirSync('build/shaders', { recursive: true });
const all: Record<string, string> = { 'full.vert': VS_FULL, 'light.frag': FS_LIGHT, 'scene.frag': FS_SCENE, 'blit.frag': FS_BLIT, 'sprite.vert': VS_SPRITE, 'sprite.frag': FS_SPRITE, 'shadow.vert': VS_SHADOW, 'shadow.frag': FS_SHADOW };
for (const [k, v] of Object.entries(all)) writeFileSync('build/shaders/' + k, v);
