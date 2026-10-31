const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../../script.js'), 'utf8');
function page(saved = {}, blocked = false) {
  const store = new Map(Object.entries(saved));
  const inputs = ['red','blue','black'].map(value => ({value,checked:false,addEventListener(type,fn){this[type]=fn;}}));
  const root = {dataset:{}};
  const events = {};
  const window = {addEventListener(type, fn){events[type]=fn;},get localStorage(){
    if(blocked)throw new Error('storage disabled');
    return {getItem:key=>store.get(key)??null,setItem:(key,value)=>store.set(key,value)};
  }};
  const document = {documentElement:root,body:{dataset:{}},addEventListener(){},querySelector:()=>null,querySelectorAll(selector){return selector==='input[name="site-color"]'?inputs:[];}};
  vm.runInNewContext(source,{window,document});
  return {root,store,inputs,events};
}
assert.equal(page().root.dataset.color,'red');
assert.equal(page({'site-theme':'dark'}).root.dataset.theme,'light');
assert.equal(page({},true).root.dataset.color,'red');
assert.equal(page({'site-color':'default','site-theme':'dark'}).root.dataset.color,'black');
assert.equal(page({'site-color':'default','site-theme':'light'}).root.dataset.color,'red');
assert.equal(page({'site-color':'white'}).root.dataset.color,'red');
assert.equal(page({'site-color':'white'}).store.get('site-color'),'red');
for(const color of ['red','blue','black']){
  const initial=page({'site-color':color,'site-theme':'dark'});
  assert.equal(initial.root.dataset.color,color);
  assert.equal(initial.root.dataset.theme,color==='black'?'dark':'light');
}
const current=page();
const black=current.inputs.find(input=>input.value==='black');
black.checked=true; black.change();
assert.equal(current.store.get('site-color'),'black');
assert.equal(page(Object.fromEntries(current.store)).root.dataset.theme,'dark');
current.store.set('site-color','red');current.events.storage({key:'site-color'});
assert.equal(current.root.dataset.theme,'light');
current.store.clear();current.events.storage({key:null});
assert.equal(current.root.dataset.color,'red');
assert(!fs.readFileSync(path.join(__dirname,'../../nav.js'),'utf8').includes('data-theme-toggle'));
console.log('PASS: 交大红、蓝色、黑色三种主题、白色设置迁移、保存与刷新、跨标签同步和禁用存储。');
