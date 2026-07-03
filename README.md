# 泉簿

极简本地记账 PWA。数据只存在你自己的手机里（IndexedDB），**无后端、零运营成本、免应用商店审核**，改完代码一推送就是新版本。

- 泉 = 古代对钱的雅称；簿 = 账簿。泉簿 = 记钱的账本。

## 功能（V1）

- **记一笔**：金额 → 分类 → 自动记账（支出/收入切换，日期默认今天）。
- **明细**：按日分组的流水，点任意一条可改金额/分类/日期/备注或删除。
- **统计**：可切换月份，看本月支出/收入/结余 + 分类占比环形图。
- **备份**：一键导出 JSON 备份、从备份恢复（换手机、清缓存前用）。
- **PWA**：可"添加到主屏幕"，离线可用，自动更新。

## 本地预览

任何静态服务器都行（Service Worker 需要 http，不能直接 file:// 打开）：

```bash
# 有 Python
python -m http.server 8080
# 或 Node
npx serve .
```

然后手机和电脑同一 Wi-Fi，用手机浏览器访问电脑局域网 IP:8080 即可体验。

## 部署（Cloudflare Pages，免费）

1. 把本目录推到一个 Git 仓库（GitHub/GitLab）。
2. Cloudflare Dashboard → Pages → 连接仓库 → 构建命令留空、输出目录填 `/`（或本文件夹）。
3. 部署完成得到一个 `https://xxx.pages.dev` 域名，手机打开即可"添加到主屏幕"。

以后每次 `git push`，Cloudflare 自动重新部署，用户下次打开就是新版 —— 这就是"迭代更新"。

## 迭代更新怎么做

- 改代码 → push → 自动部署。
- 若改了 `css`/`js` 等静态文件，把 `sw.js` 里的 `VERSION`（如 `quanbu-v1`）加一位（`v2`…），确保用户拿到最新缓存。
- 用户账目存在 IndexedDB，和代码分离，**升级永远不会丢数据**。

## 图标

`icons/icon.svg` 已够 Android/桌面 Chrome 安装使用。iOS 主屏想要更清晰的 PNG：用浏览器打开 `tools/make-icons.html`，下载 3 张 PNG 放进 `icons/`（文件名保持不变）。

## 目录结构

```
quanbu/
├─ index.html            页面结构
├─ css/style.css         样式（素雅水墨）
├─ js/db.js              IndexedDB 数据层
├─ js/app.js             应用逻辑
├─ manifest.webmanifest  PWA 清单
├─ sw.js                 Service Worker（离线 + 更新）
├─ icons/icon.svg        图标
└─ tools/make-icons.html PNG 图标生成器
```
