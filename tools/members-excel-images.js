(function () {
  const relationshipNS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
  const children = (node, name) => Array.from(node.getElementsByTagNameNS("*", name));
  const child = (node, name) => children(node, name)[0];
  const relatedId = (node, name = "id") => node.getAttributeNS(relationshipNS, name);

  function resolvePath(base, relative) {
    if (!relative || /^[a-z]+:|^\/\//i.test(relative) || relative.includes("\\")) return null;
    const parts = relative.startsWith("/") ? [] : base.split("/").slice(0, -1);
    for (const part of relative.split("/")) {
      if (part === "..") { if (!parts.length) return null; parts.pop(); }
      else if (part && part !== ".") parts.push(part);
    }
    return parts.join("/");
  }

  async function xml(zip, path) {
    const file = path && zip.file(path);
    if (!file) return null;
    const text = await file.async("string");
    if (text.length > 2 * 1024 * 1024 || /<!DOCTYPE/i.test(text)) throw new Error("图片索引过大或格式不支持");
    const doc = new DOMParser().parseFromString(text, "application/xml");
    if (children(doc, "parsererror").length) throw new Error("图片索引格式不正确");
    return doc;
  }

  async function relationships(zip, path) {
    const parts = path.split("/");
    const name = parts.pop();
    const doc = await xml(zip, [...parts, "_rels", name + ".rels"].join("/"));
    const result = new Map();
    if (doc) for (const node of children(doc, "Relationship")) {
      if (node.getAttribute("TargetMode") === "External") continue;
      const target = resolvePath(path, node.getAttribute("Target"));
      if (target) result.set(node.getAttribute("Id"), target);
    }
    return result;
  }

  async function loadImages(buffer, sheets) {
    try {
      if (!window.JSZip) throw new Error("图片读取库未加载，请检查 tools/vendor 文件夹");
      const zip = await window.JSZip.loadAsync(buffer);
      const workbook = await xml(zip, "xl/workbook.xml");
      if (!workbook) return sheets;
      const bookLinks = await relationships(zip, "xl/workbook.xml");
      let totalBytes = 0;
      const imageCache = new Map();
      for (const sheet of sheets) {
        try {
          const found = window.MemberExcelImport.findHeader(sheet.rows);
          const avatarColumn = found.fields.avatarAttachment;
          if (avatarColumn === undefined) continue;
          const merged = sheet.merges.find((range) => range.s.r <= found.index && range.e.r >= found.index && range.s.c === avatarColumn);
          const lastColumn = merged ? merged.e.c : avatarColumn;
          const sheetNode = children(workbook, "sheet").find((node) => node.getAttribute("name") === sheet.name);
          const sheetPath = sheetNode && bookLinks.get(relatedId(sheetNode));
          const sheetXML = await xml(zip, sheetPath);
          if (!sheetXML) continue;
          const sheetLinks = await relationships(zip, sheetPath);
          const candidates = new Map();
          for (const drawingNode of children(sheetXML, "drawing")) {
            const drawingPath = sheetLinks.get(relatedId(drawingNode));
            const drawing = await xml(zip, drawingPath);
            if (!drawing) continue;
            const imageLinks = await relationships(zip, drawingPath);
            const anchors = [...children(drawing, "oneCellAnchor"), ...children(drawing, "twoCellAnchor")];
            for (const anchor of anchors) {
              const from = child(anchor, "from");
              if (!from) continue;
              const row = Number(child(from, "row")?.textContent);
              const column = Number(child(from, "col")?.textContent);
              if (!Number.isInteger(row) || row <= found.index || row >= sheet.rows.length || column < avatarColumn || column > lastColumn) continue;
              const blip = child(anchor, "blip");
              const path = blip && imageLinks.get(relatedId(blip, "embed"));
              const extension = path?.split(".").pop().toLowerCase();
              const mime = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp" }[extension];
              if (!mime || !zip.file(path)) {
                sheet.imageWarnings.push(`第 ${row + 1} 行头像格式不支持或只有外部链接，请手动添加头像。`);
                continue;
              }
              let image = imageCache.get(path);
              if (!image) {
                const bytes = await zip.file(path).async("uint8array");
                totalBytes += bytes.length;
                if (totalBytes > 80 * 1024 * 1024) throw new Error("内嵌头像合计超过 80 MB，请拆分后导入");
                if (bytes.length > 8 * 1024 * 1024) {
                  sheet.imageWarnings.push(`第 ${row + 1} 行头像超过 8 MB，请压缩后手动添加。`);
                  continue;
                }
                image = { bytes, mime, extension };
                imageCache.set(path, image);
              }
              const images = candidates.get(row + 1) || [];
              images.push(image);
              candidates.set(row + 1, images);
            }
          }
          for (const [row, images] of candidates) {
            if (images.length === 1) sheet.images.set(row, images[0]);
            else sheet.imageWarnings.push(`第 ${row} 行有多张头像，无法自动选择，请通过“更多”手动设置。`);
          }
        } catch (error) {
          sheet.imageWarnings.push(`头像读取未完成：${error.message}。文字资料仍可导入。`);
        }
      }
    } catch (error) {
      for (const sheet of sheets) sheet.imageWarnings.push(`无法提取内嵌头像：${error.message}。可取消导入头像，只导入文字资料。`);
    }
    return sheets;
  }
  window.MemberExcelImport.loadImages = loadImages;
})();
