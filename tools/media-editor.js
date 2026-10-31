(function () {
  const api = window.MediaDirectory;
  const list = document.querySelector('#media-list');
  const form = document.querySelector('#media-form');
  const template = document.querySelector('#media-template');
  const preview = document.querySelector('#media-preview');
  const status = document.querySelector('#editor-status');
  const dialog = document.querySelector('#media-details');
  const detailsForm = document.querySelector('#details-form');
  const detailsError = document.querySelector('#details-error');
  const imagePreview = document.querySelector('#details-image-preview');
  const fields = ['image', 'alt', 'description', 'credit', 'url'];
  const placeholder = '../assets/images/member-placeholder.svg';
  let selectedRow = null;
  let dirty = false;
  let detailsDirty = false;
  let uploading = false;
  function message(text, error = false) { status.textContent = text; status.dataset.error = String(error); }
  function readRow(row) { return Object.fromEntries(Array.from(row.querySelectorAll('[name]'), input => [input.name, input.type === 'checkbox' ? input.checked : input.value])); }
  function read() { return Array.from(list.children, readRow); }
  function safeImage(path) { return path.startsWith('assets/images/') && !/[\\%:?#]|(^|\/)\.{1,2}(\/|$)/.test(path); }
  function setImage(image, path) { image.src = safeImage(path) ? '../' + path : placeholder; }
  function renumber() {
    let featured = 0;
    Array.from(list.children).forEach((row, index) => {
      const item = readRow(row);
      const name = item.title.trim() || `内容 ${index + 1}`;
      row.querySelector('.row-number').textContent = index + 1;
      row.querySelector('[data-action="up"]').disabled = index === 0;
      row.querySelector('[data-action="down"]').disabled = index === list.children.length - 1;
      row.querySelector('.switch-label').textContent = item.featured ? '开启' : '关闭';
      if (item.featured) featured++;
      for (const [field, label] of Object.entries({title:'标题', category:'分类', date:'日期', featured:'首页展示'})) row.querySelector(`[name="${field}"]`).setAttribute('aria-label', name + ' · ' + label);
      for (const [action,label] of Object.entries({more:'更多',up:'上移',down:'下移',delete:'删除'})) row.querySelector(`[data-action="${action}"]`).setAttribute('aria-label', label + ' · ' + name);
      setImage(row.querySelector('img'), item.image);
    });
    document.querySelector('#media-count').textContent = `${list.children.length} 项内容 · ${featured} 项勾选首页展示`;
  }
  function add(item) {
    const row = template.content.firstElementChild.cloneNode(true);
    for (const input of row.querySelectorAll('[name]')) {
      if (input.type === 'checkbox') input.checked = item[input.name] === true;
      else input.value = item[input.name] || '';
    }
    const image = row.querySelector('img');
    image.addEventListener('error', () => { if (image.getAttribute('src') !== placeholder) image.src = placeholder; });
    list.append(row);
    return row;
  }
  function load(items) { list.replaceChildren(); items.forEach(add); renumber(); api.render(preview, items, '../'); }
  function edited() { dirty = true; renumber(); message('有未应用的修改。检查后点击“应用到工程”或下载资料。'); }
  function validated() {
    if (!form.reportValidity()) return null;
    try { return api.normalize(read()); } catch (error) { message(error.message, true); return null; }
  }
  function updateImage() { setImage(imagePreview, document.querySelector('#details-image').value.trim()); }
  imagePreview.addEventListener('error', () => { if (imagePreview.getAttribute('src') !== placeholder) imagePreview.src = placeholder; });
  function openDetails(row) {
    selectedRow = row; detailsDirty = false; detailsError.textContent = '';
    const item = readRow(row);
    document.querySelector('#details-heading').textContent = item.title.trim() || '新增内容';
    document.querySelector('#upload-status').textContent = '';
    for (const field of fields) document.querySelector('#details-' + field).value = item[field];
    document.querySelector('#details-url').required = item.category === 'video';
    updateImage(); dialog.showModal();
  }
  form.addEventListener('submit', event => event.preventDefault());
  list.addEventListener('input', edited); list.addEventListener('change', edited);
  list.addEventListener('click', event => {
    const button = event.target.closest('[data-action]'); if (!button) return;
    const row = button.closest('tr'); const action = button.dataset.action;
    if (action === 'more') { openDetails(row); return; }
    if (action === 'delete') row.remove();
    if (action === 'up' && row.previousElementSibling) list.insertBefore(row, row.previousElementSibling);
    if (action === 'down' && row.nextElementSibling) list.insertBefore(row.nextElementSibling, row);
    edited();
  });
  document.querySelector('#add-media').addEventListener('click', () => { const row = add({category:'group',featured:false}); edited(); row.querySelector('[name="title"]').focus(); });
  detailsForm.addEventListener('input', () => { detailsDirty = true; detailsError.textContent = ''; });
  document.querySelector('#details-image').addEventListener('input', updateImage);
  detailsForm.addEventListener('submit', event => {
    event.preventDefault(); if (!selectedRow || uploading || !detailsForm.reportValidity()) return;
    const values = Object.fromEntries(fields.map(field => [field,document.querySelector('#details-' + field).value.trim()]));
    try { api.normalize([{...readRow(selectedRow), title:'此内容', date:'', ...values}]); }
    catch (error) { detailsError.textContent = error.message; return; }
    for (const field of fields) selectedRow.querySelector(`[name="${field}"]`).value = values[field];
    edited(); dialog.close();
  });
  for (const id of ['#close-details','#cancel-details']) document.querySelector(id).addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { selectedRow = null; detailsDirty = false; });
  document.querySelector('#upload-image').addEventListener('click', () => document.querySelector('#image-file').click());
  document.querySelector('#image-file').addEventListener('change', async event => {
    const file = event.target.files[0]; if (!file) return;
    const row = selectedRow;
    const uploadStatus = document.querySelector('#upload-status');
    uploading = true; document.querySelector('#save-details').disabled = true;
    uploadStatus.textContent = '正在保存图片…';
    try {
      const path = await window.EditorFiles.upload(file);
      if (selectedRow !== row || !dialog.open) return;
      document.querySelector('#details-image').value = path;
      detailsDirty = true; updateImage(); uploadStatus.textContent = '图片已保存，保存详情并应用后即可展示。';
    } catch (error) { uploadStatus.textContent = error.message; }
    finally { uploading = false; document.querySelector('#save-details').disabled = false; event.target.value = ''; }
  });
  document.querySelector('#preview-media').addEventListener('click', () => { const items = validated(); if (!items) return; api.render(preview,items,'../'); message('预览已更新。'); preview.scrollIntoView({behavior:'smooth'}); });
  document.querySelector('#export-media').addEventListener('click', () => {
    const items = validated(); if (!items) return;
    const url = URL.createObjectURL(new Blob([api.serialize(items)],{type:'text/javascript;charset=utf-8'}));
    const link = document.createElement('a'); link.href = url; link.download = 'media-data.js'; document.body.append(link); link.click(); link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url),10000); dirty = false;
    message('已下载 media-data.js。替换工程根目录同名文件后提交发布。');
  });
  document.querySelector('#apply-media').addEventListener('click', async event => {
    const items = validated(); if (!items) return;
    const button = event.currentTarget; button.disabled = true;
    try { const text = await window.EditorFiles.apply('media',items,api.serialize); api.render(preview,items,'../'); dirty = false; message(text); }
    catch (error) { message(error.name === 'AbortError' ? '已取消应用，编辑内容保留。' : error.message,error.name !== 'AbortError'); }
    finally { button.disabled = false; }
  });
  document.querySelector('#import-media').addEventListener('click', () => document.querySelector('#media-file').click());
  document.querySelector('#media-file').addEventListener('change', async event => {
    const file = event.target.files[0]; if (!file) return;
    if (dirty && !window.confirm('导入会替换尚未应用的修改，继续吗？')) { event.target.value = ''; return; }
    try { load(api.parse(await file.text())); dirty = true; message('资料已导入。核对后应用到工程，或下载保存。'); }
    catch (error) { message(error.message,true); }
    event.target.value = '';
  });
  window.addEventListener('beforeunload', event => { if (dirty || detailsDirty) { event.preventDefault(); event.returnValue = ''; } });
  try { load(api.normalize(window.SITE_MEDIA)); } catch (error) { message(error.message,true); }
})();
