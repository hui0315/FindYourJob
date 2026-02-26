# FindYourJob 專案演變歷程 Project Evolution

> 從第一行程式碼到完整產品——基於真實 commit 紀錄的完整開發故事。

---

## 一、專案總覽 Project Overview

**一句話定位**：本地優先的求職資訊整理工具——使用者貼上職缺文字，系統透過本地 LLM 萃取結構化資料，提供可排序、可篩選的比較介面。所有資料留在使用者自己的機器上。

### 核心數據

| 指標 | 數值 |
|------|------|
| 開發天數 | 9 天（2/17 ~ 2/25） |
| 非合併 commits | 53 |
| Pull Requests | 22 |
| 程式碼行數 | ~7,300 行 |
| 淨增量 | +14,218 / -2,265 |

### 核心哲學

引用自 DESIGN.md（`f80c56b`）：

> **不做全知系統，做最好的整理工具。所有判斷都從使用者自己的資料中來，不假裝知道我們不知道的事。**

### 技術棧速覽

| 層級 | 技術 | 用途 |
|------|------|------|
| Backend | Python 3 + FastAPI 0.115.0 | API 伺服器 |
| Database | SQLite (WAL mode) | 單檔案資料庫 |
| LLM | Ollama + Qwen2.5-3B | 本地文字萃取 |
| Frontend | React 19 + Vite 7 | 互動介面 |
| Styling | Tailwind CSS 4 | 樣式系統 |
| Animation | Framer Motion 12 | UI 動畫 |
| Icons | Lucide React | 圖標系統 |
| Fuzzy Match | rapidfuzz >= 3.0 | 公司名稱比對 |

---

## 二、開發時間軸 Development Timeline

這是全文核心，按 13 個開發 session 組織。每個 commit 都是真實的 git 紀錄。

---

### Session 1 — MVP 奠基 MVP Foundation

**日期**：2026-02-17 ｜ **6 commits**

這是專案的誕生日。一天內完成了從零到可用 MVP 的全部工作，並在第一天就確立了兩個影響深遠的設計決策：fallback-first 架構和「資料閉環」哲學。

| Commit | Message | 變更 |
|--------|---------|------|
| `b878f7a` | feat: initial FindYourJob app with mock job parsing | 18 files, +4,470 |
| `ad3e069` | chore: add Vite scaffolded static assets | 3 files, +26 |
| `37193fc` | feat: add Ollama LLM parser with Qwen2.5-3B support | 5 files, +167/-5 |
| `7bf1e14` | feat: add user profile with mismatch detection and expanded job schema | 9 files, +564/-45 |
| `f80c56b` | docs: add DESIGN.md documenting core design philosophy | 1 file, +109 |
| `8d2cc5c` | feat: add skill pool with tri-state matching from job data | 7 files, +323/-18 |

**設計思考**：

- **`b878f7a`** 建立了完整的前後端骨架：FastAPI + SQLite CRUD、React + Tailwind 卡片式介面、regex 為基礎的 mock parser。這不是「先寫後端再寫前端」，而是一步到位的全端 MVP。
- **`37193fc`** 引入 Ollama LLM 解析，但關鍵是：系統在 Ollama 不可用時**自動退回 regex parser**。這個 fallback-first 的決策讓系統永遠可用，不依賴任何單一元件。
- **`f80c56b`** 在功能開發的間隙寫下了 DESIGN.md（109 行），記錄三個核心原則：LLM 只做萃取不做評價、基於相對排名、技能池從職缺中生長。這不是事後補寫的文件，而是開發過程中的主動設計決策。
- **`8d2cc5c`** 實現了「資料閉環」最好的範例——技能池。不維護預設清單，而是從使用者加入的職缺中自動聚合技能，再讓使用者分類為 known/learning/none。

---

### Session 2 — 系統強化 System Hardening

**日期**：2026-02-19 ｜ **1 commit**

| Commit | Message | 變更 |
|--------|---------|------|
| `1a759c8` | fix: normalize salary types, add location mismatch check, and harden mismatch system | 5 files, +93/-25 |

**設計思考**：

這個 commit 標誌著從「字串比對」到「結構化比對」的進化：
- 薪資比較改為先正規化到月薪（yearly÷12, hourly×160），避免跨類型的假陽性
- Mismatch 格式從純字串改為結構化物件 `{type, message}`，前端不再用脆弱的 `.includes()` 中文字串比對
- 引入環境變數（`CORS_ORIGINS`、`OLLAMA_BASE`、`OLLAMA_MODEL`），從硬編碼走向可配置
- 新增 50,000 字元輸入長度限制，前後端雙重防禦

---

### Session 3 — 結構化資料 + 雙軌輸入 Structured Data & Dual-Track Input

**日期**：2026-02-22 ｜ **6 commits**

這個 session 誕生了兩個關鍵架構：schema-driven prompt 生成和雙軌 LLM 輸入模式。

| Commit | Message | 變更 |
|--------|---------|------|
| `b628de5` | feat: 結構化薪資待遇與福利制度，參考 104/1111 人力銀行欄位格式 | 8 files, +359/-28 |
| `0a70617` | refactor: 用 Pydantic model 自動生成 LLM prompt 模板 | 2 files, +205/-98 |
| `7c5186d` | feat: 雙軌輸入模式 — 線上 LLM 複製 Prompt + 本地模型解析 | 4 files, +336/-65 |
| `11723b4` | refactor: 重構輸入流程 — 先貼文字再選解析方式 | 3 files, +110/-95 |
| `8f1e15c` | feat: prompt 加入繁體中文要求與非職缺輸入偵測 | 2 files, +7/-1 |
| `494ecef` | docs: 指定LLM輸出繁體中文JSON | 1 file, +2/-2 |

**設計思考**：

- **`b628de5`** 參考 104 人力銀行的真實分類標準，將福利從一個 `benefits` 字串拆成六大分類（bonus/insurance/leave/subsidy/system/other）。同時 DESIGN.md 第二次擴充（+33 行），新增「結構化待遇資料」章節。
- **`0a70617`** 是架構上的轉捩點——`extraction_schema.py` 誕生。從此 Pydantic model 的 `Field(description=...)` 就是 prompt 的內容，新增欄位只需改一個地方，prompt 自動更新。llm_parser.py 從 183 行簡化到 90 行。
- **`7c5186d`** 解決了一個根本問題：不是每個人都能跑 Ollama。雙軌模式讓使用者可以把 prompt 複製到 ChatGPT/Gemini/Claude，取得 JSON 後貼回系統。這大幅降低了使用門檻——「任何 LLM 都能用」。

---

### Session 4 — 編輯與補充系統 Edit & Supplement System

**日期**：2026-02-23 凌晨 ｜ **2 commits**

| Commit | Message | 變更 |
|--------|---------|------|
| `730726d` | feat: 新增職缺編輯模式，支援補充資料與手動填寫 | 7 files, +932/-9 |
| `7c2d1d3` | feat: 補充資料衝突處理 + 手動填寫/修改分離 | 3 files, +506/-211 |

**設計思考**：

這兩個 commit 確立了「非破壞性合併」和「欄位溯源」模式：
- **field_metadata**：每個欄位追蹤 `source`（llm/import/user）和 `updated_at`
- **edit_history**：JSON 陣列記錄每次變更的 action、欄位、時間戳
- 補充資料改為兩步驟：先預覽（preview）→ 衝突欄位以並排 radio button 讓使用者選擇 → 確認合併
- 手動填寫分為「快速填寫」（空欄位，黃底高亮）和「修正資料」（已有值，可折疊）

field_metadata JSON 結構範例：
```json
{
  "salary_min": {"source": "llm", "updated_at": "2026-02-23T10:30:00"},
  "skills": {"source": "user", "updated_at": "2026-02-23T14:15:00"},
  "benefits": {"source": "import", "updated_at": "2026-02-23T11:00:00"}
}
```

edit_history JSON 結構範例：
```json
[
  {
    "action": "supplement",
    "fields": ["salary_min", "salary_max", "skills"],
    "source": "import",
    "timestamp": "2026-02-23T14:15:00"
  },
  {
    "action": "manual_edit",
    "fields": ["notes"],
    "source": "user",
    "timestamp": "2026-02-23T15:00:00"
  }
]
```

---

### Session 5 — 公司資料獨立化 Company Data Separation

**日期**：2026-02-23 早上 ｜ **4 commits**

從「一張表」到「關聯式架構」，這是資料模型最大的一次重構。

| Commit | Message | 變更 |
|--------|---------|------|
| `9176cb6` | refactor: 公司與職缺資料分離，新增公司管理功能 | 11 files, +1,121/-89 |
| `06cc9be` | feat: 公司名稱正規化模組 — 三層 pipeline (前處理/模糊比對/嵌入搜尋) | 4 files, +646/-13 |
| `bbfd6e3` | feat: 公司 AI 整理功能 — LLM 結構化公司資訊 | 6 files, +1,037/-17 |
| `1b1a3be` | refactor: 公司編輯模式改為空欄位/已填欄位分層 + 來源標註 + 變更追蹤 | 1 file, +237/-101 |

**設計思考**：

- **`9176cb6`** 解決了資料冗餘問題：同一間公司的多個職缺不再重複儲存福利和聯絡方式。包含自動遷移邏輯——既有的 jobs 資料會自動建立公司記錄並關聯。DESIGN.md 第三次擴充（+43 行），新增「公司與職缺分離」章節。
- **`06cc9be`** 建立了三層公司名稱正規化 pipeline：字串前處理 → rapidfuzz 模糊比對 → sentence-transformers 嵌入搜尋。31 項測試全數通過。
- **`bbfd6e3`** 將「schema drives prompt」模式從職缺擴展到公司——`CompanyExtraction` model 自動產生公司 prompt，支援面試流程、考古題、AI 備註等 6 個新欄位。

---

### Session 6 — 功能密集迭代 Feature-Dense Iteration

**日期**：2026-02-23 白天 ｜ **6 commits**

一個下午內連續交付 6 個功能改進，從「能解析」進化到「能追蹤」。

| Commit | Message | 變更 |
|--------|---------|------|
| `96697b9` | fix: move /api/companies/prompt-template route before /{company_id} | 1 file, +6/-6 |
| `9097a6a` | fix: 衝突欄位與新增欄位顯示改為人看得懂的文字 | 1 file, +65/-8 |
| `d4c306c` | feat: 新增「工作內容」(description) 欄位，LLM 自動條列整理 | 6 files, +38/-5 |
| `ce64011` | refactor: 精簡排序按鈕為 4 個 + 新增匹配度排序 | 2 files, +29/-11 |
| `b849db8` | feat: 新增投遞狀態追蹤 (status) — 全端支援 | 5 files, +55/-12 |
| `d26656e` | refactor: 福利制度改為按分類群組顯示 | 2 files, +62/-35 |

**設計思考**：

- **`96697b9`** 修復了一個 FastAPI 路由順序 bug：`/api/companies/prompt-template` 定義在 `/{company_id}` 之後，導致 "prompt-template" 被當作 int 解析而 422 錯誤。經典的 path parameter 陷阱。
- **`b849db8`** 是功能上的重大跨越——投遞狀態追蹤。5 種狀態（未投遞→已投遞→面試中→Offer→未錄取）讓系統從「資料整理工具」升級為「求職進度管理工具」。排序按緊迫度：未投遞排最前，督促使用者行動。

---

### Session 7 — 篩選與 UX 迭代 Filtering & UX Iteration

**日期**：2026-02-23 下午 ｜ **6 commits**

| Commit | Message | 變更 |
|--------|---------|------|
| `7529a92` | feat: 職缺列表改顯示縣市 + 新增縣市篩選功能 | 9 files, +242/-24 |
| `ce1fdbd` | fix: 篩選列改用 checkbox 形式（全選 + 各縣市） | 1 file, +19/-18 |
| `87aac2d` | fix: 編輯職缺 modal 新增「關閉」按鈕 | 1 file, +8/-1 |
| `928d956` | fix: 關閉按鈕移到 modal 底部固定 footer | 1 file, +12/-8 |
| `45a8cae` | revert: 移除多餘的底部關閉按鈕 | 1 file, -11 |
| `1f05d8a` | fix: 在儲存按鈕旁新增關閉按鈕 | 1 file, +8/-1 |

**設計思考**：

關閉按鈕的 4 次迭代（`87aac2d` → `928d956` → `45a8cae` → `1f05d8a`）是 UX 打磨的縮影：

1. 新增手動填寫 tab 的關閉按鈕（但其他 tab 沒有）
2. 移到 modal 底部 footer，三個 tab 共用（但位置太遠）
3. 覺得多餘，移除底部按鈕（但使用者反應不方便）
4. 最終放在儲存按鈕旁邊（最自然的位置）

這四次迭代看似「反覆」，實際上是逐步收斂到最佳位置的過程。每個位置都有道理，但只有實際使用才知道哪個最好。

---

### Session 8 — 視覺統一 Visual Consistency

**日期**：2026-02-23 傍晚 ｜ **1 commit**

| Commit | Message | 變更 |
|--------|---------|------|
| `e094e6c` | style: 統一來源標籤為淺灰色，降低視覺干擾 | 3 files, +9/-17 |

**設計思考**：

將 JobTable、JobEditModal、CompanyManager 三處的來源標籤（手動/匯入/模型/Regex）全部統一為 `bg-gray-100 text-gray-400`。不再按來源類型分色。來源標籤的作用是「可查看」而非「搶眼」，統一為淡灰色讓它退到背景，不干擾使用者閱讀核心資訊。

---

### Session 9 — Modal UX + 技能動畫 Modal UX & Skill Animation

**日期**：2026-02-23 晚上 ｜ **2 commits**

| Commit | Message | 變更 |
|--------|---------|------|
| `1021815` | fix: 儲存後自動捲回 modal 頂端顯示成功訊息，移除底部關閉按鈕 | 1 file, +6/-10 |
| `0c3a5c9` | feat: 改善「我的條件」UX — 技能三區塊動畫 + 硬性條件重構 | 8 files, +278/-132 |

**設計思考**：

**`0c3a5c9`** 做了一個重要的設計取捨——移除薪資和地點作為硬性條件：
- **薪資**：LLM 萃取的薪資品質不穩定（面議、年薪月薪混淆），且薪資本質上是偏好而非硬性門檻
- **地點**：同理，許多使用者願意為好機會搬家
- **替代**：新增工作類型（正職/兼職/約聘/實習）和遠端類型（到班/混合/遠端）為硬性條件——這兩個欄位資料品質穩定，且真的是非黑即白的門檻

技能匹配從平鋪改為三個視覺區塊（已會/可補強/未選），搭配 Framer Motion `layoutId` 動畫，點擊技能時平滑移動到對應區塊。

---

### Session 10 — CLAUDE.md + Bug 修復 Documentation & Bug Fixes

**日期**：2026-02-23~24 ｜ **3 commits**

| Commit | Message | 變更 |
|--------|---------|------|
| `484b4fc` | docs: 新增 CLAUDE.md — 完整的代碼庫結構與開發指南 | 1 file, +248 |
| `989bcf0` | fix: 修正儲存條件後職缺衝突狀態未更新 + 顯示已儲存條件摘要 | 2 files, +73/-18 |
| `6cbb13f` | fix: 修正技能配對未持久化到資料庫 — 新增 skill_match 欄位 | 3 files, +42/-10 |

**設計思考**：

- **`484b4fc`** 撰寫了 248 行的 CLAUDE.md，包含完整的目錄結構、技術棧、開發指令、架構模式、API 端點摘要。這份文件讓 AI 助手能快速理解專案全貌。
- **`6cbb13f`** 修復了一個隱匿的 bug：skill_match 原本是動態計算、不存 DB 的。但這意味著每次載入頁面都要重算，且排序無法在 SQL 層完成。改為新增 `skill_match` 欄位，在職缺建立、更新、技能分類變更時同步重算並持久化。

---

### Session 11 — 公司管理重構 Company Management Refactor

**日期**：2026-02-25 早上 ｜ **3 commits**

| Commit | Message | 變更 |
|--------|---------|------|
| `52db0f8` | refactor: 公司管理按鈕重構 — AI 整理移入編輯頁面 tab | 1 file, +310/-296 |
| `ed355c2` | fix: 修正公司 AI 整理 interview_questions 驗證失敗 — 支援 list 型別輸入 | 1 file, +9/-1 |
| `ef2aec0` | feat: 投遞狀態提升為獨立區塊 — 從深層編輯移至 Modal 頂部 | 1 file, +44/-1 |

**設計思考**：

- **`52db0f8`** 簡化公司管理介面：移除獨立的「AI 整理」按鈕，統一為 tab 切換（手動填寫/補充資料），與職缺編輯 modal 一致。
- **`ef2aec0`** 將投遞狀態從編輯表單的深層欄位提升到 modal 頂部——因為這是最常操作的欄位，不應該需要切換 tab 才能找到。

---

### Session 12 — UI 全面升級 + 品牌化 UI Overhaul & Branding

**日期**：2026-02-25 白天 ｜ **5 commits**

從工具到產品的最後一哩路。

| Commit | Message | 變更 |
|--------|---------|------|
| `8ac041e` | style: UI 全面打磨 — 字型、色彩、圖標、陰影、間距升級 | 11 files, +483/-402 |
| `3b53de9` | fix: 修復技能匹配儲存不持久化 bug + 清除 lint 未使用變數 | 6 files, +34/-24 |
| `f54f6a5` | style: 「我的條件」頁改為左右分欄 + 左側 sticky 佈局 | 2 files, +169/-152 |
| `28a2961` | refactor: 移除優先順序，投遞狀態升級為卡片左側可點擊 badge | 2 files, +32/-34 |
| `a6f1a34` | refactor: 移除 priority 欄位、status 表格改唯讀、workload 提升至快速標註區 | 4 files, +80/-56 |

**設計思考**：

- **`8ac041e`** 是最大的視覺改造（11 檔案，483 行），引入了完整的設計系統：
  - Inter + Noto Sans TC 字型
  - Tailwind v4 @theme 設計 token（primary 靛藍 + surface 暖灰 + 三級陰影）
  - 毛玻璃效果 + 膠囊式導航
  - Lucide React 圖標全面取代 Emoji（20+ 個圖標）
- **`28a2961` + `a6f1a34`** 移除了 priority（優先順序）欄位。原因：priority 是主觀且常變動的數字，而投遞狀態（status）才是真正追蹤求職進度的客觀維度。用一個更有意義的欄位取代一個模糊的欄位。

---

### Session 13 — 最終精修 Final Polish

**日期**：2026-02-25 下午 ｜ **6 commits**

| Commit | Message | 變更 |
|--------|---------|------|
| `a8102e4` | refactor: 編輯模態改善 + 備註快速編輯 + 技能儲存修復 | 3 files, +82/-10 |
| `f21f23d` | style: 儲存成功/錯誤訊息統一顯示在標題下方、投遞狀態上方 | 1 file, +16/-13 |
| `83eb1a8` | fix: 修復技能匹配無法儲存 — 改用 Body() 明確標註 + 前端加強回饋 | 2 files, +33/-10 |
| `d56f7fb` | feat: 新增品牌 LOGO、favicon 與 Navbar 滑動切換動畫 | 3 files, +45/-15 |
| `f8eef33` | refactor: 技能匹配改為點擊即自動儲存，移除儲存按鈕 | 1 file, +29/-40 |
| `9364600` | fix: 技能匹配「已儲存」訊息移至底部，固定高度避免版面跳動 | 1 file, +13/-11 |

**設計思考**：

- **`d56f7fb`** 完成品牌化：靶心圖標 LogoIcon（indigo 圓角方塊 + 白色十字準星）、雙色品牌文字 Find(灰) + YourJob(indigo 粗體)、SVG inline favicon、Navbar framer-motion sliding pill 動畫。
- **`f8eef33`** 引入 optimistic UI 模式——技能分類從「修改→按儲存按鈕→等待回應」改為「點擊即儲存」。每次切換技能狀態立即呼叫 API，使用 optimistic UI + 失敗時 revert。移除了「儲存變更」按鈕，減少一次認知負擔。

---

## 三、設計哲學的演進 Design Philosophy Evolution

DESIGN.md 經歷三次擴充，每次都與當時正在開發的功能緊密對應：

### 第一次：核心三原則（`f80c56b`，+109 行）

**時機**：Session 1（2/17），在完成 LLM 解析和技能池之後

寫下三個核心設計決策：
1. **輕量本地 LLM 只做萃取，不做評價**——3B 模型做文字萃取，不需要 GPT-4 的推理能力
2. **評分基於相對排名，不基於絕對標準**——不告訴你「月薪 60K 在市場上算高」，而是告訴你「在你蒐集的 15 筆裡排第 3」
3. **技能池從職缺中生長，不是預設清單**——詞彙自動對齊、零維護成本、自然成長

### 第二次：結構化待遇（`b628de5`，+33 行）

**時機**：Session 3（2/22），在實作結構化福利欄位時

新增「結構化待遇資料」章節。記錄了為什麼要從 `benefits` 純文字拆成六大分類，以及設計原則不變的聲明：「結構化是為了讓使用者自己的資料更好比較，不是為了接外部市場數據。」

### 第三次：公司分離（`9176cb6`，+43 行）

**時機**：Session 5（2/23），在實作公司/職缺分離時

新增「公司與職缺分離」章節。記錄了為什麼要分離（消除冗餘）、架構圖、福利歸屬策略（公司為主 + 職缺可補充），並再次強調「設計原則不變」。

### 「資料閉環」哲學的具體體現

| 功能 | 閉環體現 |
|------|---------|
| Mismatch 警告 | 基於使用者設定的個人條件 vs 職缺萃取資料，不參考外部標準 |
| Skill Pool | 從使用者加入的職缺中自動聚合，不維護預設清單 |
| Supplement Flow | 使用者自行用外部 LLM 取得結構化 JSON，系統只做合併，不依賴雲端 API |
| 排序/篩選 | 在使用者自己的資料集內排序，不加入市場數據 |

---

## 四、架構演進 Architecture Evolution

### 資料庫 Schema 演進

| 階段 | Commit | 變更 | 說明 |
|------|--------|------|------|
| 1 | `b878f7a` | CREATE TABLE jobs | 初始 schema：title, company, salary, location, skills 等基本欄位 |
| 2 | `7bf1e14` | ALTER TABLE jobs + CREATE TABLE user_profile/user_skills | 新增 experience_years, education, remote_type, work_hours, benefits, mismatches |
| 3 | `b628de5` | ALTER TABLE jobs | 新增 salary_guaranteed_months, leave_policy, benefits_structured, language |
| 4 | `730726d` | ALTER TABLE jobs | 新增 field_metadata, edit_history |
| 5 | `9176cb6` | CREATE TABLE companies + ALTER TABLE jobs | 新增公司表；jobs 加 company_id FK |
| 6 | `bbfd6e3` | ALTER TABLE companies | 新增 interview_process, interview_questions, ai_notes, industry, company_size, culture |
| 7 | `7529a92` | ALTER TABLE jobs | 新增 city（自動從 location 回填）|
| 8 | `d4c306c` | ALTER TABLE jobs | 新增 description |
| 9 | `b849db8` | ALTER TABLE jobs | 新增 status DEFAULT 'not_applied' |
| 10 | `6cbb13f` | ALTER TABLE jobs | 新增 skill_match（持久化技能匹配結果）|

所有 migration 由 `init_db()` 在啟動時自動執行：

```python
# database.py — Auto-migration pattern
existing = {
    row[1] for row in conn.execute("PRAGMA table_info(jobs)").fetchall()
}
migrations = {
    "salary_guaranteed_months": "INTEGER",
    "leave_policy": "TEXT",
    "benefits_structured": "TEXT",
    "city": "TEXT",
    "description": "TEXT",
    "status": "TEXT DEFAULT 'not_applied'",
    "skill_match": "TEXT",
    # ... more columns
}
for col, col_type in migrations.items():
    if col not in existing:
        conn.execute(f"ALTER TABLE jobs ADD COLUMN {col} {col_type}")
```

### 前端元件誕生時間軸

| 元件 | 誕生 Commit | 建立日期 | 最終行數 |
|------|-------------|---------|---------|
| `App.jsx` | `b878f7a` | 2/17 | 237 |
| `JobInput.jsx` | `b878f7a` | 2/17 | 259 |
| `JobTable.jsx` | `b878f7a` | 2/17 | 955 |
| `ProfileSettings.jsx` | `7bf1e14` | 2/17 | 291 |
| `SkillPicker.jsx` | `8d2cc5c` | 2/17 | 198 |
| `JobEditModal.jsx` | `730726d` | 2/23 | 930 |
| `CompanyManager.jsx` | `9176cb6` | 2/23 | 1,179 |

### API 端點成長

| 階段 | 端點數 | 新增端點 |
|------|--------|---------|
| MVP (`b878f7a`) | 5 | POST parse, GET/PUT/DELETE jobs, GET job |
| Profile (`7bf1e14`) | 8 | GET/PUT profile, GET skills/pool, PUT skills |
| Dual-track (`7c5186d`) | 10 | POST import, GET prompt-template |
| Edit (`730726d`) | 12 | POST supplement/preview, POST supplement |
| Company (`9176cb6`) | 18 | GET/PUT/DELETE companies, GET company/jobs |
| Company AI (`bbfd6e3`) | 21 | POST company supplement/preview, GET company prompt |
| Filter (`7529a92`) | 22 | GET cities |
| Status (`1a759c8`) | 23 | GET status |

### LLM Prompt 系統演進

| 階段 | 模式 | Commit |
|------|------|--------|
| 1. Hardcoded | 55 行手寫 prompt 字串在 llm_parser.py 中 | `37193fc` |
| 2. Schema-driven | Pydantic `Field(description=...)` → 自動 prompt | `0a70617` |
| 3. 雙軌模式 | 同一 schema 產生本地 prompt + 使用者可複製 prompt | `7c5186d` |
| 4. 公司擴展 | CompanyExtraction schema 複用同一模式 | `bbfd6e3` |

Schema-driven prompt 的核心邏輯（`extraction_schema.py`）：

```python
def build_system_prompt() -> str:
    """Generate system prompt for local Ollama usage."""
    template_body = _build_template_body()
    return f"""你是一個職缺資訊整理助手。請將使用者提供的職缺文字逐欄位整理...
{{
{template_body}
}}
{_RULES}"""

def _build_template_body() -> str:
    """Generate the JSON template body from JobExtraction model fields."""
    lines = []
    for name, field_info in JobExtraction.model_fields.items():
        type_hint = _type_hint(field_info)
        desc = field_info.description or name
        lines.append(f'  "{name}": "({type_hint}) {desc}"')
    return ",\n".join(lines)
```

---

## 五、關鍵技術決策 Key Technical Decisions

### 1. Schema-Driven Prompt 生成

**問題**：LLM prompt 與資料模型容易脫節——新增欄位要改 prompt、改 model、改前端三個地方。

**方案**：建立 `extraction_schema.py`，用 Pydantic `Field(description=...)` 作為 prompt 內容的單一來源。

**Commit 證據**：`0a70617`（refactor: 用 Pydantic model 自動生成 LLM prompt 模板）

**效果**：llm_parser.py 從 183 行簡化到 90 行。新增欄位只需在 `JobExtraction` class 加一個 Field。

### 2. 三層公司名稱正規化

**問題**：LLM 萃取的公司名稱不一致（「台積電」vs「台灣積體電路製造股份有限公司」vs「TSMC」）。

**方案**：三層 pipeline，每層逐漸更「智慧」但也更慢：

```python
# company_normalizer.py — Pipeline architecture
def normalize(raw_name, conn) -> NormalizationResult:
    preprocessed = preprocess(raw_name)        # Layer 1: 字串前處理

    # Exact match on preprocessed names
    if preprocessed in canonical_map:
        return NormalizationResult(method="exact", confidence=1.0)

    # Layer 2: rapidfuzz fuzzy matching
    fuzzy_result = _fuzzy_match(preprocessed, canonical_map)
    if fuzzy_result:
        return NormalizationResult(method="fuzzy", confidence=score)

    # Layer 3: Embedding-based semantic matching
    embed_result = _embedding_match(preprocessed, canonical_map)
    if embed_result:
        return NormalizationResult(method="embedding", confidence=score)

    # No match → new company
    return NormalizationResult(method="new", confidence=0.0)
```

**Commit 證據**：`06cc9be`（feat: 公司名稱正規化模組）

**設計細節**：Layer 2 和 Layer 3 都是 optional 依賴。沒裝 rapidfuzz 就跳過 fuzzy；沒裝 sentence-transformers 就跳過 embedding。系統永遠可運行。

### 3. 非破壞性合併 + 欄位溯源

**問題**：使用者可能多次從不同來源補充同一職缺的資料，需要追蹤每個欄位的來源和修改歷史。

**方案**：`field_metadata` 追蹤每個欄位的 source 和 updated_at；`edit_history` 記錄每次變更的完整操作記錄。補充操作（supplement）採用非破壞性合併——只填空欄位，衝突交由使用者選擇。

**Commit 證據**：`730726d` + `7c2d1d3`

### 4. 雙軌 LLM 輸入

**問題**：不是每個人都能在自己的電腦上跑 Ollama。

**方案**：系統產生 prompt 模板，使用者可以複製到任何線上 LLM（ChatGPT/Gemini/Claude），取得 JSON 後貼回系統匯入。同一個 schema 同時服務本地模型和線上模型。

**Commit 證據**：`7c5186d`（feat: 雙軌輸入模式）

### 5. 自動資料庫遷移

**問題**：SQLite 不支援 IF NOT EXISTS 的 ALTER TABLE。隨著欄位持續增加，如何確保舊版資料庫能無痛升級？

**方案**：`init_db()` 啟動時用 `PRAGMA table_info()` 檢查現有欄位，缺少的自動 `ALTER TABLE ADD COLUMN`。

**Commit 證據**：`b628de5` 開始，持續到 `6cbb13f`

### 6. Fallback-First 架構

**問題**：系統依賴本地 LLM（Ollama），但使用者可能沒安裝或服務未啟動。

**方案**：三層 fallback：Ollama LLM → regex parser → 手動輸入。每一層都能獨立運作。

**Commit 證據**：`37193fc`（feat: add Ollama LLM parser with Qwen2.5-3B support）

---

## 六、設計取捨與迭代 Design Trade-offs & Iterations

以真實 commit 為證據的迭代故事。

### Priority 的移除

**涉及 commits**：`28a2961` + `a6f1a34`

**過程**：
1. 初始設計中 priority 是 1-5 的數字，顯示為彩色圓圈 badge
2. `28a2961`：移除 priority badge，投遞狀態升級為卡片左側可點擊 badge
3. `a6f1a34`：全面移除 priority 欄位（後端 models/main.py、前端 JobTable.jsx），status 表格改唯讀

**原因**：Priority 是主觀且常變動的數字。使用者每次看到職缺都想調整優先順序，反而增加認知負擔。投遞狀態（status）才是客觀的進度指標——你要嘛投了，要嘛沒投，不存在「模糊地帶」。用一個有明確語義的欄位取代一個模糊的評分。

### 硬性條件重構

**涉及 commit**：`0c3a5c9`

**變更**：
- ❌ 移除：薪資下限、偏好地點（作為硬性條件）
- ✅ 新增：工作類型（正職/兼職/約聘/實習）、遠端類型（到班/混合/遠端）

**原因**：
- 薪資和地點的資料品質不穩定（面議、地址格式不一致），且本質上是「偏好」而非「門檻」
- 工作類型和遠端類型是非黑即白的分類，LLM 萃取準確率高，且真的是許多使用者的硬性需求

### 關閉按鈕的 4 次迭代

**涉及 commits**：`87aac2d` → `928d956` → `45a8cae` → `1f05d8a`/`1021815`

| 迭代 | 位置 | 問題 |
|------|------|------|
| 1 (`87aac2d`) | 手動填寫 tab 內 | 其他 tab 沒有關閉按鈕 |
| 2 (`928d956`) | modal 底部固定 footer | 太遠，且增加 footer 高度 |
| 3 (`45a8cae`) | 移除 | header 的 X 已足夠...嗎？ |
| 4 (`1f05d8a`+`1021815`) | 儲存按鈕旁 + 自動捲回頂端 | 最終方案 |

**啟示**：好的 UX 不是一次設計出來的。每個位置都有合理的論點，但只有「用過才知道」。最終的方案（儲存後自動捲回頂端，讓使用者看到成功訊息後直接用 header X 關閉）結合了自動行為和現有控件，是最簡潔的方案。

### 技能匹配的 3 次 Bug 修復 + UX 重設計

**涉及 commits**：`3b53de9` → `83eb1a8` → `f8eef33`

| 迭代 | 問題 | 修復 |
|------|------|------|
| `3b53de9` | 技能儲存與重算在同一 transaction，Pydantic 驗證失敗導致回滾 | 分離為兩個獨立 transaction |
| `83eb1a8` | FastAPI async + sqlite3 事件迴圈衝突 | 改回同步 def + Body() 明確標註 |
| `f8eef33` | 使用者要先修改再按「儲存變更」按鈕 | 改為 optimistic UI，點擊即儲存 |

**啟示**：第三次不是 bug 修復，而是 UX 重設計。前兩次的 bug 暴露了「修改→按按鈕→儲存」這個流程本身的脆弱性。改為 optimistic UI 後，每次點擊立即呼叫 API，失敗時 revert，使用者感知不到「儲存」這個動作。

---

## 七、品牌與視覺設計 Branding & Visual Design

### UI 全面升級（`8ac041e`）

**規模**：11 個檔案，+483/-402 行

**設計 Token 系統**（Tailwind v4 @theme）：

| Token | 用途 | 值 |
|-------|------|-----|
| `--color-primary-*` | 主色調 | 靛藍色系（Indigo） |
| `--color-surface-*` | 背景/卡片 | 暖灰色系 |
| `--shadow-card` | 卡片陰影 | 輕陰影 |
| `--shadow-card-hover` | 卡片 hover | 中等陰影 + 微浮起 |
| `--shadow-modal` | Modal 陰影 | 深陰影 |

**圖標遷移**：
- ❌ Before：Emoji 圖標（⏱ $ ★ ⚡ 🗑 ✏️）
- ✅ After：Lucide React（Clock, DollarSign, Star, Zap, Trash2, Pencil 等 20+ 個）

**視覺效果**：
- Header：毛玻璃效果（`backdrop-blur-sm`）
- 卡片：三級陰影 + hover 微浮起動畫
- Modal：毛玻璃背景
- 全局間距加大提升呼吸感

### 品牌 LOGO（`d56f7fb`）

- **LogoIcon**：Indigo 圓角方塊 + 白色十字準星（靶心意象）
- **品牌文字**：Find（灰色）+ YourJob（Indigo 粗體）
- **Favicon**：SVG inline（data URI，無外部圖檔依賴）
- **Navbar 動畫**：Framer Motion sliding pill（`layoutId` 模式），切換 tab 時白色背景平滑滑動

---

## 八、技術統計 Technical Statistics

### Commit 類型分布

| 類型 | 數量 | 佔比 |
|------|------|------|
| feat | 17 | 33% |
| fix | 14 | 27% |
| refactor | 12 | 23% |
| style | 4 | 8% |
| docs | 3 | 6% |
| revert | 1 | 2% |
| chore | 1 | 2% |

### 程式碼規模

#### Backend（Python）

| 檔案 | 行數 | 職責 |
|------|------|------|
| main.py | 1,277 | 所有 API 端點 + 業務邏輯 |
| mock_parser.py | 468 | Regex fallback 解析器 |
| extraction_schema.py | 423 | Schema-driven prompt 生成 |
| company_normalizer.py | 367 | 三層公司名稱正規化 |
| database.py | 251 | SQLite 連線 + schema + 遷移 |
| models.py | 143 | Pydantic 資料模型 |
| llm_parser.py | 97 | Ollama LLM 呼叫 |
| **小計** | **3,026** | |

#### Frontend（React/JSX）

| 檔案 | 行數 | 職責 |
|------|------|------|
| CompanyManager.jsx | 1,179 | 公司 CRUD + 補充 |
| JobTable.jsx | 955 | 職缺列表（排序/篩選/展開） |
| JobEditModal.jsx | 930 | 職缺編輯（手動/補充/歷史） |
| ProfileSettings.jsx | 291 | 使用者條件設定 |
| JobInput.jsx | 259 | 雙軌輸入介面 |
| App.jsx | 237 | 主應用 + Tab 導航 |
| api.js | 212 | API 客戶端 |
| SkillPicker.jsx | 198 | 技能分類（三區塊 + 動畫） |
| **小計** | **4,261** | |

**總計**：~7,287 行

### 依賴清單

#### Backend（requirements.txt）

| 套件 | 版本 | 用途 |
|------|------|------|
| fastapi | 0.115.0 | Web 框架 |
| uvicorn | 0.30.6 | ASGI 伺服器 |
| pydantic | 2.9.2 | 資料驗證 |
| httpx | 0.28.1 | Ollama HTTP 通信 |
| rapidfuzz | >= 3.0.0 | 模糊比對 |
| sentence-transformers | >= 2.2.0 | 嵌入搜尋（optional） |

#### Frontend（package.json）

| 套件 | 版本 | 用途 |
|------|------|------|
| react | ^19.2.0 | UI 框架 |
| react-dom | ^19.2.0 | DOM 渲染 |
| framer-motion | ^12.34.3 | 動畫 |
| lucide-react | ^0.575.0 | 圖標 |
| tailwindcss | ^4.1.18 | CSS 框架 |
| vite | ^7.3.1 | 打包工具 |
| eslint | ^9.39.1 | 程式碼檢查 |

### 開發節奏

| 日期 | Session | Commits | 重點 |
|------|---------|---------|------|
| 2/17 | 1 | 6 | MVP 全端骨架 |
| 2/19 | 2 | 1 | 系統強化 |
| 2/22 | 3 | 6 | 結構化資料 + 雙軌輸入 |
| 2/23 凌晨 | 4 | 2 | 編輯與補充系統 |
| 2/23 早上 | 5 | 4 | 公司資料獨立化 |
| 2/23 白天 | 6 | 6 | 功能密集迭代 |
| 2/23 下午 | 7 | 6 | 篩選與 UX 迭代 |
| 2/23 傍晚 | 8 | 1 | 視覺統一 |
| 2/23 晚上 | 9 | 2 | Modal UX + 技能動畫 |
| 2/23~24 | 10 | 3 | CLAUDE.md + Bug 修復 |
| 2/25 早上 | 11 | 3 | 公司管理重構 |
| 2/25 白天 | 12 | 5 | UI 全面升級 + 品牌化 |
| 2/25 下午 | 13 | 6 | 最終精修 |

---

## 參考檔案 Reference Files

| 檔案 | 用途 |
|------|------|
| `DESIGN.md` | 設計哲學（三次擴充） |
| `CLAUDE.md` | 開發指南 |
| `backend/extraction_schema.py` | Schema-driven prompt |
| `backend/database.py` | Auto-migration |
| `backend/company_normalizer.py` | 三層 pipeline |
| `backend/main.py` | 核心業務邏輯 |

---

> 本文件基於 git 真實 commit 紀錄撰寫。所有 commit hash、日期、變更統計皆可透過 `git log` 驗證。
