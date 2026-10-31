const siteBase = document.body?.dataset.siteBase || "";
window.SITE_NAV_HTML = `
<header class="site-header">
  <nav class="nav" aria-label="主导航">
    <a class="brand" href="${siteBase}index.html" aria-label="返回主页">
      <span class="logo-slot" aria-hidden="true"><img src="${siteBase}assets/images/sjtufur_logo1.png" alt=""></span>
      <span><span class="brand-title">东川路800号荣毛社</span><span class="brand-subtitle">创作 · 交流 · 聚会</span></span>
    </a>
    <details class="color-picker" data-color-picker>
      <summary aria-label="选择颜色主题" title="选择颜色主题">
        <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 1.4-3.4 1.6 1.6 0 0 1 1.2-2.6H17a4 4 0 0 0 4-4c0-4.4-4-8-9-8Z"/><circle cx="7.5" cy="10" r="1" fill="currentColor"/><circle cx="11" cy="6.8" r="1" fill="currentColor"/><circle cx="16" cy="8" r="1" fill="currentColor"/></svg>
        <span class="sr-only">颜色主题</span>
      </summary>
      <fieldset class="color-panel">
        <legend>颜色主题</legend>
        <label><input type="radio" name="site-color" value="default" checked><span class="color-swatch swatch-default" aria-hidden="true"></span>原有配色</label>
        <label><input type="radio" name="site-color" value="red"><span class="color-swatch swatch-red" aria-hidden="true"></span>交大红</label>
        <label><input type="radio" name="site-color" value="blue"><span class="color-swatch swatch-blue" aria-hidden="true"></span>蓝色</label>
      </fieldset>
    </details>
    <button class="theme-toggle" type="button" data-theme-toggle aria-pressed="false" aria-label="切换深色模式" title="切换深色模式"><span class="theme-icon" aria-hidden="true"></span><span class="sr-only" data-theme-label>深色模式</span></button>
    <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="nav-menu"><span class="sr-only">打开导航菜单</span><span></span><span></span><span></span></button>
    <ul class="nav-menu" id="nav-menu">
      <li><a data-page-target="index" href="${siteBase}index.html">主页</a></li>
      <li><a data-page-target="about" href="${siteBase}about.html">关于我们</a></li>
      <li><a data-page-target="members" href="${siteBase}members.html">成员</a></li>
      <li><a data-page-target="join" href="${siteBase}join.html">加入我们</a></li><li><a data-page-target="announcements" href="${siteBase}announcements/index.html">活动动态</a></li><li><a data-page-target="links" href="${siteBase}links.html">外部链接</a></li><li><a data-page-target="gallery" href="${siteBase}gallery.html">多媒体内容</a></li>
    </ul>
  </nav>
</header>`;
