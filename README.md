# 东川路800号荣毛社主页

组织网站：**https://sjtufur.github.io/**

维护仓库：[SJTUFur/sjtufur.github.io](https://github.com/SJTUFur/sjtufur.github.io)。本项目从 [Rappy325/sjtufur_page](https://github.com/Rappy325/sjtufur_page) 迁入，保留原有提交历史、页面和素材。

这是一个静态多页面网站，活动动态由 Hugo 0.147.0 构建。GitHub Actions 会完成构建和发布，无需在本机安装 Node.js 依赖。

## 文件结构

```text
.
├── index.html
├── about.html
├── mascot.html          # 旧地址跳转到关于我们
├── members.html
├── members-data.js      # 成员资料（编辑工具导出）
├── members.js           # 成员页面渲染与资料校验
├── join.html
├── join.js              # 复制管理员 QQ
├── announcements.html    # 旧地址跳转页
├── links.html
├── gallery.html
├── media-data.js        # 多媒体资料，与首页共用
├── media.js
├── home.js
├── activity-data.js     # 本地活动预览快照；正式发布由 Hugo 自动生成
├── styles.css
├── nav.js              # 全站共用导航栏（修改这里即可同步所有页面）
├── script.js
├── tools/               # 本地成员、多媒体编辑工具，不发布到网站
├── hugo/                # 活动动态 Markdown 博客
│   ├── content/announcements/
│   └── layouts/announcements/
├── .github/workflows/hugo-pages.yml
└── assets/
    └── images/
        └── sjtufur_logo1.png
```

## 各页面填写位置

- `index.html`：主页欢迎语、轮播图、最新三篇活动动态与勾选的多媒体展示。
- `about.html`：社团简介、Logo、吉祥物与印章。活动介绍统一通过活动动态维护。
- `mascot.html`：兼容旧链接，自动跳转到关于我们页面的徽章部分。
- `members.html`：独立的成员页面；实际资料在 `members-data.js` 中维护。
- `join.html`：校内同学添加管理员 QQ 后加入校内群；校外同好关注公开平台或加入 QQ 迎新群。
- `announcements/`：由 Hugo 自动生成的活动动态 Markdown 博客。
- `links.html`：QQ 群、Bilibili、GitHub、邮箱等外部入口。
- `gallery.html`：活动相册、成员作品和视频内容，资料来自 `media-data.js`。
- 所有页面顶部都提供“深夜模式”切换按钮，选择会保存在浏览器本地。
- 导航栏的调色盘按钮可选择“原有配色 / 交大红 / 蓝色”，并在换页和刷新后保留。交大红与蓝色仅改变导航栏和页尾底色，文字使用白色，页面主体保留白天模式，且不提供深色切换；“原有配色”仍可切换深浅模式。交大红使用 `#C8161E`，蓝色使用 `#1D5EB5`；交大红参考[学校视觉识别色彩规范](https://vi.sjtu.edu.cn/index.php/articles/base/3)。
- 外部链接中提供 [SJTU Furry 活动组织手记](https://sjtufur.github.io/organizer_manual/)，供活动组织者参考。

## 修改导航栏

导航栏统一写在 `nav.js` 的 `window.SITE_NAV_HTML` 模板中。所有页面只保留
`<div data-site-nav-slot></div>` 挂载点，并在页面底部依次加载 `nav.js`、`script.js`，
因此只需修改 `nav.js`，刷新任意页面即可同步更新。`nav.html` 是便于查看的静态预览副本，
不参与页面加载。

打开对应文件并搜索 `<!--`，即可找到中文维护注释。复制示例区块时，应复制从开始标签到结束标签的完整内容，避免破坏页面结构。

完整的 GitHub 推送和活动发布步骤请参阅 [PUBLISH_GUIDE.md](PUBLISH_GUIDE.md)。

## 维护成员资料

推荐双击 `tools/启动编辑工具.command`，或在工程目录运行：

```sh
python3 tools/editor_server.py
```

打开终端显示的网址，选择“成员资料”或“多媒体资料”。本地编辑服务仅监听本机，不需要安装第三方 Python 包。编辑后点击“应用到工程”即可写回资料文件，刷新网站预览查看；线上网站仍需提交并通过 PR 发布。图片上传也通过此服务保存到工程。

也可直接用浏览器打开 `tools/members-editor.html` 编辑和下载资料。支持文件保存选择器的浏览器可选择工程中的资料文件来应用；其他浏览器请使用上述本地服务，或继续下载后替换文件。

1. 工具会读取工程根目录的 `members-data.js`，显示现有成员。
2. 每位成员在表格中占一行。点击“新增成员”，填写昵称、分组（管理员 / 社员）。部门或兴趣方向、QQ 均可留空；QQ 留空时不显示联系方式。
3. 点击该成员的“更多”，编辑头像路径、一句话简介和个人网页。如需头像，先把图片放入 `assets/images/people/`，再填入相对工程根目录的路径，例如 `assets/images/people/瑞皮.png`。不填或图片加载失败时使用默认头像。开启“名字链接”后，填写以 `https://` 或 `http://` 开头的完整网址，成员页的名字将链接到该网页，并在新标签页打开。关闭开关后显示普通名字，网址仍会保留。旧版资料文件默认关闭名字链接。
4. 可以修改、删除成员或使用“上移 / 下移”调整同一分组中的显示顺序。“更新预览”可查看实际成员页效果；没有成员的分组不会显示。
5. 点击“应用到工程”直接保存 `members-data.js`，刷新 `members.html` 检查效果。也可点击“下载成员资料”，用下载文件**替换工程根目录的同名文件**。下载本身不会自动修改工程或线上网站。
6. 将资料文件和新增图片一起提交，通过原有 PR 流程合并发布。

“导入资料文件”可以继续编辑此前下载的 `members-data.js`。工具在本地运行，不上传资料，`tools/` 也不会被部署到公开网站。请只填写成员同意公开的信息。

### 从腾讯文档收集表导入

按 [问卷设计说明](tools/member-questionnaire.md) 创建收集表，保持题目名称一致。导出回复为 `.xlsx` 后，点击成员编辑器中的“导入 Excel”，核对预览并确认追加。所有导入操作都在本地进行，读取库随工具存放，无需联网。

新资料统一进入“社员”分组，只导入明确同意公开展示的记录，QQ 需单独同意公开。已有昵称不会覆盖，错误和重复记录会列出原因。头像附件需单独下载到工程并填写路径。最后应用到工程（或下载后替换资料文件），再提交发布。

## 维护多媒体内容

从本地编辑入口选择“多媒体资料”，或直接打开 `tools/media-editor.html`。

- 每项占一行，可以填写标题、分类、日期，调整顺序并开启“首页展示”。首页按表格顺序取勾选内容中的前 3 项。
- 点击“更多”填写图片路径、图片说明、内容简介、作者或来源，以及可选网页链接。
- 分类为“视频内容”时须填写视频播放页链接，封面可选；照片和作品留空链接时点击打开原图。
- 通过本地编辑服务打开时，可直接“上传图片到工程”，自动生成路径并预览；也可自行把图片放进 `assets/images/` 后填写路径。
- “更新预览”用于核对效果；“应用到工程”保存 `media-data.js`，同时更新多媒体页和首页数据来源。仍需刷新已打开的预览页。
- “导入资料 / 下载资料”支持备份和恢复 `media-data.js`。新增图片需要和资料文件一起提交。

本地工具不会自动提交 Git 或发布网站，`tools/` 目录不会进入部署产物。

## 首页活动摘要

正式发布时，Hugo 从已公开的活动文章自动生成 `activity-data.js`，取日期最新的三篇；草稿和未来文章不会展示。部署步骤只复制静态页面及媒体资料，不会用工程中的本地快照覆盖这份生成结果。

工程根目录的 `activity-data.js` 是直接打开 HTML 时使用的本地预览快照。更新文章后，如需刷新此快照，可安装与工作流一致的 Hugo 后在工程目录运行：

```sh
hugo --source hugo --destination public
cp hugo/public/activity-data.js activity-data.js
```

直接打开源文件不能查看未构建的活动详情，完整活动页面请查看 Hugo 构建产物或正式网站。

加入我们页面的 B 站和 QQ 迎新群复用现有公开入口。微信公众号尚未提供名称、链接或二维码，目前仅保留关注说明，确认后在 `join.html` 的中文注释处补充。

## Logo 和图片

- 现有社团 Logo 文件名为 `sjtufur_logo1.png`，放到 `assets/images/`，所有页面都会自动使用它。
- 其他图片也放在 `assets/images/`。建议使用英文小写文件名，例如 `welcome-meeting-2026.jpg`。
- 相册图片维护示例写在 `gallery.html` 的中文注释中；Logo、角色设定图与表情包位于 `about.html`。
- 外部链接中的 `href="#"` 是占位值，发布前必须替换为真实地址。

## 本地预览

这个网站可以直接双击 `index.html` 预览。通过导航栏检查各个页面，并在桌面和手机宽度下确认文字与图片显示正常。
直接打开时，`announcements/index.html` 是 Hugo 构建前的本地兼容页面；正式部署到 GitHub Pages 后，该地址会由 Hugo 自动生成的活动动态列表替换。为兼容本地双击预览，导航链接使用完整的 `announcements/index.html` 路径。

## GitHub Pages 部署

1. 组织仓库为 `SJTUFur/sjtufur.github.io`，`hugo/config.toml` 的 `baseURL` 为 `https://sjtufur.github.io/`。
2. 仓库 `Settings → Pages` 的发布来源使用 `GitHub Actions`。唯一部署流程为 `.github/workflows/hugo-pages.yml`，同时发布静态页面和活动动态。
3. 以后新增或修改 `hugo/content/announcements/` 下的 `.md` 文件，通过 Pull Request 合并到 `main` 后，Action 会自动构建和发布。需要重新发布时，也可在 `Actions → Build and deploy GitHub Pages → Run workflow` 手动触发。

### 新增一篇活动动态

复制 `hugo/content/announcements/2026-09-welcome.md`，改文件名和 front matter：

```yaml
---
title: "活动标题"
date: 2026-10-01T19:00:00+08:00
draft: false
tags: ["线下活动"]
summary: "列表页显示的一句话摘要"
---
```

`draft: true` 的文章不会公开显示；准备发布时改成 `false`，然后提交并走 Pull Request 合并到 `main` 即可。
