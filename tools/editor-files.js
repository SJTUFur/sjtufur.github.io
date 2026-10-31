(function () {
  const handles = new Map();
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
    const local = await session();
    if (local) {
      const response = await fetch("/__editor/apply", {
        method: "POST", headers: { "Content-Type": "application/json", "X-Editor-Token": local.token },
        body: JSON.stringify({ kind, data })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "保存失败。");
      return `已应用到工程的 ${filename}。刷新网站即可查看；线上更新仍需提交发布。`;
    }
    if (typeof window.showSaveFilePicker !== "function") {
      throw new Error("请在工程目录运行 python3 tools/editor_server.py，并从该服务打开编辑器后应用。也可使用“下载资料”保存文件。");
    }
    let handle = handles.get(kind);
    if (!handle) {
      handle = await window.showSaveFilePicker({ suggestedName: filename, types: [{ description: "网站资料", accept: { "text/javascript": [".js"] } }] });
      if (handle.name !== filename) throw new Error(`请选择工程根目录中的 ${filename}。`);
    }
    const writable = await handle.createWritable();
    await writable.write(source);
    await writable.close();
    handles.set(kind, handle);
    return `已保存 ${filename}。请确认所选文件位于工程根目录，刷新网站查看；线上更新仍需提交发布。`;
  }
  async function upload(file, folder = "gallery") {
    const local = await session();
    if (!local) throw new Error("上传图片需通过本地编辑服务打开工具：python3 tools/editor_server.py。也可自行把图片放入 assets/images/ 后填写路径。");
    const response = await fetch("/__editor/image?name=" + encodeURIComponent(file.name) + "&folder=" + encodeURIComponent(folder), {
      method: "POST", headers: { "Content-Type": "application/octet-stream", "X-Editor-Token": local.token }, body: file
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "图片保存失败。");
    return result.path;
  }
  window.EditorFiles = { apply, upload };
})();
