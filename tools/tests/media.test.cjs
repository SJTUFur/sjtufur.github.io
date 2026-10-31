const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');
class Element {
  constructor(tag) { this.tag=tag; this.children=[]; }
  append(...children) { this.children.push(...children); }
  replaceChildren() { this.children=[]; }
  setAttribute(key,value) { this[key]=value; }
  addEventListener() {}
}
const context={window:{},URL,document:{querySelector:()=>null,createElement:tag=>new Element(tag)}};
vm.createContext(context);
for(const file of ['media-data.js','media.js']) vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context);
const api=context.window.MediaDirectory;
const example={title:'测试照片',category:'group',image:'assets/images/photo.jpg',featured:true};
assert.equal(api.parse(api.serialize([example]))[0].title,'测试照片');
assert.throws(()=>api.normalize([{...example,image:'assets/images/../../private.png'}]));
assert.throws(()=>api.normalize([{...example,url:'javascript:alert(1)'}]));
assert.throws(()=>api.parse('window.SITE_MEDIA = []; alert(1);'));
assert.throws(()=>api.normalize([{title:'视频',category:'video'}]));
assert.equal(api.normalize([{title:'视频',category:'video',url:'https://example.com/watch'}])[0].image,'');
const featured=new Element('div');
api.renderFeatured(featured,Array.from({length:5},(_,index)=>({...example,title:'照片'+index})), '../');
assert.equal(featured.children.length,3);
assert.equal(featured.children[0].children[0].href,'../assets/images/photo.jpg');
const gallery=new Element('div'); api.render(gallery,[example]);
assert.equal(gallery.children.length,3);
assert.equal(gallery.children[0].id,'group');
assert.doesNotThrow(()=>api.normalize(context.window.SITE_MEDIA));
console.log('PASS: 多媒体导入导出、图片路径、视频链接、分类渲染和首页前三项。');
