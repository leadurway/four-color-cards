# 四色牌傳統桌遊

專為銀髮長輩特製的四色牌對戰遊戲，支援兩種玩法，具備大字體高對比介面與智慧電腦 AI 對決。

## 玩法模式

- **抓對對子簡單玩法** — 將手牌中的單張配成對子，系統自動處理暗坎與暗開車，操作簡單直覺
- **傳統吃碰標準玩法** — 正宗客家二十張玩法，支援吃（將士象／車馬包）、碰、槓，達成 10 胡自摸胡牌

## 功能特色

- 大字體高對比介面，專為長輩設計
- 智慧電腦 AI 對手
- 透視模式（防走失作弊功能）
- Web Audio 音效引擎
- 完整遊戲記錄與操作提示

## 本地開發

**前置需求：** Node.js 20+

```bash
npm install
npm run dev
```

瀏覽器開啟 `http://localhost:3000`

## 建置與部署

```bash
npm run build   # 產生 dist/
npm run lint    # TypeScript 型別檢查
```

推送至 `main` 分支會自動觸發 Cloudflare Pages 部署（由 Cloudflare Pages 直接連接
本 GitHub repo 負責建置與發布；GitHub Actions 只負責型別檢查與建置把關，不參與部署）。
Cloudflare Pages 的 Git 整合已於 2026-08-04 設定完成。

建置設定（Cloudflare Pages → 專案 → Settings → Builds & deployments）：

| 項目 | 值 |
| --- | --- |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Production branch | `main` |

## 技術架構

- **前端：** React 19 + TypeScript + Vite
- **樣式：** Tailwind CSS v4
- **圖示：** Lucide React
- **動畫：** Motion
