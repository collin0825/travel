# 部署指南：Vercel (前端) + Render (後端) + Supabase (資料庫)

本文件帶你把這個專案免費部署上線。三個平台分工：

| 部分 | 平台 | 說明 |
|------|------|------|
| 前端 `frontend/` | **Vercel** | React + Vite 靜態站，全球 CDN |
| 後端 `backend/` | **Render** | FastAPI + WebSocket 常駐服務（免費方案，會休眠） |
| 資料庫 | **Supabase** | Postgres（你已建立、資料表已就緒） |

> 部署設定檔已備妥：根目錄 `render.yaml`、`frontend/vercel.json`、`frontend/.env.production.example`。

---

## 重要觀念（先讀一次，能避開大部分坑）

1. **部署順序有先後（雞生蛋）**：後端 CORS 需要前端網址、前端需要後端網址。
   正確順序 → **先部署後端拿到 Render 網址 → 部署前端拿到 Vercel 網址 → 回頭把 Vercel 網址填進後端 `CORS_ORIGINS` 並重新部署。**
2. **Supabase 連線字串一定要用 Session pooler**（`...pooler.supabase.com:5432`）。
   Render 免費方案走 IPv4，而 Supabase 直連是 IPv6-only，只有 pooler 支援 IPv4。scheme 要改成 `postgresql+psycopg2://`。
3. **Render 免費方案會休眠**：閒置約 15 分鐘後 spin down，之後第一個請求要等約 30 秒喚醒，WebSocket 會斷線重連 —— 這是正常現象。
4. **前端 `VITE_*` 變數是 build 時寫死的**：改了值要在 Vercel 重新 Deploy 才生效。

---

## Step 0 — 把程式碼推上 GitHub

Vercel 與 Render 都是從 GitHub repo 部署。本機目前還沒有 git repo，先建立並上傳。

1. 到 <https://github.com/new> 建立一個新的 repo（可設 Private），例如命名 `travel`。
   **不要**勾選「Add a README file」（本機已有檔案，避免衝突）。

2. 本機在專案根目錄執行：

   ```bash
   cd e:/personal_training/AI/travel
   git init
   git add .
   git status        # 確認 backend/.env 與 *.db 不在待提交清單中
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/<你的帳號>/travel.git
   git push -u origin main
   ```

3. push 後到 GitHub 網頁確認：`backend/.env`、`backend/travel.db` **沒有**被上傳（密鑰已被 `.gitignore` 排除）。

---

## Step 1 — 部署後端到 Render

1. **註冊**：到 <https://render.com> → 點 **Get Started** → 選 **GitHub** 登入並授權。

2. 進 Dashboard → **New +** → **Blueprint**
   （Render 會自動讀取 repo 根目錄的 `render.yaml`）→ 選你的 `travel` repo → **Apply**。

   > 不想用 Blueprint 也可手動：**New + → Web Service** → 選 repo，設定：
   > - **Root Directory**：`backend`
   > - **Build Command**：`pip install -r requirements.txt`
   > - **Start Command**：`uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   > - **Instance Type**：Free

3. 進該 service 的 **Environment** 分頁，填入兩個標記為手動的變數：

   - **`DATABASE_URL`**：到 Supabase → Project Settings → Database → Connection string → 選 **Session pooler**，複製後：
     - 把開頭 `postgresql://` 改成 `postgresql+psycopg2://`
     - 填入你的資料庫密碼
     - 格式範例見 `backend/.env.example`，長得像：
       `postgresql+psycopg2://postgres.<project-ref>:<PASSWORD>@aws-0-<region>.pooler.supabase.com:5432/postgres`
   - **`CORS_ORIGINS`**：先暫填 `https://placeholder.vercel.app`（Step 3 會改成真正的 Vercel 網址）。

   （`SECRET_KEY` 由 `render.yaml` 設為自動產生、`ACCESS_TOKEN_EXPIRE_DAYS=30` 已內建，不用手動填。）

4. 等待 build & deploy 完成，記下後端網址，例如 `https://travel-backend-xxxx.onrender.com`。

5. 瀏覽器開 `https://travel-backend-xxxx.onrender.com/health` → 應回 `{"status":"ok"}`。
   （首次可能要等約 30 秒喚醒。）

---

## Step 2 — 部署前端到 Vercel

1. **註冊**：到 <https://vercel.com> → **Sign Up** → 選 **GitHub** 登入並授權。

2. **Add New… → Project** → **Import** 你的 `travel` repo。

3. 設定：
   - **Root Directory**：設為 `frontend`
   - **Framework Preset**：會自動偵測為 **Vite**（Build = `npm run build`，Output = `dist`，不用改）
   - 展開 **Environment Variables**，新增兩個（值填 Step 1 的 Render 網址）：

     | Name | Value |
     |------|-------|
     | `VITE_API_URL` | `https://travel-backend-xxxx.onrender.com` |
     | `VITE_WS_URL` | `wss://travel-backend-xxxx.onrender.com` |

     ⚠️ `VITE_WS_URL` 開頭是 **`wss://`**（不是 `ws://` 也不是 `https://`）。

4. 點 **Deploy** → 完成後記下前端網址，例如 `https://travel-xxxx.vercel.app`。

---

## Step 3 — 回填後端 CORS 並重新部署

1. 回 Render → 你的後端 service → **Environment** → 把 `CORS_ORIGINS` 改成 Step 2 的 Vercel 網址：

   ```
   https://travel-xxxx.vercel.app
   ```

   - 必須**完全一致**：含 `https://`、**結尾不要有斜線**。
   - 之後若綁自訂網域，可用逗號串接多個：
     `https://travel-xxxx.vercel.app,https://yourdomain.com`

2. 存檔後 Render 會自動重新部署（或按 **Manual Deploy → Deploy latest commit**）。

完成！前後端與資料庫已全部串接。

---

## 部署後驗證清單

1. 開 `https://<render 網址>/health` → 回 `{"status":"ok"}`。
2. 開 `https://<render 網址>/docs` → FastAPI Swagger 正常顯示。
3. 開 Vercel 前端網址 → **註冊新帳號 → 登入**（驗證前端→後端→Supabase 全鏈路 + JWT）。
4. 建立一個行程、加一筆支出 → 到 Supabase Table editor 確認 row 有寫入。
5. 用兩個瀏覽器分頁開同一個行程，一邊新增項目 → 另一邊即時更新（驗證 WebSocket / `wss://`）。
6. 在深層頁面（如 `/trip/<id>`）按重新整理 → 不應 404（驗證 `vercel.json` rewrite）。
7. 開瀏覽器 DevTools → Console/Network 不應出現 CORS 錯誤。

---

## 疑難排解

| 症狀 | 檢查 |
|------|------|
| 前端呼叫 API 出現 **CORS error** | Render 的 `CORS_ORIGINS` 是否**完全等於**前端網址（含 `https://`、無結尾斜線），改完是否已重新部署 |
| 後端啟動失敗 / **DB 連不上** | 是否用 Supabase **Session pooler** 字串、scheme 是否為 `postgresql+psycopg2://`、密碼是否正確 |
| WebSocket 連不上 | `VITE_WS_URL` 是否為 `wss://`（非 `ws://`）；改了 `VITE_*` 後是否已在 Vercel 重新 Deploy |
| 第一次開很慢（約 30 秒） | Render 免費方案休眠喚醒，正常現象 |
| 改了環境變數沒生效（前端） | `VITE_*` 是 build 時寫死，需在 Vercel 重新 Deploy |

---

## 補充

- **Vercel Preview 部署**：每個 branch/PR 會有不同預覽網址，那些網址不在 `CORS_ORIGINS` 內會被擋 —— 正式使用以 production 網址為準即可。
- **保持後端喚醒（選用）**：可用外部 cron（如 cron-job.org）每 10 分鐘打一次 `/health`，減少休眠。非必要。
- **資料庫 migration**：Supabase 資料表已建好，部署流程**不需**再跑。未來若 schema 有變更，可在 Render 的 Shell 執行 `cd backend && alembic upgrade head`（該指令會讀取 `DATABASE_URL` 環境變數）。
