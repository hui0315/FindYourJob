<p align="center">
  <img src="assets/logo-wordmark.svg" alt="FindYourJob" height="48" />
</p>

<p align="center">
  找工作時，職缺散落 104、LinkedIn、朋友傳的訊息⋯ 很難比較對吧？<br/>
  <b>把職缺貼進來，AI 自動整理，讓你一目瞭然地比較所有機會。</b><br/>
  <i>Paste job postings, AI extracts the details, compare everything in one place. Your data never leaves your computer.</i>
</p>

---

<h3 align="center">2 分鐘看懂 FindYourJob</h3>

<p align="center">
  <a href="https://youtu.be/qFIO9MMUgts?si=66nz7nAaXR9rqmDG">
    <img src="https://img.youtube.com/vi/qFIO9MMUgts/maxresdefault.jpg" alt="FindYourJob 操作介紹影片" width="80%" />
  </a>
  <br/>
  <sub>▲ 點擊圖片觀看完整操作介紹</sub>
</p>

---

## 怎麼用？

### 三步驟，開始整理你的職缺

1. **複製** — 從 104、1111、LinkedIn 或任何地方，複製一段職缺文字
2. **貼上** — 貼進 FindYourJob，AI 自動萃取薪資、技能、福利等 20+ 個欄位
3. **比較** — 所有職缺排在同一張表，排序、篩選、追蹤投遞進度

> **沒有 AI 環境也能用！**
> 不想安裝本地 AI？沒關係——系統提供現成的模板，複製貼到 ChatGPT / Gemini / Claude，再把結果貼回來就好。任何 AI 都能用。

---

## 適合誰？

- 同時在比較好幾份職缺，需要一個地方統一整理
- 覺得用 Excel 整理職缺很煩，但又不想花錢用付費工具
- 重視隱私——不想把履歷和求職資料上傳到任何雲端平台
- **你不需要會寫程式**，只要能照著步驟複製貼上指令就好

*No coding skills needed. If you can copy-paste commands, you can use FindYourJob.*

---

## 安裝與啟動 Getting Started

> **需要先安裝**：[Python 3.10+](https://www.python.org/downloads/) 和 [Node.js 18+](https://nodejs.org/)
> 不確定有沒有？在終端機輸入 `python3 --version` 和 `node --version` 看看。

```bash
# 1. 下載專案
git clone https://github.com/hui0315/FindYourJob.git
cd FindYourJob

# 2. 啟動後端（安裝 + 執行）
pip install -r backend/requirements.txt
cd backend && uvicorn main:app --reload --host 0.0.0.0 --port 8000

# 3. 開另一個終端視窗，啟動前端
cd frontend && npm install && npm run dev
```

打開瀏覽器，輸入 http://localhost:5173 ，開始整理你的職缺！

<details>
<summary><b>想要更好的解析效果？安裝本地 AI（選用）</b></summary>

沒有安裝本地 AI，系統仍然可以用——你可以透過 ChatGPT / Gemini 來解析職缺。
安裝後可以讓系統自動解析，不需要手動複製貼上。

```bash
# 安裝 Ollama（https://ollama.ai/）後：
ollama pull qwen2.5:3b
ollama run qwen2.5:3b
```

重新整理 FindYourJob 頁面，系統會自動偵測到本地 AI。

</details>

---

## 功能亮點 Features

| 功能 | 說明 |
|------|------|
| **AI 自動整理** | 貼上原始文字，自動抓出薪資、地點、技能、福利等資訊 |
| **任何 AI 都能用** | 沒有本地 AI？複製模板到 ChatGPT / Gemini，貼回結果即可 |
| **薪資排序比較** | 在你蒐集的職缺中排名，一眼看出哪個薪資最高 |
| **技能匹配** | 標記「已會 / 可以學 / 不會」，每個職缺算出匹配分數 |
| **投遞狀態追蹤** | 未投遞 → 已投遞 → 面試中 → Offer → 未錄取，一鍵切換 |
| **公司資料管理** | 同公司多個職缺自動歸類，福利、聯絡人、面試筆記集中管理 |
| **條件檢查** | 設定你的條件（年資、學歷等），自動提醒不符合的職缺——但不會幫你隱藏 |
| **完全離線** | 所有資料存在你的電腦，不上傳雲端，不需要帳號 |

---

## 設計理念 Design Philosophy

> **不做全知系統，做最好的整理工具。所有判斷都從你自己的資料中來，不假裝知道我們不知道的事。**

- **AI 只做整理，不做評價** — 不會告訴你「這份工作好不好」，只幫你把散亂的資訊整理乾淨，決定權永遠是你的
- **相對比較，不用絕對標準** — 不知道「月薪 60K 在市場上算高嗎」，但知道「在你蒐集的 15 筆裡排第 3」
- **你的資料，你決定** — 不符合條件的職缺會提醒，但永遠不會自動隱藏或排除

完整設計文件：[DESIGN.md](DESIGN.md)

---

<p align="center"><i>以下內容為開發者參考資訊，一般使用者可以忽略。</i><br/><i>The sections below are for developers and contributors.</i></p>

---

<details>
<summary><h2>完整功能說明 Detailed Features</h2></summary>

### 核心功能 Core Features

| | 功能 | 說明 |
|---|---|---|
| **AI 文字萃取** | AI Text Extraction | 貼上職缺原文，本地 LLM（Ollama + Qwen2.5-3B）自動萃取 20+ 結構化欄位 |
| **雙軌輸入** | Dual-Track Input | 不能跑 Ollama？複製 prompt 給 ChatGPT / Gemini / Claude，貼回 JSON 即可——任何 LLM 都能用 |
| **結構化比較** | Structured Comparison | 可排序表格：薪資、技能匹配度、投遞狀態、城市篩選，在你自己的資料集內相對排名 |
| **技能匹配** | Skill Matching | 技能自動從職缺聚合，分三級（已會 / 可補強 / 未分類），計算每筆職缺的匹配分數 |
| **公司管理** | Company Management | 共享福利 / 聯絡人 / 面試筆記，三層公司名稱正規化（字串前處理→模糊比對→語意搜尋） |
| **條件比對** | Mismatch Detection | 設定個人條件後自動比對，警告但不隱藏——使用者永遠自己決定 |
| **欄位溯源** | Field Provenance | 每個欄位追蹤來源（LLM / 匯入 / 手動）與完整編輯歷史，非破壞性資料補充 |
| **完全離線** | Fully Offline | SQLite 單檔、無雲端 API、無帳號、資料不離開你的電腦 |

### 關鍵技術決策

| 決策 | 做法 | 為什麼 |
|------|------|--------|
| **Schema-Driven Prompts** | Pydantic `Field(description=...)` 自動生成 LLM prompt | 新增欄位改一處，prompt 自動更新。`llm_parser.py` 從 183 行簡化到 90 行 |
| **三層公司正規化** | 字串前處理 → rapidfuzz 模糊比對 → embedding 語意搜尋 | 每層都是可選的。沒裝 rapidfuzz？跳過。沒裝 sentence-transformers？跳過。系統永遠可運行 |
| **欄位溯源** | 每個欄位追蹤 `source`（llm/import/user）和 `updated_at` | 非破壞性補充：填空不覆蓋，衝突交由使用者選擇 |
| **Fallback-First** | Ollama → regex parser → 手動輸入 | 系統不依賴任何單一元件，永不中斷 |
| **結構化福利** | 6 大類對齊 104/1111 人力銀行格式 | 讓福利可跨職缺比較，而非自由文字 |
| **自動遷移** | `init_db()` 啟動時檢查 `PRAGMA table_info()` 並新增缺少欄位 | 零停機 schema 演進，舊版資料庫自動升級 |

</details>

<details>
<summary><h2>技術細節 Technical Details</h2></summary>

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.10+-3776AB?logo=python&logoColor=white" alt="Python" />
  <img src="https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white" alt="FastAPI" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/SQLite-WAL-003B57?logo=sqlite&logoColor=white" alt="SQLite" />
  <img src="https://img.shields.io/badge/Ollama-Qwen2.5--3B-000000?logo=ollama&logoColor=white" alt="Ollama" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white" alt="Vite" />
</p>

### 系統架構

```mermaid
flowchart TD
    A["使用者貼上職缺文字"] --> B["Frontend<br/>React 19 + Vite + Tailwind CSS"]
    B -->|"POST /api/jobs/parse"| C["Backend<br/>FastAPI"]
    B -->|"POST /api/jobs/import"| C
    C --> D{"Ollama 可用？"}
    D -->|"是"| E["Ollama LLM<br/>Qwen2.5-3B"]
    D -->|"否"| F["Regex Parser<br/>Fallback"]
    E --> G["結構化 JSON"]
    F --> G
    G --> H["SQLite<br/>WAL Mode"]
    H --> I["companies"]
    H --> J["jobs"]
    H --> K["user_profile<br/>user_skills"]
    J -.->|"FK"| I
```

### 技術棧 Tech Stack

#### Backend

| 技術 | 版本 | 用途 |
|------|------|------|
| Python 3 | 3.10+ | 語言 |
| FastAPI | 0.115.0 | API 框架 |
| SQLite | WAL mode | 單檔案資料庫，零配置 |
| Pydantic | 2.9.2 | 資料驗證 + prompt 生成 |
| Ollama + Qwen2.5-3B | — | 本地 LLM（選用） |
| rapidfuzz | >= 3.0 | 模糊比對（選用） |
| sentence-transformers | >= 2.2 | 嵌入語意搜尋（選用） |

#### Frontend

| 技術 | 版本 | 用途 |
|------|------|------|
| React | 19.2.0 | UI 框架 |
| Vite | 7.3.1 | 打包工具 + 開發伺服器 |
| Tailwind CSS | 4.1.18 | 設計 token 樣式系統 |
| Framer Motion | 12.34.3 | 佈局動畫 |
| Lucide React | 0.575.0 | 圖標系統 |

### 程式碼亮點：Schema 驅動的 Prompt 生成

```python
# backend/extraction_schema.py — Pydantic model 即 prompt 的單一來源

class JobExtraction(BaseModel):
    """每個 Field(description=...) 同時是資料驗證規則和 LLM prompt 指令。"""
    title: str = Field(description="職位名稱（必填）")
    salary_min: Optional[int] = Field(None, description="最低薪資數字（50K→50000）")
    skills: Optional[str] = Field(None, description="技能需求，逗號分隔")
    # ... 20+ fields, 新增欄位只需加一行

def _build_template_body() -> str:
    """從 model fields 自動生成 JSON template。"""
    lines = []
    for name, field_info in JobExtraction.model_fields.items():
        type_hint = _type_hint(field_info)
        desc = field_info.description or name
        lines.append(f'  "{name}": "({type_hint}) {desc}"')
    return ",\n".join(lines)

def build_system_prompt() -> str:
    """一行呼叫，產生完整的 LLM system prompt。"""
    template_body = _build_template_body()
    return f"""你是一個職缺資訊整理助手...
{{
{template_body}
}}
{_RULES}"""
```

### 環境變數

| 變數 | 預設值 | 說明 |
|------|--------|------|
| `CORS_ORIGINS` | `http://localhost:5173,http://localhost:3000` | 允許的 CORS 來源 |
| `OLLAMA_BASE` | `http://localhost:11434` | Ollama 伺服器位址 |
| `OLLAMA_MODEL` | `qwen2.5:3b` | 使用的 Ollama 模型 |

### 專案結構 Project Structure

```
FindYourJob/
├── CLAUDE.md                       # AI 開發指南
├── DESIGN.md                       # 設計哲學文件
├── PROJECT_EVOLUTION.md            # 完整開發歷程
├── backend/
│   ├── main.py                     # FastAPI 所有端點 + 業務邏輯（1,277 行）
│   ├── models.py                   # Pydantic 資料模型
│   ├── database.py                 # SQLite 連線 + schema + 自動遷移
│   ├── llm_parser.py               # Ollama LLM 呼叫
│   ├── mock_parser.py              # Regex fallback 解析器
│   ├── extraction_schema.py        # Schema-driven prompt 生成
│   ├── company_normalizer.py       # 三層公司名稱正規化
│   ├── test_company_normalizer.py  # pytest 單元測試
│   └── requirements.txt
└── frontend/
    ├── package.json
    ├── vite.config.js              # Vite + Tailwind + API proxy
    ├── index.html
    └── src/
        ├── App.jsx                 # 主應用 + Tab 導航 + Logo
        ├── api.js                  # 集中式 API 客戶端
        ├── main.jsx
        ├── index.css               # Tailwind 設計 token
        └── components/
            ├── JobInput.jsx        # 雙軌輸入介面
            ├── JobTable.jsx        # 職缺列表（排序/篩選/展開）
            ├── JobEditModal.jsx    # 編輯 + 補充 Modal
            ├── ProfileSettings.jsx # 使用者條件設定
            ├── SkillPicker.jsx     # 技能三區塊分類 + 動畫
            └── CompanyManager.jsx  # 公司 CRUD + AI 整理
```

</details>

<details>
<summary><h2>API 總覽 API Overview</h2></summary>

### Jobs（職缺）

| 方法 | 路徑 | 說明 |
|------|------|------|
| `POST` | `/api/jobs/parse` | 透過 LLM/regex 解析原始文字 |
| `POST` | `/api/jobs/import` | 匯入預先結構化的 JSON |
| `GET` | `/api/jobs` | 列出所有職缺（支援排序、城市篩選） |
| `GET` | `/api/jobs/{id}` | 取得單筆職缺（含公司資料） |
| `PUT` | `/api/jobs/{id}` | 更新職缺 |
| `DELETE` | `/api/jobs/{id}` | 刪除單筆職缺 |
| `DELETE` | `/api/jobs` | 刪除所有職缺 |
| `POST` | `/api/jobs/{id}/supplement/preview` | 預覽資料合併 |
| `POST` | `/api/jobs/{id}/supplement` | 執行資料合併 |

### Companies（公司）

| 方法 | 路徑 | 說明 |
|------|------|------|
| `GET` | `/api/companies` | 列出所有公司（含職缺數量） |
| `GET` | `/api/companies/{id}` | 取得公司詳情 |
| `PUT` | `/api/companies/{id}` | 更新公司資料 |
| `DELETE` | `/api/companies/{id}` | 刪除公司（解除職缺關聯） |
| `GET` | `/api/companies/{id}/jobs` | 列出公司的所有職缺 |
| `POST` | `/api/companies/{id}/supplement/preview` | 預覽資料合併 |
| `POST` | `/api/companies/{id}/supplement` | 執行資料合併 |
| `POST` | `/api/companies/normalize` | 預覽公司名稱正規化 |

### Profile & Skills（使用者設定）

| 方法 | 路徑 | 說明 |
|------|------|------|
| `GET` | `/api/profile` | 取得使用者條件 |
| `PUT` | `/api/profile` | 更新使用者條件 |
| `GET` | `/api/skills/pool` | 取得技能池（從所有職缺聚合） |
| `PUT` | `/api/skills` | 批次更新技能分類 |

### Utility（工具）

| 方法 | 路徑 | 說明 |
|------|------|------|
| `GET` | `/api/status` | 檢查 Ollama 可用性 |
| `GET` | `/api/prompt-template` | 取得職缺萃取 prompt（供使用者複製到線上 LLM） |
| `GET` | `/api/companies/prompt-template` | 取得公司萃取 prompt |
| `GET` | `/api/cities` | 取得所有城市（用於篩選） |

</details>

<details>
<summary><h2>開發歷程 Development Journey</h2></summary>

FindYourJob 在 **9 天**內完成開發（2026/02/17 — 2026/02/25），經歷從 MVP 到系統強化、資料模型演進、UX 打磨、品牌化的完整產品開發週期。

| 指標 | 數值 |
|------|------|
| 開發天數 | 9 天 |
| 非合併 commits | 53 |
| Pull Requests | 22 |
| 程式碼行數 | ~7,300 行 |
| 淨增量 | +14,218 / -2,265 |

### 開發階段

| 階段 | 日期 | 重點 |
|------|------|------|
| MVP 奠基 | 2/17 | 全端骨架、LLM 解析、技能匹配、DESIGN.md |
| 結構化資料 | 2/22 | Schema-driven prompts、雙軌 LLM 輸入、結構化福利 |
| 資料模型演進 | 2/23 | 公司分離、三層正規化、編輯/補充系統 |
| UX 打磨 | 2/23-24 | 城市篩選、modal 迭代、optimistic saves |
| 品牌定稿 | 2/25 | 設計 token 系統、Lucide 圖標、Logo、Framer Motion 導航 |

完整 commit 級開發記錄：[PROJECT_EVOLUTION.md](PROJECT_EVOLUTION.md)

</details>

---

## License

本專案採用 [MIT License](LICENSE) 授權。

---

<p align="center">
  在台灣用心打造。Built with care in Taiwan.
</p>
