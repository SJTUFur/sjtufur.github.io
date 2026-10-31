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
