(function () {
  const aliases = {
    name: ["昵称", "成员昵称", "名字", "name"],
    role: ["兴趣方向", "部门/兴趣", "部门/兴趣方向", "部门", "role"],
    description: ["一句话简介", "一句话介绍", "个人简介", "简介", "description"],
    website: ["个人网页", "目标网页", "个人主页", "网页链接", "website"],
    linkEnabled: ["启用名字链接", "是否启用名字链接", "名字链接", "linkenabled"],
    qq: ["qq", "qq号", "qq号码"],
    publicQQ: ["公开qq", "是否公开qq"],
    consent: ["同意公开展示", "是否同意公开展示", "公开展示授权"],
    avatarAttachment: ["头像", "上传头像", "头像图片"],
    avatar: ["头像路径", "avatar"]
  };

  function header(value) {
    return String(value ?? "").trim()
      .replace(/^\d+\s*[.．、:：)）]\s*/, "")
      .replace(/[（(](?:必填|选填|可选)[）)]/g, "")
      .replace(/[\s*＊]/g, "").toLowerCase();
  }

  function columns(row) {
    const result = {};
    const duplicates = [];
    row.forEach((value, index) => {
      const field = Object.keys(aliases).find((key) => aliases[key].some((name) => header(name) === header(value)));
      if (field) {
        if (result[field] !== undefined) duplicates.push(String(value));
        else result[field] = index;
      }
    });
    return { fields: result, duplicates };
  }

  function findHeader(rows) {
    for (let index = 0; index < Math.min(rows.length, 30); index++) {
      const { fields, duplicates } = columns(rows[index]);
      if (fields.name !== undefined && Object.keys(fields).length > 1) {
        if (duplicates.length) throw new Error(`表头中的“${duplicates.join("、")}”重复，请检查列名。`);
        return { index, fields };
      }
    }
    return null;
  }

  function choice(value) {
    const text = String(value ?? "").trim().toLowerCase();
    if (["是", "同意", "同意公开展示", "开启", "启用", "yes", "true", "1"].includes(text)) return true;
    if (["否", "不同意", "不同意公开展示", "不展示", "不公开", "关闭", "不启用", "no", "false", "0"].includes(text)) return false;
    return null;
  }

  const nameKey = (value) => String(value).trim().normalize("NFKC").toLowerCase();

  function convert(rows, existing, options = {}) {
    const found = findHeader(rows);
    if (!found) throw new Error("未找到表头。请确认包含“昵称”，以及兴趣方向、简介、个人网页或其他成员资料列。");
    const { index, fields } = found;
    const known = new Map();
    existing.forEach((member, index) => {
      const key = nameKey(member.name);
      known.set(key, known.has(key) ? -1 : index);
    });
    const seen = new Set();
    const result = { members: [], updates: [], entries: [], skipped: [], errors: [], avatarCount: 0, imageCount: 0, sourceCount: 0 };
    for (let i = index + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row.some((value) => String(value ?? "").trim())) continue;
      result.sourceCount++;
      if (result.sourceCount > 5000) throw new Error("回复超过 5000 条，请拆分表格后分别导入。");
      const at = (key) => String(row[fields[key]] ?? "").trim();
      const rowNumber = i + 1;
      if (choice(at("consent")) === false) {
        result.skipped.push({ row: rowNumber, reason: "明确选择不公开展示" });
        continue;
      }
      const key = nameKey(at("name"));
      if (seen.has(key)) {
        result.skipped.push({ row: rowNumber, reason: `昵称“${at("name")}”在本表重复，请合并为一份回复` });
        continue;
      }
      if (known.has(key) && !options.updateExisting) {
        result.skipped.push({ row: rowNumber, reason: `昵称“${at("name")}”已存在，本次未覆盖` });
        continue;
      }
      try {
        if (at("consent") && choice(at("consent")) === null) throw new Error("“同意公开展示”请填写“是”或“否”，也可以留空（默认同意）");
        if (known.get(key) === -1) throw new Error(`现有名录中有多位“${at("name")}”，请先核对昵称，无法自动更新`);
        for (const [field, label] of [["linkEnabled", "启用名字链接"], ["publicQQ", "公开QQ"]]) {
          if (at(field) && choice(at(field)) === null) throw new Error(`“${label}”请填写“是”或“否”`);
        }
        const target = known.get(key);
        const record = target === undefined ? { name: at("name"), group: "community" } : { ...existing[target] };
        // A collected interest never changes an administrator's department or group.
        if (fields.role !== undefined) {
          if (record.group === "administrators") record.interests = at("role");
          else { record.role = at("role"); record.interests = ""; }
        }
        for (const field of ["description", "website"]) {
          if (fields[field] !== undefined) record[field] = at(field);
        }
        if (fields.linkEnabled !== undefined) record.linkEnabled = choice(at("linkEnabled")) === true;
        if (fields.publicQQ !== undefined) record.qq = choice(at("publicQQ")) === true ? at("qq").replace(/^'/, "") : "";
        if (at("avatar")) record.avatar = at("avatar");
        const member = window.MemberDirectory.normalize([record])[0];
        const image = options.images?.get(rowNumber);
        const entry = { member, index: target, row: rowNumber, image, kind: target === undefined ? "new" : "update" };
        result.entries.push(entry);
        if (target === undefined) result.members.push(member);
        else result.updates.push(entry);
        seen.add(key);
        if (at("avatarAttachment")) result.avatarCount++;
        if (image) result.imageCount++;
      } catch (error) {
        result.errors.push({ row: rowNumber, reason: error.message });
      }
    }
    return result;
  }

  function merge(existing, result) {
    const merged = existing.map((member) => ({ ...member }));
    for (const entry of result.entries) {
      if (entry.index === undefined) merged.push(entry.member);
      else merged[entry.index] = entry.member;
    }
    return window.MemberDirectory.normalize(merged);
  }

  function read(buffer) {
    if (!window.XLSX) throw new Error("Excel 读取库未加载，请确认 tools/vendor 文件夹完整。");
    const book = window.XLSX.read(buffer, {
      type: "array", cellFormula: false, cellHTML: false, cellStyles: false,
      sheetRows: 5031
    });
    const sheets = [];
    for (const name of book.SheetNames) {
      const sheet = book.Sheets[name];
      if (!sheet["!ref"]) continue;
      const range = window.XLSX.utils.decode_range(sheet["!fullref"] || sheet["!ref"]);
      if (range.e.r > 5030 || range.e.c > 200) continue;
      // Keep numeric identifiers as their values, not scientific-format display strings.
      const rows = window.XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: true, blankrows: true, range: 0 });
      if (findHeader(rows)) sheets.push({ name, rows, merges: sheet["!merges"] || [], images: new Map(), imageWarnings: [] });
    }
    if (!sheets.length) throw new Error("没有找到可导入的工作表：需包含“昵称”和其他成员资料列，表头在前 30 行，最多 5000 条回复。请参考问卷设计说明。");
    return sheets;
  }

  window.MemberExcelImport = { convert, read, merge, findHeader };
})();
