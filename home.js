(function () {
  const target = document.querySelector("[data-home-activity]");
  if (!target) return;
  const entries = Array.isArray(window.SITE_ACTIVITY) ? window.SITE_ACTIVITY.slice(0, 3) : [];
  for (const post of entries) {
    const url = location.protocol === "file:" ? post.url.replace(/^\//, "") : post.url;
    const card = document.createElement("article");
    card.className = "home-activity-card";
    const date = document.createElement("time");
    date.dateTime = post.date;
    date.textContent = post.date.replaceAll("-", ".");
    const title = document.createElement("h3");
    const link = document.createElement("a");
    link.href = url;
    link.textContent = post.title;
    title.append(link);
    const summary = document.createElement("p");
    summary.textContent = post.summary;
    const more = document.createElement("a");
    more.className = "text-link";
    more.href = url;
    more.textContent = "阅读全文 →";
    card.append(date, title, summary, more);
    target.append(card);
  }
  if (!entries.length) target.textContent = "近期活动正在整理中。";
})();
