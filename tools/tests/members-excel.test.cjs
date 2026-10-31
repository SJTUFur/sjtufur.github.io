const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const XLSX = require(path.join(root, 'tools/vendor/xlsx.mini.min.js'));
const ctx = { window: {XLSX}, URL, document: {querySelector: () => null} };
vm.createContext(ctx);
for (const file of ['members.js', 'tools/members-excel.js']) {
  vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx);
}
const api=ctx.window.MemberExcelImport;
const old=ctx.window.MemberDirectory.normalize([{name:"瑞皮",group:"administrators",qq:"3216748472"}]);
const headers=['提交时间','昵称','兴趣方向','一句话简介','个人网页','启用名字链接','QQ','公开QQ','头像','同意公开展示'];
const rows=[['SJTUfur 官网成员资料收集'],headers,
['2026-10-31','新成员甲','绘画、摄影','喜欢一起创作','https://example.com/works','是',1234567890,'否','avatar.jpg','是'],
['2026-10-31','新成员乙','音乐','欢迎交流','','否',987654321,'是','','是'],
['2026-10-31','不展示成员','','','','否',555555555,'是','','否'],
['2026-10-31','瑞皮','','','','否',555555555,'是','','是'],
['2026-10-31','链接错误','','','javascript:alert(1)','是','','否','','是'],
['2026-10-31','新成员甲','','','','否','','否','','是'],
['2026-10-31','QQ错误','','','','否','abc','是','','是'],
['2026-10-31','','','','','否','','否','','是'],
['2026-10-31','无QQ授权列值','','','','否','abc','','','是'],
[]];
const result=api.convert(rows,old);
assert.equal(result.sourceCount,9);
assert.equal(result.members.length,3);
assert.equal(result.skipped.length,3);
assert.equal(result.errors.length,3);
assert.equal(result.avatarCount,1);
assert.equal(result.members[0].qq,'');
assert.equal(result.members[0].avatar,'');
assert.equal(result.members[0].website,'https://example.com/works');
assert.equal(result.members[0].linkEnabled,true);
assert.equal(result.members[1].qq,'987654321');
assert.equal(result.members[2].qq,'');
assert(result.members.every(m=>m.group==='community'));
assert.equal(old[0].qq,'3216748472');
assert.equal(api.convert(rows,[...old,...result.members]).members.length,0);
assert.throws(()=>api.convert([['昵称'],['甲']],old),/未找到表头/);
assert.throws(()=>api.convert([['昵称','同意公开展示','昵称'],['甲','是','乙']],old),/重复/);
const reordered=[['2. 同意公开展示（必填）','1. 昵称（必填）','公开 QQ'],['是','顺序测试','否']];
assert.equal(api.convert(reordered,old).members[0].name,'顺序测试');
const book=XLSX.utils.book_new();
XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([['昵称','昵称'],['无关统计','无关统计']]),'统计');
XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet(rows),'收集结果');
const bytes=XLSX.write(book,{bookType:'xlsx',type:'buffer'});
const sheets=api.read(bytes);
assert.equal(sheets.length,1);
assert.equal(sheets[0].name,'收集结果');
const roundtrip=api.convert(sheets[0].rows,old);
assert.equal(roundtrip.members[1].qq,'987654321');
assert.equal(roundtrip.members.length,3);
assert.equal(ctx.window.MemberDirectory.parse(ctx.window.MemberDirectory.serialize([...old,...roundtrip.members])).length,old.length+3);
console.log('PASS: XLSX 读取、自动找表头、列顺序、额外列、多工作表、公开授权、QQ 隐藏、链接校验、头像提示、同名保护、重复导入及资料导出。');

// Tencent's real export format has required markers, metadata and no consent column.
const tencentHeaders=['提交者（自动）','提交时间（自动）','昵称（必填）','兴趣方向','一句话简介','启用名字链接（必填）','个人网页','公开QQ（必填）','QQ号','头像'];
const tencent=[tencentHeaders,['提交人',46326.3,'维护者','摄影','新的简介','是','https://example.com/profile','否','123456789','']];
const existing=ctx.window.MemberDirectory.normalize([
  {name:'维护者',group:'administrators',role:'技术部',avatar:'assets/images/people/old.png',description:'旧简介',qq:'987654321'},
  {name:'保留社员',group:'community',role:'音乐',description:'原有资料'}
]);
const snapshot=JSON.stringify(existing);
assert.equal(api.convert(tencent,existing).skipped.length,1);
const image={bytes:new Uint8Array([1,2,3]),extension:'png',mime:'image/png'};
const update=api.convert(tencent,existing,{updateExisting:true,images:new Map([[2,image]])});
assert.equal(update.members.length,0);
assert.equal(update.updates.length,1);
assert.equal(update.imageCount,1);
assert.equal(update.entries[0].image,image);
const merged=api.merge(existing,update);
assert.equal(merged.length,2);
assert.equal(merged[0].name,'维护者');
assert.equal(merged[0].group,'administrators');
assert.equal(merged[0].role,'技术部');
assert.equal(merged[0].interests,'摄影');
assert.equal(merged[0].description,'新的简介');
assert.equal(merged[0].qq,'');
assert.equal(merged[0].avatar,'assets/images/people/old.png');
assert.equal(merged[0].linkEnabled,true);
assert.equal(merged[1].description,'原有资料');
assert.equal(JSON.stringify(existing),snapshot);
const defaultConsent=api.convert([['昵称','一句话简介','同意公开展示'],['甲','简介',''],['乙','简介','不同意公开展示'],['丙','简介','不确定']],[]);
assert.equal(defaultConsent.members.length,1);
assert.equal(defaultConsent.skipped.length,1);
assert.equal(defaultConsent.errors.length,1);
const sparseUpdate=api.convert([['昵称','一句话简介'],['维护者','只改简介']],existing,{updateExisting:true});
assert.equal(sparseUpdate.updates[0].member.qq,'987654321');
assert.equal(sparseUpdate.updates[0].member.role,'技术部');
const duplicate=api.convert([...tencent,tencent[1]],existing,{updateExisting:true});
assert.equal(duplicate.updates.length,1);
assert.equal(duplicate.skipped.length,1);
const ambiguous=api.convert(tencent,[existing[0],existing[0]],{updateExisting:true});
assert.equal(ambiguous.updates.length,0);
assert.equal(ambiguous.errors.length,1);
const tencentBook=XLSX.utils.book_new();
const tencentSheet=XLSX.utils.aoa_to_sheet(tencent);
tencentSheet['!merges']=[{s:{r:0,c:9},e:{r:0,c:14}}];
XLSX.utils.book_append_sheet(tencentBook,tencentSheet,'腾讯收集结果');
const parsed=api.read(XLSX.write(tencentBook,{bookType:'xlsx',type:'buffer'}));
assert.equal(parsed.length,1);
assert.equal(parsed[0].merges[0].e.c,14);
assert.equal(api.convert(parsed[0].rows,existing,{updateExisting:true}).updates.length,1);
console.log('PASS: 腾讯表头、默认同意、明确拒绝、同名可选更新、管理员部门保留、兴趣保存、头像关联、部分字段更新、歧义保护及原资料不变。');
