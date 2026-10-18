# 路線規劃功能（本次更新）

在既有旅程的「行程規劃」右側（手機版在景點上方）使用：

1. 右側面板最上方（手機版在景點上方）的「航班與住宿 → 設定航班／住宿」可為舊旅程新增選填資料。住宿只有地點與適用晚數，不要求入住或回飯店時間。Day 1 有去程抵達機場時，優先從該機場出發；只填抵達日期、尚無時間也能帶入機場，沒有指定抵達日期則先用於 Day 1。已填抵達日期的航班依實際抵達日安排，跨日抵達不強塞到首日。沒有抵達機場時，才使用前一晚／首晚住宿。手動起點或本次目前位置仍優先。畫面上的自動起終點與路線預覽使用相同的後端判斷，不需先按路線按鈕才顯示機場。
2. 「設定今日起終點／出發時間」可覆寫住宿推導的起終點；開始時間可留空。今日或無日期時使用現在時間，其他日期未指定時間時只比較地點與各段時間，不編造抵達時刻。
3. 選交通方式，按「補齊交通」保留順序；按「推薦順路安排」先看預覽，再決定是否套用。
4. 景點下方可標記已完成／略過、調整停留分鐘或鎖定預約；建議只處理未完成景點。多人更新後，過期的預覽會被拒絕，需重新計算。
5. 「以目前位置為起點」須由使用者點選並允許定位；位置僅用於本次預覽，不寫入住宿資料。
6. 啟用 Google 後，景點、住宿、機場與每日起終點的名稱輸入停頓約一秒，就會搜尋詳細地址。只有一個結果且地址空白時自動補齊地址與座標；多個同名地點須選取正確分店。手動修改地址會清除舊座標，重新選取地點才會定位。未啟用 Google 時需按搜尋，避免對公共 Nominatim 發送自動完成請求。
7. 新增去程航班時預填旅程開始日，回程預填結束日；日期與時間分開，可修改跨日抵達日期，也能只存日期而不編造時間。航班卡片上的「補上時間／修改時間」會直接開啟該航班；時間以 24 小時制的「時／分」選單選取，選完可直接按底部「儲存輔助資料」。去程起飛時區預填瀏覽器時區、抵達時區預填目的地時區，回程相反，仍須依實際機場確認。航班編號旁提供「此日期航班查詢」與台灣虎航官方時刻表入口（IT 航班）。目前依使用者選擇未新增航班付費 API，因此不會自動擷取／回填班機、機場或時刻，請以訂位確認信及航空公司公告確認。

景點下方也可記錄購票／免費預約狀態、期限、訂位網址與人數；未確認是否需票的景點會在旅程待辦提醒，沒有自動斷言必須購票。餐廳查詢可依目前景點或定位比較附近候選店家與分店，提供網站、電話及訂位說明；免費 OSM 收錄與價格資料可能不完整，營業與空位需以店家確認。第三方授權比價尚未加入。

免金鑰步行／開車使用 FOSSGIS 的 OSRM 路線服務：實際道路距離與模型時間估算，非即時路況。依服務政策限制每秒最多一次請求，整天路線合併查詢、短暫重用結果；公共服務無常駐保證，不適合大量流量，擴大公開使用前需切換自架或有合約的供應商。來源與限制：[FOSSGIS](https://routing.openstreetmap.de/about.html)、[OSRM](https://project-osrm.org/docs/v5.24.0/api/)。

大眾運輸在未啟用 Google 時，只提供直線距離順路建議與逐段導航入口，**不會以步行／開車時間代替班次**。道路服務失敗時也會清楚降級。需要精確定位才能使用道路服務；輸入名稱後請按搜尋，選擇正確分店或入口。

Google 查詢是選用且預設關閉的功能。只需要景點、自動補地址與餐廳搜尋時，在 Google Cloud 啟用 **Places API (New)**，設定帳單與配額、限制金鑰可用 API，再於本機 `backend/.env` 或 Render 環境變數設定：

```dotenv
GOOGLE_MAPS_ENABLED=true
GOOGLE_MAPS_API_KEY=你的後端金鑰
GOOGLE_ROUTES_ENABLED=false
```

目前本機採用以上設定：保留 Places，停止呼叫 Google Routes。步行／開車改用免金鑰 OSRM 道路估算；大眾運輸使用地理排序與導航連結。餐廳仍可查詢 Google 店家資料，距離排序會依可用的交通資料或直線距離比較。

若日後需要 Google 路線時間，另在 Google Cloud 啟用 **Routes API**，再設定 `GOOGLE_ROUTES_ENABLED=true`。此開關預設為 `false`，且須同時有 `GOOGLE_MAPS_ENABLED=true` 與金鑰才會呼叫 Routes。只在 Cloud 停用 API 不會改變本機設定，需同步維持此開關為 `false`；不要為了停用 Routes 關掉 `GOOGLE_MAPS_ENABLED`，那也會停止 Google 地點搜尋。

修改本機環境變數後，執行 `podman compose up -d --force-recreate --no-deps backend` 並重新整理網頁。

正式站更新時，在 Render 後端服務的 **Environment** 新增／確認 `GOOGLE_MAPS_ENABLED=true`、`GOOGLE_MAPS_API_KEY=你的後端金鑰`、`GOOGLE_ROUTES_ENABLED=false`，再選擇 **Save, rebuild, and deploy** 載入新設定與程式。保留既有 `DATABASE_URL`、`SECRET_KEY`、`CORS_ORIGINS` 等設定，不要把本機 CORS 覆蓋到正式站。Vercel 不需設定 Google 後端金鑰。[Render 環境變數說明](https://render.com/docs/configure-environment-variables)

**日本大眾運輸限制：Google Routes API 不包含日本合作業者的交通資料**，Google Maps 網站／App 可以查到的路線，不代表 API 會提供。這項限制在 [Google 官方 FAQ](https://developers.google.com/maps/faq#transit_directions_countries) 有明確說明。日本行程可使用步行／開車的路線與時間；電車、巴士班次請開啟各段 Google Maps 導航確認，查不到時不編造班次或抵達時間。

排序依據以預覽標示為準：「依交通時間比較」須有完整地點間時間；若 Google 回傳空路線或部分路段缺少時間，改標示「依直線距離比較」，依起點、景點與終點減少地理折返，且保留鎖定預約的位置。地理順路不代表電車最快，不會填入無資料路段的交通時間或後續抵達時間。套用前仍可預覽，日本電車與機場接駁須逐段確認。時間排序也只是改善目前順序，不保證所有排列中的最快解。

2026-10-18 本機驗證：餐廳搜尋、步行路線、步行時間矩陣及台北車站至台北 101 大眾運輸成功；新宿至澀谷、太陽城王子大飯店至成田機場第一航廈的大眾運輸 API 均回傳空路線（後者也測試了隔日上午）。飯店至成田第一航廈的開車路線成功，約 75 公里、61 分鐘，為當次模型估算，未含即時路況。飯店另有 [機場巴士資訊](https://www.princehotels.com/sunshine/about-us/)，實際班次及預約以業者為準。

不使用則維持 `GOOGLE_MAPS_ENABLED=false`，不需要新增任何金鑰。請勿把後端金鑰放到 `VITE_*`。Google 價格及免費額度依 [官方價目表](https://developers.google.com/maps/billing-and-pricing/pricing)，預算通知不會自動停止扣款。

## 資料庫更新與驗證

本次只新增 `itinerary_planning` 表，記錄可選輔助資料及版本；原本帳號、景點、記帳、筆記資料不需改寫。新表啟用 PostgreSQL RLS，由後端資料庫連線存取。正式站部署新程式前，在有資料庫連線的後端環境執行：

```bash
alembic upgrade head
```

本機連接的 Supabase 已執行至 `d4e5f6a7b8c9`，並確認原有資料表筆數未變。Render 若使用同一個 Supabase，無需重複更新資料庫；若使用另一個資料庫，須先執行上面的 migration。Render 的啟動指令及 Vercel 設定保持原樣；本機操作不會更新正式服務，Git 推送是否觸發部署取決於各服務的自動部署設定。本次沒有重寫既有資料。

後端測試只在暫存 SQLite 執行，不會寫入 Supabase。測試工具 `httpx` 僅供測試環境安裝，非正式服務新增依賴：

```bash
pip install httpx
python -m unittest discover -s tests -v
```

---

# 本機啟動（Podman）

本機只額外使用根目錄 `compose.yaml`，直接掛載既有前後端程式，用官方 Python／Node 映像執行原本的啟動指令。不需要 Containerfile、Caddy 或額外啟動腳本，也不修改原有功能。

正式部署仍維持下方原有的 Vercel 前端 + Render 後端 + Supabase 資料庫。

## 現有功能

帳號註冊／登入／重設與修改密碼、個人資料、旅程管理、邀請碼與成員權限、每日景點與交通安排、拖曳排序／跨天移動、地點搜尋與導航、共同記帳／分帳、共用筆記、WebSocket 即時協作與在線成員、深淺色主題。

## 本機操作

1. macOS／Windows 確認 Podman machine 已啟動；尚未建立 VM 才執行 `podman machine init`。Linux 不需要 VM。需要可用的 Compose provider，支援 `env_file.format: raw`（例如 Docker Compose 2.30+）。
2. 保留 `backend/.env` 中已設定的 Supabase `DATABASE_URL` 與 `SECRET_KEY`。URI 使用 `postgresql+psycopg2://`，建議帶 `?sslmode=require`；密碼特殊字元要 URL encode。各值不要加引號。範例參考原有 `backend/.env.example`。不需要根目錄 `.env`。
3. 在專案根目錄執行：

```bash
podman machine start  # 只限 macOS／Windows，且 VM 尚未啟動時
podman compose up -d
podman compose ps
podman compose logs --tail=50 backend frontend
```

首次需下載映像並安裝既有相依套件。網頁：**http://localhost:8080**；後端 API 文件：**http://localhost:8000/docs**；健康檢查：`curl --fail http://localhost:8000/health`。

前端使用原本的 Vite 開發模式，依既有程式呼叫同一個 hostname 的 8000 port，WebSocket 也使用 8000 port。兩個 port 都只綁定本機。Compose 僅設定本機需要的 CORS，不修改雲端設定。

本機 Compose 為前端啟用檔案輪詢，避免 Podman VM 沒收到主機檔案更新事件，導致 Vite 持續提供舊模組。若畫面仍是舊版，先確認網址是 `http://localhost:8080`，重新整理；必要時執行 `podman compose restart frontend`。Vercel 正式站須另外部署才會取得更新。

```bash
podman compose down          # 停止本機服務，不刪除 Supabase 資料
podman compose up -d         # 再次啟動
podman compose restart backend  # 修改後端程式後重新啟動；前端由 Vite 即時更新
# backend/.env 修改後需重新建立容器
podman compose up -d --force-recreate
```

不會自動執行 migration 或變更資料表，也沒有攔截重設密碼的額外邏輯。既有 Supabase 已有應用資料表，可直接使用。

**本機連接的若是正式站同一個 Supabase，新增／修改／刪除資料會影響正式站。** 這份設定沒有新增本機資料庫。

## 本機與正式部署的關係

- `render.yaml`、`frontend/vercel.json`、應用程式碼、migration 與相依套件檔案維持原版。
- Vercel 繼續讀取原有 `VITE_API_URL`／`VITE_WS_URL`，Render 繼續執行原有 Uvicorn 指令。
- 新增的 Compose 只供本機使用，不會自動套用到 Vercel／Render。

---

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
