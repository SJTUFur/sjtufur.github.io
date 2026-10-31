(function () {
  const relationshipNS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
  const children = (node, name) => Array.from(node.getElementsByTagNameNS("*", name));
  const child = (node, name) => children(node, name)[0];
  const relatedId = (node, name = "id") => node.getAttributeNS(relationshipNS, name);

  const positionOrder = (a, b) => a.column - b.column || a.offset - b.offset || a.top - b.top;
  function selectAvatar(images) {
    return images.filter((candidate) => candidate.image).sort(positionOrder)[0]?.image;
  }

  function imageType(bytes) {
    const prefix = Array.from(bytes.slice(0, 12), (byte) => String.fromCharCode(byte)).join("");
    // Tencent exports can label JPEG bytes as imageN.png; trust the bytes, not the suffix.
    if (prefix.startsWith("\x89PNG\r\n\x1a\n")) return { extension: "png", mime: "image/png" };
    if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return { extension: "jpg", mime: "image/jpeg" };
    if (/^(GIF87a|GIF89a)/.test(prefix)) return { extension: "gif", mime: "image/gif" };
    if (prefix.startsWith("RIFF") && prefix.slice(8, 12) === "WEBP") return { extension: "webp", mime: "image/webp" };
    return null;
  }

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
          sheet.imageCandidates = candidates;
          sheet.missingImages = [];
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
              const offset = Number(child(from, "colOff")?.textContent) || 0;
              const top = Number(child(from, "rowOff")?.textContent) || 0;
              if (!Number.isInteger(row) || row <= found.index || row >= sheet.rows.length || column < avatarColumn || column > lastColumn) continue;
              const blip = child(anchor, "blip");
              const path = blip && imageLinks.get(relatedId(blip, "embed"));
              if (!path || !zip.file(path)) {
                const warning = `第 ${row + 1} 行头像未打包进 Excel，请点击“补充头像附件”选择下载目录中对应的图片（支持 JFIF）。`;
                const missing = { row: row + 1, column, offset, top, warning, reference: blip && (relatedId(blip, "embed") || relatedId(blip, "link")) || "" };
                sheet.missingImages.push(missing);
                const images = candidates.get(row + 1) || [];
                images.push(missing);
                candidates.set(row + 1, images);
                sheet.imageWarnings.push(warning);
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
                const type = imageType(bytes);
                if (!type) {
                  sheet.imageWarnings.push(`第 ${row + 1} 行头像不是支持的 PNG、JPG、GIF 或 WebP 图片，请手动添加。`);
                  continue;
                }
                image = { bytes, ...type };
                imageCache.set(path, image);
              }
              const images = candidates.get(row + 1) || [];
              images.push({ image, column, offset, top });
              candidates.set(row + 1, images);
            }
          }
          for (const [row, images] of candidates) {
            const image = selectAvatar(images);
            if (image) sheet.images.set(row, image);
            if (images.length > 1) sheet.imageWarnings.push(`第 ${row} 行有多张头像，已自动选择从左边数第一张，可在预览中核对。`);
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
  const key = (value) => String(value || "").trim().normalize("NFKC").toLowerCase();
  async function attachImages(sheets, files) {
    const targets = [];
    for (const sheet of sheets) {
      const found = window.MemberExcelImport.findHeader(sheet.rows);
      const submitter = sheet.rows[found.index].findIndex((value) => /^提交者(?:[（(]自动[）)])?$/.test(String(value).trim()));
      for (const missing of sheet.missingImages || []) {
        if (!missing.image) targets.push({ sheet, missing, names: [sheet.rows[missing.row - 1][found.fields.name], sheet.rows[missing.row - 1][submitter]].filter(Boolean).map(key) });
      }
    }
    const result = { attached: 0, unmatched: [], errors: [] };
    let bytesRead = 0;
    for (const file of Array.from(files).sort((a, b) => a.name.localeCompare(b.name, "zh-CN", { numeric: true }))) {
      const owner = file.name.match(/^(.*)_\d{4}-\d{2}-\d{2} \d{2}\.\d{2}\.\d{2}_/);
      const stem = key(file.name.replace(/\.[^.]+$/, ""));
      const matches = targets.filter(({ missing, names }) => !missing.image &&
        (key(missing.reference.split(/[\\/]/).pop()) === key(file.name) || names.includes(key(owner?.[1])) || names.includes(stem)));
      const rows = new Set(matches.map(({ sheet, missing }) => `${sheets.indexOf(sheet)}:${missing.row}`));
      if (rows.size !== 1) { result.unmatched.push(file.name); continue; }
      if (!file.size || file.size > 8 * 1024 * 1024 || bytesRead + file.size > 80 * 1024 * 1024) {
        result.errors.push(`${file.name} 超出头像大小限制（单张 8 MB，补充附件合计 80 MB）。`);
        continue;
      }
      const bytes = new Uint8Array(await file.arrayBuffer());
      bytesRead += bytes.length;
      const type = imageType(bytes);
      if (!type) { result.errors.push(`${file.name} 不是支持的图片格式。`); continue; }
      const target = matches.sort((a, b) => positionOrder(a.missing, b.missing))[0];
      const { sheet, missing } = target;
      missing.image = { bytes, ...type };
      sheet.images.set(missing.row, selectAvatar(sheet.imageCandidates.get(missing.row)));
      sheet.imageWarnings = sheet.imageWarnings.filter((warning) => warning !== missing.warning);
      result.attached++;
    }
    return result;
  }
  window.MemberExcelImport.loadImages = loadImages;
  window.MemberExcelImport.imageType = imageType;
  window.MemberExcelImport.selectAvatar = selectAvatar;
  window.MemberExcelImport.attachImages = attachImages;
})();
