(function () {
  const handles = new Map();
  let project = null;
  const canChooseProject = () => typeof window.showDirectoryPicker === "function";

  function projectMessage(text, error = false) {
    for (const status of document.querySelectorAll("[data-project-status]")) {
      status.textContent = text; status.dataset.error = String(error);
    }
  }

  async function chooseProject() {
    if (!canChooseProject()) throw new Error("此浏览器不能直接保存工程文件夹。请双击 tools/启动编辑工具.command，再从打开的页面导入和应用。");
    // Open the picker directly from the click, before any network or image processing.
    const selected = await window.showDirectoryPicker({ id: "sjtufur-project", mode: "readwrite" });
    try {
      for (const name of ["index.html", "members-data.js", "media-data.js"]) await selected.getFileHandle(name);
    } catch {
      throw new Error("所选文件夹不是网站工程。请选择包含 index.html、members-data.js 的 sjtufur_page 文件夹，不要选择 tools 或头像文件夹。");
    }
    project = selected;
    projectMessage(`已连接工程文件夹“${project.name}”，可保存头像和应用资料。刷新或关闭编辑器后需要重新选择。`);
    return project;
  }

  async function write(handle, data) {
    const writable = await handle.createWritable();
    try {
      await writable.write(data);
      await writable.close();
    } catch (error) {
      await writable.abort().catch(() => {});
      throw error;
    }
  }
  async function session() {
    if (!/^https?:$/.test(location.protocol) || !["127.0.0.1", "localhost"].includes(location.hostname)) return null;
    try {
      const response = await fetch("/__editor/session", { cache: "no-store" });
      if (!response.ok) return null;
      const data = await response.json();
      return typeof data.token === "string" ? data : null;
    } catch { return null; }
  }
  async function apply(kind, data, serialize) {
    const names = { members: "members-data.js", media: "media-data.js" };
    const filename = names[kind];
    if (!filename) throw new Error("不支持的资料类型。");
    const source = serialize(data);
    // The local editing server avoids repeated file selection on all browsers.
    const local = project ? null : await session();
    if (local) {
      const response = await fetch("/__editor/apply", {
        method: "POST", headers: { "Content-Type": "application/json", "X-Editor-Token": local.token },
        body: JSON.stringify({ kind, data })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "保存失败。");
      return `已应用到工程的 ${filename}。刷新网站即可查看；线上更新仍需提交发布。`;
    }
    if (project || canChooseProject()) {
      const directory = project || await chooseProject();
      await write(await directory.getFileHandle(filename), source);
      return `已应用到工程文件夹“${directory.name}”的 ${filename}。刷新网站即可查看；线上更新仍需提交发布。`;
    }
    if (typeof window.showSaveFilePicker !== "function") {
      throw new Error("请在工程目录运行 python3 tools/editor_server.py，并从该服务打开编辑器后应用。也可使用“下载资料”保存文件。");
    }
    let handle = handles.get(kind);
    if (!handle) {
      handle = await window.showSaveFilePicker({ suggestedName: filename, types: [{ description: "网站资料", accept: { "text/javascript": [".js"] } }] });
      if (handle.name !== filename) throw new Error(`请选择工程根目录中的 ${filename}。`);
    }
    await write(handle, source);
    handles.set(kind, handle);
    return `已保存 ${filename}。请确认所选文件位于工程根目录，刷新网站查看；线上更新仍需提交发布。`;
  }
  async function upload(file, folder = "gallery") {
    // JFIF uses JPEG bytes; normalize its name for existing local servers and image hosting.
    if (/\.jfif$/i.test(file.name)) file = new File([file], file.name.replace(/\.jfif$/i, ".jpg"), { type: "image/jpeg" });
    if (!["gallery", "people"].includes(folder)) throw new Error("图片保存目录不正确。");
    if (!file.size || file.size > 8 * 1024 * 1024) throw new Error("图片不能为空，且单张不能超过 8 MB。");
    const local = project ? null : await session();
    if (!local) {
      const directory = project || await chooseProject();
      const bytes = new Uint8Array(await file.arrayBuffer());
      const extension = file.name.split(".").pop().toLowerCase();
      const prefix = Array.from(bytes.slice(0, 12), (byte) => String.fromCharCode(byte)).join("");
      const valid = (extension === "png" && prefix.startsWith("\x89PNG\r\n\x1a\n")) ||
        (["jpg", "jpeg"].includes(extension) && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) ||
        (extension === "gif" && /^(GIF87a|GIF89a)/.test(prefix)) ||
        (extension === "webp" && prefix.startsWith("RIFF") && prefix.slice(8, 12) === "WEBP");
      if (!valid) throw new Error("请选择 PNG、JPG、JFIF、GIF 或 WebP 图片。");
      const digest = await crypto.subtle.digest("SHA-256", bytes);
      const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, 12);
      const stem = file.name.replace(/\.[^.]*$/, "").replace(/[^\p{L}\p{N}_-]/gu, "-").slice(0, 50) || "image";
      const filename = `${stem}-${hash}.${extension}`;
      let images = directory;
      for (const name of ["assets", "images", folder]) images = await images.getDirectoryHandle(name, { create: true });
      // Preserve an existing image even if its name happens to collide.
      let handle;
      try { handle = await images.getFileHandle(filename); }
      catch (error) {
        if (error.name !== "NotFoundError") throw error;
        handle = await images.getFileHandle(filename, { create: true });
        await write(handle, bytes);
      }
      if (handle) {
        const saved = new Uint8Array(await (await handle.getFile()).arrayBuffer());
        if (saved.length !== bytes.length || saved.some((byte, index) => byte !== bytes[index])) throw new Error("已有同名图片内容不同，请更换头像文件名后重试。");
      }
      return `assets/images/${folder}/${filename}`;
    }
    const response = await fetch("/__editor/image?name=" + encodeURIComponent(file.name) + "&folder=" + encodeURIComponent(folder), {
      method: "POST", headers: { "Content-Type": "application/octet-stream", "X-Editor-Token": local.token }, body: file
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "图片保存失败。");
    return result.path;
  }
  window.EditorFiles = { apply, upload, chooseProject, canChooseProject };
  const connectButtons = document.querySelectorAll("[data-connect-project]");
  for (const connect of connectButtons) {
    connect.hidden = !canChooseProject();
    connect.addEventListener("click", async () => {
      try { await chooseProject(); }
      catch (error) { projectMessage(error.name === "AbortError" ? "已取消选择，编辑内容保留。" : error.message, error.name !== "AbortError"); }
    });
  }
  if (connectButtons.length) {
    if (location.protocol === "file:") projectMessage(canChooseProject()
      ? "直接打开文件：先选择网站工程文件夹，便可保存 Excel 头像和应用资料。"
      : "此浏览器不能直接写回工程。请双击 tools/启动编辑工具.command，从工具入口打开本页面。");
    else projectMessage("通过本地编辑服务打开时可直接保存；也可选择工程文件夹。应用后仍需提交发布，线上网站才会更新。");
  }
})();
