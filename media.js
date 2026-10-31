(function () {
  const categories = {
    group: { title: "集体活动", description: "校园合影、线下聚会与社团活动" },
    creation: { title: "创作作品", description: "社员投稿、角色设定与活动产出" },
    video: { title: "视频内容", description: "活动短片与视频记录" }
  };
  function normalize(data) {
    if (!Array.isArray(data)) throw new Error("多媒体资料应为一个列表。");
    return data.map((entry, index) => {
      if (!entry || typeof entry !== "object") throw new Error(`第 ${index + 1} 项资料格式不正确。`);
      const item = {};
      for (const field of ["title", "category", "image", "alt", "description", "credit", "date", "url"]) {
        if (entry[field] != null && typeof entry[field] !== "string") throw new Error(`第 ${index + 1} 项的 ${field} 应为文字。`);
        item[field] = (entry[field] || "").trim();
      }
      if (!item.title) throw new Error(`请填写第 ${index + 1} 项的标题。`);
      if (!Object.hasOwn(categories, item.category)) throw new Error(`${item.title} 的分类不正确。`);
      if (entry.featured != null && typeof entry.featured !== "boolean") throw new Error(`${item.title} 的首页展示开关格式不正确。`);
      item.featured = entry.featured === true;
      if (item.image && (!item.image.startsWith("assets/images/") || /[\\%:?#]|(^|\/)\.{1,2}(\/|$)/.test(item.image))) throw new Error(`${item.title} 的图片请填写 assets/images/ 下的路径。`);
      if (item.category !== "video" && !item.image) throw new Error(`请为 ${item.title} 填写图片路径。`);
      if (item.date && !/^\d{4}(?:-(?:0[1-9]|1[0-2])(?:-(?:0[1-9]|[12]\d|3[01]))?)?$/.test(item.date)) throw new Error(`${item.title} 的日期请填写 YYYY、YYYY-MM 或 YYYY-MM-DD。`);
      if (item.url) {
        try {
          const url = new URL(item.url);
          if (!/^https?:\/\//i.test(item.url) || !["http:", "https:"].includes(url.protocol)) throw new Error();
        } catch { throw new Error(`${item.title} 的网页链接须以 https:// 或 http:// 开头。`); }
      }
      if (item.category === "video" && !item.url) throw new Error(`请为 ${item.title} 填写视频网页链接。`);
      return item;
    });
  }
  function node(tag, className, text) {
    const result = document.createElement(tag);
    if (className) result.className = className;
    if (text) result.textContent = text;
    return result;
  }
  function card(item, base) {
    const article = node("article", "media-card");
    const link = node("a", "media-card-visual");
    link.href = item.url || base + item.image;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.setAttribute("aria-label", item.category === "video" ? `观看视频：${item.title}` : `查看：${item.title}`);
    if (item.image) {
      const image = node("img");
      image.src = base + item.image;
      image.alt = item.alt || item.title;
      image.loading = "lazy";
      image.addEventListener("error", () => {
        image.remove();
        link.append(node("span", "media-image-fallback", "图片暂时无法显示"));
      }, { once: true });
      link.append(image);
    } else link.append(node("span", "media-video-cover", "▶"));
    if (item.category === "video") link.append(node("span", "media-video-label", "观看视频 ↗"));
    const body = node("div", "media-card-body");
    const heading = node("h3");
    const title = node("a", "", item.title);
    title.href = link.href;
    title.target = "_blank";
    title.rel = "noopener noreferrer";
    heading.append(title);
    body.append(heading);
    const meta = [item.date.replaceAll("-", "."), item.credit].filter(Boolean).join(" · ");
    if (meta) body.append(node("p", "media-card-meta", meta));
    if (item.description) body.append(node("p", "media-card-description", item.description));
    article.append(link, body);
    return article;
  }
  function render(target, data, base = "") {
    const items = normalize(data);
    target.replaceChildren();
    for (const [key, category] of Object.entries(categories)) {
      const section = node("section", "album-section");
      section.id = key;
      const heading = node("div", "album-heading");
      heading.append(node("h2", "", category.title), node("p", "", category.description));
      const grid = node("div", "media-grid");
      for (const item of items.filter((entry) => entry.category === key)) grid.append(card(item, base));
      section.append(heading);
      if (grid.children.length) section.append(grid);
      else section.append(node("p", "media-empty", "暂时还没有内容。"));
      target.append(section);
    }
  }
  function renderFeatured(target, data, base = "") {
    target.replaceChildren();
    const items = normalize(data).filter((item) => item.featured).slice(0, 3);
    for (const item of items) target.append(card(item, base));
    if (!items.length) target.append(node("p", "media-empty", "更多影像与作品请前往多媒体页面查看。"));
  }
  function serialize(data) {
    return "// 多媒体资料。可用 tools/media-editor.html 编辑。\nwindow.SITE_MEDIA = " + JSON.stringify(normalize(data), null, 2) + ";\n";
  }
  function parse(source) {
    const match = source.replace(/^\uFEFF/, "").match(/^(?:\s*\/\/[^\n]*\n)*\s*window\.SITE_MEDIA\s*=\s*([\s\S]*?)\s*;?\s*$/);
    if (!match) throw new Error("请选择多媒体编辑工具导出的 media-data.js 文件。");
    return normalize(JSON.parse(match[1]));
  }
  window.MediaDirectory = { normalize, render, renderFeatured, serialize, parse };
  try {
    const gallery = document.querySelector("[data-media-gallery]");
    if (gallery) render(gallery, window.SITE_MEDIA);
    const featured = document.querySelector("[data-media-featured]");
    if (featured) renderFeatured(featured, window.SITE_MEDIA);
  } catch (error) {
    const target = document.querySelector("[data-media-gallery], [data-media-featured]");
    if (target) target.textContent = "多媒体内容暂时无法加载。";
  }
})();
