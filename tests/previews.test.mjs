import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePreviewImage, validatePreviewMetadata, safeStoreLink, MAX_PREVIEW_BYTES } from '../src/previews.js';
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jvWYAAAAASUVORK5CYII=';
test('only bounded PNG/JPEG screenshots can be displayed', () => {
  assert.equal(validatePreviewImage(png).mime, 'image/png');
  for (const invalid of ['https://example.com/image.png','data:image/svg+xml;base64,PHN2Zz4=', png.replace('image/png','image/jpeg'), 'data:image/png;base64,bm90IGltYWdl', `data:image/png;base64,${'A'.repeat(MAX_PREVIEW_BYTES*2)}`]) assert.throws(()=>validatePreviewImage(invalid));
});
test('capture metadata requires an honest recent source and origin', () => {
  const now=Date.now(), value={projectId:'sikhi-khoj',title:'Lesson screen',caption:'Text layout preview',origin:'Isolated Unity preview',source:'unity-preview',capturedAt:now};
  assert.equal(validatePreviewMetadata(value,now),value);
  for (const invalid of [{...value,origin:''},{...value,source:'verified-gameplay'},{...value,capturedAt:now-8*86400000},{...value,capturedAt:now+120000}]) assert.throws(()=>validatePreviewMetadata(invalid,now));
});
test('only exact Google Play listing links are allowed', () => {
  assert.ok(safeStoreLink('https://play.google.com/store/apps/details?id=com.brainforgegames.sikhikhoj'));
  for(const url of ['javascript:alert(1)','https://play.google.com.evil.test/store/apps/details?id=com.a','https://user@play.google.com/store/apps/details?id=com.a','https://play.google.com/store/apps/details?id=com.a&redirect=evil']) assert.equal(safeStoreLink(url),'');
});
import { galleryMarkup } from '../src/gallery.js';
test('gallery is honest when empty and does not eagerly embed private image bytes', () => {
 const esc=v=>String(v??'').replaceAll('<','&lt;').replaceAll('"','&quot;');
 const state={projects:[{id:'sikhi-khoj',name:'Sikhi Khoj'}],previews:[]};
 assert.match(galleryMarkup(state,esc,x=>x,x=>String(x),'all',null,'',false),/No screenshots shared yet/);
 state.previews=[{id:'capture',projectId:'sikhi-khoj',title:'<script>',caption:'Lesson view',source:'unity-preview',capturedAt:1,origin:'Isolated editor',dataUrl:png}];
 const html=galleryMarkup(state,esc,x=>x,x=>String(x),'all',null,'',false);
 assert.match(html,/Unity preview/); assert.match(html,/&lt;script>/); assert.ok(!html.includes(png));
 assert.ok(!galleryMarkup(state,esc,x=>x,x=>String(x),'drivenix',null,'',false).includes('data-preview='));
});
