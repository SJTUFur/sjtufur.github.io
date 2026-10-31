(function () {
  const placeholder = "assets/images/member-placeholder.svg";
  const groups = [
    { key: "administrators", title: "管理员", description: "负责社团日常运营、活动组织与成员联络。" },
    { key: "community", title: "社员", description: "一起创作、交流和参与活动的伙伴们。" }
  ];

  function normalize(data) {
    if (!Array.isArray(data)) throw new Error("成员资料应为一个列表。");
    return data.map((entry, index) => {
      if (!entry || typeof entry !== "object") throw new Error(`第 ${index + 1} 位成员资料格式不正确。`);
      const member = {};
      for (const key of ["name", "group", "role", "interests", "qq", "avatar", "description", "website"]) {
        if (entry[key] != null && typeof entry[key] !== "string") throw new Error(`第 ${index + 1} 位成员的 ${key} 应为文字。`);
        member[key] = (entry[key] || "").trim();
      }
      if (entry.linkEnabled != null && typeof entry.linkEnabled !== "boolean") throw new Error(`第 ${index + 1} 位成员的链接开关应为 true 或 false。`);
      member.linkEnabled = entry.linkEnabled === true;
      if (!member.name) throw new Error(`请填写第 ${index + 1} 位成员的昵称。`);
      if (!groups.some((group) => group.key === member.group)) throw new Error(`请为 ${member.name} 选择管理员或社员。`);
      if (member.qq && !/^\d{5,12}$/.test(member.qq)) throw new Error(`${member.name} 的 QQ 应为 5–12 位数字，也可以留空。`);
      if (member.avatar && (!member.avatar.startsWith("assets/images/") || /[\\:?#]|(^|\/)\.{1,2}(\/|$)/.test(member.avatar))) {
        throw new Error(`${member.name} 的头像请填写 assets/images/ 下的图片路径。`);
      }
      if (member.linkEnabled) {
        try {
          const website = new URL(member.website);
          if (!/^https?:\/\//i.test(member.website) || !["https:", "http:"].includes(website.protocol)) throw new Error();
        } catch {
          throw new Error(`请为 ${member.name} 填写完整的网页地址，以 https:// 或 http:// 开头；也可以关闭名字链接。`);
        }
      }
      return member;
    });
  }

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function render(target, data, base = "") {
    const members = normalize(data);
    target.replaceChildren();
    for (const group of groups) {
      const entries = members.filter((member) => member.group === group.key);
      if (!entries.length) continue;
      const admin = group.key === "administrators";
      const section = element("section", admin ? "section band" : "section");
      const inner = element("div", "section-inner");
      const heading = element("div", "section-heading");
      heading.append(element("h2", "", group.title), element("p", "", group.description));
      const list = element("div", admin ? "member-list" : "roster-grid");
      for (const member of entries) {
        const card = element("article", admin ? "member-row" : "roster-card");
        const image = element("img", admin ? "member-avatar" : "roster-avatar");
        image.alt = `${member.name}的头像`;
        image.loading = "lazy";
        image.addEventListener("error", () => { image.src = base + placeholder; }, { once: true });
        image.src = base + (member.avatar || placeholder);
        const info = element("div");
        const name = element("h3", "", member.linkEnabled ? "" : member.name);
        if (member.linkEnabled) {
          const link = element("a", "member-name-link", member.name);
          link.href = member.website;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          name.append(link);
        }
        info.append(name);
        if (member.role) info.append(element("span", "status-tag", member.role));
        if (member.interests) info.append(element("span", "member-interests", member.interests));
        if (member.qq) info.append(element("span", "member-contact", `QQ：${member.qq}`));
        card.append(image, info);
        if (member.description) card.append(element("p", "", member.description));
        list.append(card);
      }
      inner.append(heading, list);
      section.append(inner);
      target.append(section);
    }
    if (!members.length) {
      const section = element("section", "section");
      section.append(element("p", "section-inner", "成员资料整理中。"));
      target.append(section);
    }
  }

  function serialize(data) {
    return "// 成员资料。可用 tools/members-editor.html 编辑并导出本文件。\nwindow.SITE_MEMBERS = " + JSON.stringify(normalize(data), null, 2) + ";\n";
  }

  function parse(source) {
    // Parse only the exported JSON assignment; imported JavaScript is never executed.
    const match = source.replace(/^\uFEFF/, "").match(/^(?:\s*\/\/[^\n]*\n)*\s*window\.SITE_MEMBERS\s*=\s*([\s\S]*?)\s*;?\s*$/);
    if (!match) throw new Error("请选择由成员编辑工具导出的 members-data.js 文件。");
    return normalize(JSON.parse(match[1]));
  }

  window.MemberDirectory = { normalize, render, serialize, parse };
  const target = document.querySelector("[data-member-directory]");
  if (target) {
    try {
      render(target, window.SITE_MEMBERS);
    } catch {
      target.textContent = "成员资料暂时无法加载，请通过外部链接页面联系社团。";
    }
  }
})();
