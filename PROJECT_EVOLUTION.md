Context 背景
FindYourJob 專案已趨成熟，即將發布。需要一份詳盡的專案演變歷程文件，記錄從第一行程式碼到最終產品的完整發展過程。此文件將作為後續包裝、行銷、推廣的核心素材，同時也是開發者對外展示專案深度的重要參考。
觸發原因：用戶明確要求「詳細記錄這份專案全部的演變歷程（透過詳讀 Commits 紀錄）」
預期產出：一份基於真實 commit 紀錄的、中英雙語的、包含關鍵程式碼片段的完整演變歷程文件。

計劃：建立 /home/user/FindYourJob/PROJECT_EVOLUTION.md
文件語言策略

章節標題：中英並列（如「## 第一階段：MVP 奠基 Phase 1: MVP Foundation」）
正文：以繁體中文為主
技術術語保留英文（如 schema-driven、fallback、mismatch、optimistic UI）
commit 訊息保留原文（早期英文、後期中文）
程式碼片段及欄位名稱維持英文

文件結構（8 大章節）

一、專案總覽 Project Overview

一句話定位：本地優先的求職資訊整理工具
核心數據表格：開發天數(9)、commits(74)、PRs(23)、程式碼(~7,500 行)、淨增量(+13,986/-2,265)
核心哲學引用 DESIGN.md：「資料閉環，不依賴外部知識」
技術棧速覽表

二、開發時間軸 Development Timeline
這是全文核心，按 13 個開發 session 組織，每個 session 包含：

日期、session 編號
該 session 的設計目標/意圖概述
每個 commit：hash + 完整 commit message + 變更範圍（files changed / insertions / deletions）
設計思考：為什麼要做這個改動、解決了什麼問題、背後的 DESIGN.md 哲學連結

13 個 Sessions：

Session 1 — MVP 奠基（2/17，6 commits）

b878f7a: 初始專案建立
ad3e069: Vite 靜態資源
37193fc: Ollama LLM 整合 + fallback
7bf1e14: 用戶檔案 + mismatch 偵測
f80c56b: DESIGN.md 設計哲學文件
8d2cc5c: 技能池 tri-state 匹配
設計思考：第一天就確立 fallback-first 架構和「資料閉環」哲學


Session 2 — 系統強化（2/19，1 commit）

1a759c8: 薪資正規化、地點比對、結構化 mismatch
設計思考：從字串比對進化到結構化比對


Session 3 — 結構化資料 + 雙軌輸入（2/22，6 commits）

b628de5 ~ 8f1e15c: 結構化福利/薪資、schema-driven prompt、雙軌輸入模式、輸入流程重構、繁中要求
設計思考：schema-driven 架構誕生；「任何 LLM 都能用」大幅降低門檻
DESIGN.md 第二次擴充：新增「結構化待遇資料」章節


Session 4 — 編輯與補充系統（2/23 凌晨，2 commits）

730726d + 7c2d1d3: 編輯模式、field_metadata、edit_history、衝突處理
設計思考：「非破壞性合併」+ 「欄位溯源」模式確立


Session 5 — 公司資料獨立化（2/23 早上，4 commits）

9176cb6: 公司/職缺分離
06cc9be: 三層名稱正規化 pipeline
bbfd6e3: 公司 AI 整理
1b1a3be: 公司編輯模式
設計思考：從「一張表」到「關聯式架構」；DESIGN.md 第三次擴充
DESIGN.md 第三次擴充：新增「公司與職缺分離」章節


Session 6 — 功能密集迭代（2/23 白天，6 commits）

96697b9 ~ d26656e: 路由修復、人性化顯示、description 欄位、排序精簡、投遞狀態、福利分類
設計思考：從「能解析」到「能追蹤」——投遞狀態標記求職進度


Session 7 — 篩選與 UX 迭代（2/23 下午，6 commits）

7529a92 ~ 312e20e: 縣市篩選、關閉按鈕 4 次迭代、編輯紀錄位置調整
設計思考：關閉按鈕的 4 次迭代是 UX 打磨的縮影


Session 8 — 視覺統一（2/23 傍晚，1 commit）

e094e6c: 來源標籤統一淺灰色


Session 9 — Modal UX + 技能動畫（2/23 晚上，2 commits）

1021815: 儲存後自動捲回頂端
0c3a5c9: 技能三區塊動畫 + 硬性條件重構
設計思考：移除薪資/地點作為硬性條件（資料品質不穩定）


Session 10 — CLAUDE.md + Bug 修復（2/23-24，3 commits）

484b4fc: CLAUDE.md
989bcf0 + 6cbb13f: 條件儲存後重算、技能匹配持久化修復


Session 11 — 公司管理重構（2/25 早上，3 commits）

52db0f8 ~ ef2aec0: 按鈕重構、驗證修復、投遞狀態提升


Session 12 — UI 全面升級 + 品牌化（2/25 白天，5 commits）

8ac041e: UI 全面打磨（字型/色彩/圖標/陰影/間距）
3b53de9 ~ a6f1a34: bug 修復、分欄佈局、priority 移除
設計思考：從工具到產品的最後一哩路


Session 13 — 最終精修（2/25 下午，6 commits）

a8102e4 ~ 9364600: 備註快速編輯、訊息位置、技能儲存修復、品牌 LOGO、click-to-save、版面穩定
設計思考：optimistic UI 模式——「點擊即儲存」取代「修改→按鈕→儲存」



三、設計哲學的演進 Design Philosophy Evolution

DESIGN.md 三次擴充的具體 diff 內容：

f80c56b（109 行）：核心三原則
b628de5（+33 行）：結構化待遇
9176cb6（+43 行）：公司分離


每次擴充與當時正在開發的功能的對應關係
「資料閉環」哲學如何在 mismatch、skill pool、supplement flow 中具體體現

四、架構演進 Architecture Evolution

資料庫 schema 演進（10 個階段）：表格形式呈現每次 ALTER TABLE / 新表
前端元件誕生時間軸（6 個元件）：何時建立、初始行數 vs 最終行數
API 端點成長：從最初 5 個到最終 20+ 個
LLM Prompt 系統演進：hardcoded prompt → schema-driven → 雙軌模式
包含關鍵程式碼片段：

extraction_schema.py 的 build_system_prompt() 模式
database.py 的 auto-migration 模式
company_normalizer.py 的三層 pipeline 架構



五、關鍵技術決策 Key Technical Decisions
每個決策包含：問題 → 方案 → commit 證據 → 程式碼片段

Schema-Driven Prompt 生成：Pydantic model → 自動 prompt
三層公司名稱正規化：前處理 / rapidfuzz / embedding
非破壞性合併 + 欄位溯源：field_metadata + edit_history
雙軌 LLM 輸入：任何 LLM 都能用
自動資料庫遷移：init_db() 啟動時自動 ALTER TABLE
Fallback-First 架構：Ollama → regex → 手動

六、設計取捨與迭代 Design Trade-offs & Iterations
以真實 commit 為證據的迭代故事：

Priority 的移除（2 commits：28a2961 + a6f1a34）

原因：主觀且常變動 → 被客觀的投遞狀態取代


硬性條件重構（1 commit：0c3a5c9）

移除薪資/地點 → 新增工作類型/遠端類型
原因：「資料品質不穩定且本質為偏好」


關閉按鈕的 4 次迭代（87aac2d → 928d956 → 45a8cae → 1f05d8a/1021815）

展示 UX 打磨的完整思路


技能匹配的 3 次 bug 修復 + UX 重設計

持久化 bug → 參數解析 bug → 最終改為 click-to-save



七、品牌與視覺設計 Branding & Visual Design

8ac041e 的完整變更範圍（11 個檔案，483 行）
設計 token 系統（primary/surface/shadow）
Lucide 圖標取代 emoji
毛玻璃效果 + 三級陰影
d56f7fb 品牌 LOGO 設計（靶心圖標 + 雙色品牌文字）

八、技術統計 Technical Statistics

Commit 類型分布圖（feat/fix/refactor/style/docs）
程式碼規模表（每個檔案行數）
依賴清單（backend/frontend）
PR 合併時間分布


關鍵參考檔案

/home/user/FindYourJob/DESIGN.md — 設計哲學（已讀取）
/home/user/FindYourJob/CLAUDE.md — 開發指南（已讀取）
/home/user/FindYourJob/backend/extraction_schema.py — schema-driven prompt 的程式碼片段
/home/user/FindYourJob/backend/database.py — auto-migration 的程式碼片段
/home/user/FindYourJob/backend/company_normalizer.py — 三層 pipeline 的程式碼片段
/home/user/FindYourJob/backend/main.py — calc_skill_match、check_mismatches 等核心邏輯
Git history（全部 74 commits 已完整讀取含完整 body 訊息）

程式碼片段策略
在以下位置嵌入精簡程式碼片段：

Schema-driven prompt：build_system_prompt() 核心邏輯（~15 行）
Auto-migration：init_db() 的 ALTER TABLE 迴圈（~10 行）
三層正規化：pipeline 架構示意（~20 行）
技能匹配計算：calc_skill_match() 核心（~15 行）
非破壞性合併：field_metadata + edit_history JSON 結構範例
Mismatch 檢查：check_mismatches() 核心邏輯（~10 行）

執行步驟

讀取 extraction_schema.py、database.py、company_normalizer.py、main.py 中的關鍵函數片段
撰寫 PROJECT_EVOLUTION.md 完整內容（預估 800-1200 行）
Git commit + push

驗證方式

確認所有 commit hash 與真實紀錄一致
確認所有日期與 git log 吻合
確認程式碼片段與當前原始碼一致
確認 DESIGN.md 的三次擴充內容正確對應
確認文件可在 GitHub 上正確 render markdown
