(function () {
  const api = window.MemberDirectory;
  const list = document.querySelector("#editor-list");
  const form = document.querySelector("#members-form");
  const template = document.querySelector("#member-template");
  const status = document.querySelector("#editor-status");
  const preview = document.querySelector("#member-preview");
  const dialog = document.querySelector("#member-details");
  const detailsForm = document.querySelector("#details-form");
  const avatar = document.querySelector("#details-avatar");
  const description = document.querySelector("#details-description");
  const interests = document.querySelector("#details-interests");
  const website = document.querySelector("#details-website");
  const linkEnabled = document.querySelector("#details-link-enabled");
  const detailsError = document.querySelector("#details-error");
  const avatarPreview = document.querySelector("#details-avatar-preview");
  const fallbackAvatar = "../assets/images/member-placeholder.svg";
  let dirty = false;
  let detailsDirty = false;
  let selectedRow = null;
  let revertSwitchOnCancel = false;
  let detailsSaved = false;
  const excelDialog = document.querySelector("#excel-import-dialog");
  const excelSheet = document.querySelector("#excel-sheet");
  const excelApply = document.querySelector("#apply-excel");
  const excelUpdate = document.querySelector("#excel-update-existing");
  const excelAvatars = document.querySelector("#excel-import-avatars");
  let excelSheets = [];
  let excelExisting = [];
  let excelResult = null;
  let excelBusy = false;
  const excelImageURLs = new Map();

  function message(text, error = false) {
    status.textContent = text;
    status.dataset.error = String(error);
  }

  function readRow(row) {
    return Object.fromEntries(Array.from(row.querySelectorAll("[name]"), (input) => [
      input.name, input.type === "checkbox" ? input.checked : input.value
    ]));
  }

  function read() {
    return Array.from(list.children, readRow);
  }

  function updateSwitch(input) {
    input.closest(".editor-switch").querySelector(".switch-label").textContent = input.checked ? "开启" : "关闭";
  }

  function renumber() {
    let admins = 0;
    Array.from(list.children).forEach((row, index) => {
      const name = row.querySelector('[name="name"]').value.trim() || `成员 ${index + 1}`;
      if (row.querySelector('[name="group"]').value === "administrators") admins++;
      row.querySelector(".row-number").textContent = index + 1;
      row.querySelector('[data-action="up"]').disabled = index === 0;
      row.querySelector('[data-action="down"]').disabled = index === list.children.length - 1;
      for (const [field, label] of Object.entries({ name: "昵称", group: "分组", role: "部门或兴趣", qq: "QQ", linkEnabled: "名字链接" })) {
        row.querySelector(`[name="${field}"]`).setAttribute("aria-label", `${name} · ${label}`);
      }
      for (const [action, label] of Object.entries({ more: "更多", up: "上移", down: "下移", delete: "删除" })) {
        row.querySelector(`[data-action="${action}"]`).setAttribute("aria-label", `${label} · ${name}`);
      }
      updateSwitch(row.querySelector('[name="linkEnabled"]'));
    });
    document.querySelector("#member-count").textContent = `${list.children.length} 位成员 · ${admins} 位管理员`;
    document.querySelector("#empty-members").hidden = list.children.length !== 0;
  }

  function add(member) {
    const row = template.content.firstElementChild.cloneNode(true);
    for (const input of row.querySelectorAll("[name]")) {
      if (input.type === "checkbox") input.checked = member[input.name] === true;
      else input.value = member[input.name] || "";
    }
    list.append(row);
    renumber();
    return row;
  }

  function load(members) {
    list.replaceChildren();
    members.forEach(add);
    renumber();
    api.render(preview, members, "../");
  }

  function edited() {
    dirty = true;
    renumber();
    message("有未保存的修改。完成后点击“应用到工程”，也可下载成员资料备份。");
  }

  function validated() {
    if (!form.reportValidity()) return null;
    try {
      return api.normalize(read());
    } catch (error) {
      message(error.message, true);
      return null;
    }
  }

  function updateAvatar() {
    const path = avatar.value.trim();
    const safe = path.startsWith("assets/images/") && !/[\\:?#]|(^|\/)\.{1,2}(\/|$)/.test(path);
    avatarPreview.src = safe ? "../" + path : fallbackAvatar;
  }

  avatarPreview.addEventListener("error", () => {
    if (avatarPreview.getAttribute("src") !== fallbackAvatar) avatarPreview.src = fallbackAvatar;
  });

  function updateDetailsSwitch() {
    updateSwitch(linkEnabled);
    website.required = linkEnabled.checked;
    // Keep a disabled link's address without requiring it to be complete.
    website.type = linkEnabled.checked ? "url" : "text";
  }

  function openDetails(row, enabling = false) {
    selectedRow = row;
    revertSwitchOnCancel = enabling;
    detailsSaved = false;
    detailsDirty = false;
    const member = readRow(row);
    document.querySelector("#details-heading").textContent = member.name.trim() || "新成员";
    avatar.value = member.avatar;
    description.value = member.description;
    interests.value = member.interests;
    website.value = member.website;
    linkEnabled.checked = member.linkEnabled;
    detailsError.textContent = "";
    updateDetailsSwitch();
    updateAvatar();
    dialog.showModal();
    if (enabling) website.focus();
  }

  detailsForm.addEventListener("input", () => {
    detailsDirty = true;
    detailsError.textContent = "";
  });
  avatar.addEventListener("input", updateAvatar);
  linkEnabled.addEventListener("change", updateDetailsSwitch);
  detailsForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!selectedRow || !detailsForm.reportValidity()) return;
    const fields = {
      avatar: avatar.value.trim(), description: description.value.trim(), interests: interests.value.trim(),
      website: website.value.trim(), linkEnabled: linkEnabled.checked
    };
    try {
      // Allow details to be edited before the row's nickname or QQ is filled in.
      api.normalize([{ ...readRow(selectedRow), name: "此成员", qq: "", ...fields }]);
    } catch (error) {
      detailsError.textContent = error.message;
      return;
    }
    for (const [key, value] of Object.entries(fields)) {
      const input = selectedRow.querySelector(`[name="${key}"]`);
      if (input.type === "checkbox") input.checked = value;
      else input.value = value;
    }
    detailsSaved = true;
    edited();
    dialog.close();
  });
  for (const id of ["#close-details", "#cancel-details"]) {
    document.querySelector(id).addEventListener("click", () => dialog.close());
  }
  dialog.addEventListener("close", () => {
    if (!detailsSaved && revertSwitchOnCancel && selectedRow) {
      selectedRow.querySelector('[name="linkEnabled"]').checked = false;
      renumber();
    }
    detailsDirty = false;
    selectedRow = null;
  });

  form.addEventListener("submit", (event) => event.preventDefault());
  list.addEventListener("input", edited);
  list.addEventListener("change", (event) => {
    edited();
    if (event.target.name === "linkEnabled" && event.target.checked) {
      const row = event.target.closest("tr");
      if (!row.querySelector('[name="website"]').value.trim()) openDetails(row, true);
    }
  });
  list.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const row = button.closest("tr");
    const action = button.dataset.action;
    if (action === "more") { openDetails(row); return; }
    if (action === "delete") row.remove();
    if (action === "up" && row.previousElementSibling) list.insertBefore(row, row.previousElementSibling);
    if (action === "down" && row.nextElementSibling) list.insertBefore(row.nextElementSibling, row);
    edited();
  });

  document.querySelector("#add-member").addEventListener("click", () => {
    const row = add({ group: "community" });
    edited();
    row.querySelector('[name="name"]').focus();
  });

  document.querySelector("#preview-members").addEventListener("click", () => {
    const members = validated();
    if (!members) return;
    api.render(preview, members, "../");
    message("预览已更新。检查后点击“应用到工程”保存。");
    preview.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  document.querySelector("#export-members").addEventListener("click", () => {
    const members = validated();
    if (!members) return;
    const url = URL.createObjectURL(new Blob([api.serialize(members)], { type: "text/javascript;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "members-data.js";
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 10000);
    dirty = false;
    message("已下载 members-data.js。请替换工程根目录的同名文件后提交发布；下载本身不会更新网站。");
  });

  document.querySelector("#apply-members").addEventListener("click", async (event) => {
    const members = validated();
    if (!members) return;
    const button = event.currentTarget;
    button.disabled = true;
    try {
      const text = await window.EditorFiles.apply("members", members, api.serialize);
      api.render(preview, members, "../");
      dirty = false;
      message(text);
    } catch (error) {
      message(error.name === "AbortError" ? "已取消应用，编辑内容保留。" : error.message, error.name !== "AbortError");
    } finally { button.disabled = false; }
  });

  document.querySelector("#import-members").addEventListener("click", () => {
    document.querySelector("#import-file").click();
  });
  document.querySelector("#import-file").addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    if (dirty && !window.confirm("导入会替换当前未导出的修改，继续吗？")) {
      event.target.value = "";
      return;
    }
    try {
      const members = api.parse(await file.text());
      load(members);
      dirty = false;
      message("资料已导入，可以继续编辑。发布时仍需替换工程里的 members-data.js。");
    } catch (error) {
      message("导入失败：" + error.message, true);
    }
    event.target.value = "";
  });

  function previewExcel() {
    document.querySelector("#excel-error").hidden = true;
    const sheet = excelSheets[Number(excelSheet.value)];
    const table = document.querySelector("#excel-preview-list");
    const issues = document.querySelector("#excel-issues-list");
    table.replaceChildren();
    issues.replaceChildren();
    excelResult = null;
    excelApply.disabled = true;
    try {
      const result = window.MemberExcelImport.convert(sheet.rows, excelExisting, { updateExisting: excelUpdate.checked, images: sheet.images });
      excelResult = result;
      document.querySelector("#excel-summary").textContent = `共 ${result.sourceCount} 条回复：可新增 ${result.members.length} 人，更新 ${result.updates.length} 人，跳过 ${result.skipped.length} 条，需修正 ${result.errors.length} 条。`;
      for (const entry of result.entries) {
        const member = entry.member;
        const row = document.createElement("tr");
        const kind = document.createElement("td");
        kind.textContent = entry.kind === "update" ? "更新" : "新增";
        kind.className = "excel-kind-value";
        const picture = document.createElement("td");
        const img = document.createElement("img");
        img.alt = `${member.name}的头像`;
        if (entry.image && excelAvatars.checked) {
          if (!excelImageURLs.has(entry.image)) excelImageURLs.set(entry.image, URL.createObjectURL(new Blob([entry.image.bytes], { type: entry.image.mime })));
          img.src = excelImageURLs.get(entry.image);
        } else img.src = "../" + (member.avatar || "assets/images/member-placeholder.svg");
        picture.append(img);
        row.append(kind, picture);
        for (const value of [member.name, member.interests || member.role || "—", member.description || "—", member.linkEnabled ? member.website : "关闭", member.qq || "不展示"]) {
          const cell = document.createElement("td");
          cell.textContent = value;
          row.append(cell);
        }
        table.append(row);
      }
      const omitted = [...result.errors, ...result.skipped];
      for (const item of omitted.slice(0, 100)) {
        const li = document.createElement("li");
        li.textContent = `Excel 第 ${item.row} 行：${item.reason}`;
        issues.append(li);
      }
      if (omitted.length > 100) {
        const li = document.createElement("li");
        li.textContent = `还有 ${omitted.length - 100} 条未导入记录未列出，请检查原始表格。`;
        issues.append(li);
      }
      for (const warning of sheet.imageWarnings) {
        const li = document.createElement("li");
        li.textContent = warning;
        issues.append(li);
      }
      document.querySelector("#excel-issues").hidden = omitted.length + sheet.imageWarnings.length === 0;
      document.querySelector("#excel-issues").open = result.errors.length > 0;
      document.querySelector("#excel-issues-title").textContent = `查看未导入记录与提示（${omitted.length + sheet.imageWarnings.length}）`;
      const note = result.imageCount
        ? excelAvatars.checked ? `将保存 ${result.imageCount} 张头像（含补充附件）。直接打开文件时，需选择一次网站工程文件夹；也支持本地编辑服务。` : "已关闭头像导入，将保留原有头像。"
        : "没有可导入的内嵌头像，将保留原有头像；新成员使用默认图片。";
      document.querySelector("#excel-avatar-note").textContent = note + (result.avatarCount > result.imageCount ? " 附件名称和外部图片链接不会自动下载，请通过“更多”手动设置。" : "");
      excelApply.disabled = result.entries.length === 0;
      excelApply.textContent = result.entries.length ? `确认导入 ${result.entries.length} 人` : "没有可导入的成员";
    } catch (error) {
      document.querySelector("#excel-summary").textContent = error.message;
      document.querySelector("#excel-avatar-note").textContent = "";
      document.querySelector("#excel-issues").hidden = true;
    }
  }

  document.querySelector("#import-excel").addEventListener("click", () => {
    document.querySelector("#excel-file").click();
  });
  document.querySelector("#excel-file").addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      if (!/\.xlsx$/i.test(file.name)) throw new Error("请选择 .xlsx 格式的 Excel 文件。");
      if (file.size > 30 * 1024 * 1024) throw new Error("表格超过 30 MB，请拆分后导入，或压缩头像。");
      message("正在读取 Excel…");
      const buffer = await file.arrayBuffer();
      const sheets = window.MemberExcelImport.read(buffer);
      await window.MemberExcelImport.loadImages(buffer, sheets);
      const existing = validated();
      if (!existing) {
        message("请先补全当前成员表格中的必填项和错误，再导入 Excel。", true);
        return;
      }
      excelSheets = sheets;
      excelExisting = existing;
      excelUpdate.checked = false;
      excelAvatars.checked = true;
      document.querySelector("#excel-attachment-status").textContent = "Excel 中缺失的头像可从导出目录的“附件”或“图片”文件夹补充，按提交者或昵称自动匹配。";
      excelSheet.replaceChildren();
      sheets.forEach((sheet, index) => {
        const option = document.createElement("option");
        option.value = index;
        option.textContent = sheet.name;
        excelSheet.append(option);
      });
      document.querySelector("#excel-filename").textContent = file.name;
      previewExcel();
      excelDialog.showModal();
      message("Excel 已读取，请核对新增、更新及头像。确认导入后仍需点击“应用到工程”保存成员资料。");
    } catch (error) {
      message("Excel 导入失败：" + error.message, true);
    } finally {
      event.target.value = "";
    }
  });
  excelSheet.addEventListener("change", previewExcel);
  document.querySelector("#excel-add-attachments").addEventListener("click", () => document.querySelector("#excel-attachment-files").click());
  document.querySelector("#excel-attachment-files").addEventListener("change", async (event) => {
    const files = Array.from(event.target.files);
    if (!files.length) return;
    const attachmentStatus = document.querySelector("#excel-attachment-status");
    excelBusy = true;
    excelDialog.querySelectorAll("button, input, select").forEach((input) => { input.disabled = true; });
    attachmentStatus.textContent = "正在匹配头像附件…";
    try {
      const result = await window.MemberExcelImport.attachImages(excelSheets, files);
      previewExcel();
      attachmentStatus.textContent = `已补充 ${result.attached} 张头像。` + (result.unmatched.length ? ` ${result.unmatched.length} 个文件没有匹配到待补充头像，可能已补充或昵称不唯一；请保留腾讯导出的文件名（提交者_时间_文件名）。` : "") + result.errors.join(" ");
    } catch (error) {
      attachmentStatus.textContent = `补充失败：${error.message}`;
    } finally {
      excelBusy = false;
      excelDialog.querySelectorAll("button, input, select").forEach((input) => { input.disabled = false; });
      excelApply.disabled = !excelResult?.entries.length;
      event.target.value = "";
    }
  });
  excelUpdate.addEventListener("change", previewExcel);
  excelAvatars.addEventListener("change", previewExcel);
  excelDialog.addEventListener("cancel", (event) => { if (excelBusy) event.preventDefault(); });
  for (const id of ["#close-excel", "#cancel-excel"]) {
    document.querySelector(id).addEventListener("click", () => { if (!excelBusy) excelDialog.close(); });
  }
  excelApply.addEventListener("click", async () => {
    if (!excelResult?.entries.length || excelBusy) return;
    excelBusy = true;
    excelDialog.querySelectorAll("button, input, select").forEach((input) => { input.disabled = true; });
    const result = excelResult;
    const errorBox = document.querySelector("#excel-error");
    errorBox.hidden = true;
    try {
      // Stage all uploads before touching the editor's list, so failures keep the current list intact.
      const staged = { entries: result.entries.map((entry) => ({ ...entry, member: { ...entry.member } })) };
      for (let index = 0; index < staged.entries.length; index++) {
        const entry = staged.entries[index];
        if (!entry.image || !excelAvatars.checked) continue;
        excelApply.textContent = `正在保存头像 ${index + 1} / ${staged.entries.length}…`;
        const file = new File([entry.image.bytes], `${entry.member.name}.${entry.image.extension}`, { type: entry.image.mime });
        entry.member.avatar = await window.EditorFiles.upload(file, "people");
      }
      load(window.MemberExcelImport.merge(excelExisting, staged));
      edited();
      message(`已新增 ${result.members.length} 人、更新 ${result.updates.length} 人。检查预览后点击“应用到工程”保存成员资料。`);
      excelDialog.close();
    } catch (error) {
      errorBox.textContent = error.name === "AbortError"
        ? "已取消选择工程文件夹，成员资料未改变。点击“选择工程文件夹”后可重试；也可取消勾选“导入内嵌头像”，只导入文字资料。"
        : `导入未完成：${error.message} 当前成员资料未改变。也可取消勾选“导入内嵌头像”后重试。`;
      errorBox.hidden = false;
      errorBox.scrollIntoView({ block: "nearest" });
    } finally {
      excelBusy = false;
      excelDialog.querySelectorAll("button, input, select").forEach((input) => { input.disabled = false; });
      excelApply.textContent = "确认导入 " + result.entries.length + " 人";
    }
  });
  excelDialog.addEventListener("close", () => {
    excelSheets = [];
    excelExisting = [];
    excelResult = null;
    for (const url of excelImageURLs.values()) URL.revokeObjectURL(url);
    excelImageURLs.clear();
  });

  window.addEventListener("beforeunload", (event) => {
    if (!dirty && !detailsDirty) return;
    event.preventDefault();
    event.returnValue = "";
  });
  try {
    load(api.normalize(window.SITE_MEMBERS));
  } catch (error) {
    message("初始资料载入失败：" + error.message + " 可导入备份文件恢复。", true);
  }
})();
