const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const source = fs.readFileSync(require('node:path').join(__dirname, '../editor-files.js'), 'utf8');
const missing = () => Object.assign(new Error('missing'), { name: 'NotFoundError' });

class MemoryFile {
  constructor(value = '') { this.value = value; this.writes = 0; }
  async getFile() { return new Blob([this.value]); }
  async createWritable() {
    let staged;
    return {
      write: async (value) => { staged = value; },
      close: async () => { this.value = staged; this.writes++; },
      abort: async () => {}
    };
  }
}
class MemoryDirectory {
  constructor(name) { this.name = name; this.files = new Map(); this.dirs = new Map(); }
  async getFileHandle(name, options = {}) {
    if (!this.files.has(name)) {
      if (!options.create) throw missing();
      this.files.set(name, new MemoryFile());
    }
    return this.files.get(name);
  }
  async getDirectoryHandle(name, options = {}) {
    if (!this.dirs.has(name)) {
      if (!options.create) throw missing();
      this.dirs.set(name, new MemoryDirectory(name));
    }
    return this.dirs.get(name);
  }
}
function project() {
  const folder = new MemoryDirectory('website');
  for (const name of ['index.html', 'members-data.js', 'media-data.js']) folder.files.set(name, new MemoryFile('original'));
  return folder;
}
function editor(window, location = {protocol:'file:',hostname:''}, fetch = () => { throw new Error('Unexpected network request'); }) {
  const context = { window, location, fetch, File, crypto:webcrypto, document:{querySelectorAll:()=>[]} };
  vm.createContext(context);
  vm.runInContext(source, context);
  return window.EditorFiles;
}
async function main() {
  const folder = project();
  let pickerCalls = 0;
  const api = editor({showDirectoryPicker:async () => { pickerCalls++; return folder; }});
  const png = new File([Uint8Array.from([137,80,78,71,13,10,26,10])], '头像.png', {type:'image/png'});
  // Regression: importing embedded avatars from file:// no longer requires an HTTP server.
  const path = await api.upload(png, 'people');
  assert.match(path, /^assets\/images\/people\/头像-[a-f0-9]{12}\.png$/);
  const images = folder.dirs.get('assets').dirs.get('images').dirs.get('people');
  const avatar = images.files.get(path.split('/').pop());
  assert.deepEqual(Buffer.from(avatar.value), Buffer.from(await png.arrayBuffer()));
  await api.apply('members', [{name:'甲'}], (data) => JSON.stringify(data));
  await api.apply('media', [], () => 'media updated');
  assert.equal(folder.files.get('members-data.js').value, '[{"name":"甲"}]');
  assert.equal(folder.files.get('media-data.js').value, 'media updated');
  assert.equal(folder.files.get('index.html').value, 'original');
  assert.equal(pickerCalls, 1);
  await api.upload(png, 'people');
  assert.equal(avatar.writes, 1, 'identical images are reused');
  const jfif = new File([Uint8Array.from([255,216,255,224,0,16,74,70,73,70,0])], 'photo.JFIF', {type:'image/jpeg'});
  const jfifPath = await api.upload(jfif, 'people');
  assert.match(jfifPath, /photo-[a-f0-9]{12}\.jpg$/);
  assert.deepEqual(Buffer.from(images.files.get(jfifPath.split('/').pop()).value), Buffer.from(await jfif.arrayBuffer()));
  avatar.value = new Uint8Array([1]);
  await assert.rejects(api.upload(png, 'people'), /内容不同/);
  assert.deepEqual(Array.from(avatar.value), [1]);
  await assert.rejects(api.upload(png, '../private'), /目录/);
  await assert.rejects(api.upload(new File(['bad'], 'photo.png'), 'people'), /PNG/);
  await assert.rejects(api.apply('../index', [], () => ''), /不支持/);
  const wrong = new MemoryDirectory('tools');
  const wrongApi = editor({showDirectoryPicker:async()=>wrong});
  await assert.rejects(wrongApi.upload(png, 'people'), /不是网站工程/);
  assert.equal(wrong.dirs.size, 0);
  const cancelled = editor({showDirectoryPicker:async()=>{throw Object.assign(new Error('cancelled'), {name:'AbortError'});}});
  await assert.rejects(cancelled.apply('members', [], ()=>'new'), {name:'AbortError'});
  const calls = [];
  const service = editor({}, {protocol:'http:',hostname:'127.0.0.1'}, async (url, options) => {
    calls.push([url,options]);
    return {ok:true,json:async()=>url.includes('session') ? {token:'test'} : {path:'assets/images/people/test.png'}};
  });
  await service.upload(png, 'people');
  await service.upload(jfif, 'gallery');
  assert(calls.some(([url])=>url.includes('name=photo.jpg')));
  await service.apply('members', [], ()=>'serialized');
  assert(calls.some(([url])=>url.includes('folder=people')));
  assert.equal(calls.at(-1)[0], '/__editor/apply');
  const unsupported = editor({});
  await assert.rejects(unsupported.upload(png, 'people'), /启动编辑工具/);
  console.log('PASS: file:// 头像导入和应用、同一文件夹复用、资料写回、取消和错误目录保护、同名图片保护，以及本地服务兼容。');
}
main().catch(error => {console.error(error); process.exitCode = 1;});
