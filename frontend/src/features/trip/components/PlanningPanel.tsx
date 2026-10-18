import { lazy, Suspense, useRef, useState } from 'react';
import { BedDouble, LocateFixed, Navigation, Plane, Route, Ticket } from 'lucide-react';
import { useTripStore } from '@/stores';
import { applyRoute, emptyAssistance, emptyDay, localZone, previewRoute, ticketLabels } from '@/api/planning';
import type { DaySettings, Place, RouteLeg, RoutePreview } from '@/api/planning';
import PlacePicker from './PlacePicker';
const TravelSetupModal = lazy(() => import('./TravelSetupModal'));
const RestaurantPanel = lazy(() => import('./RestaurantPanel'));

export function RouteLegCard({ leg }: { leg: RouteLeg }) {
  return <div className="planning-leg">
    <div className="planning-leg-title"><Route size={14} /><span>{leg.from_name} → {leg.to_name}</span></div>
    <div className="planning-muted">{leg.seconds !== null ? `約 ${Math.max(1, Math.round(leg.seconds / 60))} 分鐘` : '時間請至導航確認'}{leg.distance_meters !== null ? ` · ${(leg.distance_meters / 1000).toFixed(1)} km${leg.source === 'straight_line' ? '（直線）' : ''}` : ''}</div>
    {leg.instructions.length > 0 && <details><summary>路線資訊</summary>{leg.instructions.map((line, i) => <p className="planning-muted" key={i}>{line}</p>)}</details>}
    {leg.fare && <span className="planning-muted">參考票價 {leg.fare.currencyCode} {Number(leg.fare.units || 0) + Number(leg.fare.nanos || 0) / 1e9}</span>}
    <a href={leg.navigation_url} target="_blank" rel="noopener noreferrer">開啟這段導航 ↗</a>
  </div>;
}

interface Props { day: number; dayCount: number; route: RoutePreview | null; onPreview: (value: RoutePreview | null) => void }

export default function PlanningPanel({ day, dayCount, route, onPreview }: Props) {
  const trip = useTripStore(s => s.trip)!;
  const planning = useTripStore(s => s.planning);
  const planningError = useTripStore(s => s.planningError);
  const save = useTripStore(s => s.savePlanning);
  const [showSetup, setShowSetup] = useState(false);
  const [setupFlightId, setSetupFlightId] = useState<string>();
  const [mode, setMode] = useState('walk');
  const [preference, setPreference] = useState('fewer_transfers');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [location, setLocation] = useState<Place | null>(null);
  const [locating, setLocating] = useState(false);
  const [dayDraft, setDayDraft] = useState<DaySettings | null>(null);
  const [dayBase, setDayBase] = useState('');
  const [showRestaurants, setShowRestaurants] = useState(false);
  const sequence = useRef(0);
  const currentDay = useRef(day);
  currentDay.current = day;
  const canEdit = trip.my_role !== 'viewer';
  if (!planning) return <section className="glass-card planning-panel"><strong>路線規劃</strong><p className="planning-muted" role="status">{planningError || '載入選填的旅程輔助資料…'}</p>{planningError && <button className="btn-secondary" type="button" onClick={() => void useTripStore.getState().fetchPlanning(trip.id)}>重新載入</button>}</section>;
  const dayItems = trip.items.filter(i => i.day_number === day).sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
  const startStay = planning.data.stays.find(s => s.first_night <= day - 1 && s.last_night >= day - 1);
  const endStay = planning.data.stays.find(s => s.first_night <= day && s.last_night >= day);
  const daily = planning.data.days[day] || emptyDay();
  const anchors = planning.day_anchors?.[day];
  const start = location || daily.start || route?.start || (anchors ? anchors.start : startStay?.location || (day === 1 ? endStay?.location : undefined));
  const end = daily.end || route?.end || (anchors ? anchors.end : endStay?.location);
  const pending = trip.items.filter(i => {
    const value = planning.data.items[i.id] || emptyAssistance();
    return value.progress === 'planned' && (['unknown', 'required', 'reserved'].includes(value.ticket_status) || value.reservation_status === 'todo');
  });
  const capture = () => JSON.stringify({ items: useTripStore.getState().trip?.items, planning: useTripStore.getState().planning });
  const run = async (optimize: boolean, now = false) => {
    const requestedDay = day;
    const requestId = ++sequence.current;
    const snapshot = capture();
    setBusy(true); setError(''); onPreview(null);
    try {
      const result = await previewRoute(trip.id, { day_number: day, optimize, mode, preference, current_location: location, use_current_time: now, client_timezone: localZone() });
      if (requestId === sequence.current && currentDay.current === requestedDay) {
        if (capture() !== snapshot) throw new Error('旅程剛剛更新了，請重新計算路線。');
        onPreview(result);
      }
    } catch (e) { if (currentDay.current === requestedDay) setError(e instanceof Error ? e.message : '路線查詢失敗'); }
    finally { if (requestId === sequence.current) setBusy(false); }
  };
  const useLocation = () => {
    if (!navigator.geolocation) { setError('此瀏覽器不支援定位，可手動指定起點。'); return; }
    setLocating(true); setError('');
    navigator.geolocation.getCurrentPosition(position => {
      setLocation({ name: '目前位置', address: '', latitude: position.coords.latitude, longitude: position.coords.longitude });
      setLocating(false); onPreview(null);
    }, () => { setLocating(false); setError('無法取得定位，請允許瀏覽器定位或手動指定起點。'); }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
  };
  const saveDay = async () => {
    if (!dayDraft) return;
    setBusy(true); setError('');
    try {
      const latest = useTripStore.getState().planning!;
      if (JSON.stringify(latest.data.days[day] || emptyDay()) !== dayBase) throw new Error('今日設定已被其他成員更新，請收起後重新編輯。');
      await save({ ...latest.data, days: { ...latest.data.days, [day]: dayDraft } });
      setDayDraft(null); onPreview(null);
    } catch (e) { setError(e instanceof Error ? e.message : '儲存失敗'); }
    finally { setBusy(false); }
  };
  const apply = async () => {
    if (!route) return;
    setBusy(true); setError('');
    try { await applyRoute(trip.id, route); await useTripStore.getState().refresh(); onPreview(null); }
    catch (e) { setError(e instanceof Error ? e.message : '套用失敗'); onPreview(null); }
    finally { setBusy(false); }
  };
  return <>
    <section className="glass-card planning-panel">
      <div className="planning-heading"><h3><Plane size={18} />航班與住宿</h3><span className="planning-pill">選填</span></div>
      <p className="planning-muted">{planning.data.flights.length} 個航段 · {planning.data.stays.length} 個住宿安排，全部選填。</p>
      {canEdit && <button className="btn-secondary" type="button" onClick={() => { setSetupFlightId(undefined); setShowSetup(true); }}><Plane size={16} />設定航班／住宿</button>}
      {!canEdit && <p className="planning-muted">目前為檢視權限，請由旅程編輯者設定航班與住宿。</p>}
      {planning.data.flights.map(f => <div className="planning-flight" key={f.id}><strong>{f.label}</strong><span>{f.departure_at?.replace('T', ' ') || `${f.departure_date || '日期待填'} 時間待填`} {f.departure_timezone}</span><span>→ {f.arrival_at?.replace('T', ' ') || `${f.arrival_date || '日期待填'} 時間待填`} {f.arrival_timezone}</span>{canEdit && <button type="button" className="planning-link-button" aria-label={`${f.departure_at && f.arrival_at ? '修改' : '補上'}${f.label}時間`} onClick={() => { setSetupFlightId(f.id); setShowSetup(true); }}>{f.departure_at && f.arrival_at ? '修改時間' : '補上時間'}</button>}</div>)}
    </section>
    <section className="glass-card planning-panel">
      <div className="planning-heading"><h3><Route size={18} />路線規劃</h3><span className="planning-pill">Day {day}</span></div>
      <p className="planning-muted">先排地點，再比較怎麼走比較順。住宿與出發時間都可留空。</p>
      <div className="planning-anchor"><span><BedDouble size={15} />起點</span><strong>{start?.name || '未指定，可從景點中推薦起點'}</strong><span>終點</span><strong>{end?.name || '未指定，不要求回飯店時間'}</strong></div>
      {canEdit && <button type="button" className="btn-secondary" disabled={busy} onClick={() => { setDayDraft(dayDraft ? null : structuredClone(daily)); setDayBase(JSON.stringify(daily)); setError(''); }}>設定今日起終點／出發時間（選填）</button>}
      {dayDraft && <form className="planning-editor" onSubmit={e => { e.preventDefault(); void saveDay(); }}>
        <PlacePicker itineraryId={trip.id} label="今日起點（留空依抵達機場／住宿安排）" value={dayDraft.start} onChange={p => setDayDraft({ ...dayDraft, start: p })} />
        <PlacePicker itineraryId={trip.id} label="今日終點（留空依離境機場／住宿安排）" value={dayDraft.end} onChange={p => setDayDraft({ ...dayDraft, end: p })} />
        <label className="planning-label">出發時間（選填）<input className="glass-input" type="time" value={dayDraft.start_time || ''} onChange={e => setDayDraft({ ...dayDraft, start_time: e.target.value || null })} /></label>
        <p className="planning-muted">留空時，今日／未設定日期的旅程從現在估算；未來日期先顯示地點順序。</p>
        <div className="planning-two"><button className="btn-secondary" type="button" onClick={() => setDayDraft(null)}>取消</button><button className="btn-primary" type="submit" disabled={busy}>儲存今日設定</button></div>
      </form>}
      <label className="planning-label">交通方式<select className="glass-input" value={mode} disabled={busy} onChange={e => { setMode(e.target.value); onPreview(null); }}><option value="walk">步行 · {planning.live_routes ? 'Google 路線' : '免金鑰道路估算'}</option><option value="drive">開車 · {planning.live_routes ? 'Google 路線' : '免金鑰道路估算'}</option><option value="transit">大眾運輸 · {planning.live_routes ? 'Google 交通查詢' : '地理建議與導航'}</option></select></label>
      {mode === 'transit' && planning.live_routes && <label className="planning-label">大眾運輸偏好<select className="glass-input" value={preference} onChange={e => { setPreference(e.target.value); onPreview(null); }}><option value="fewer_transfers">少轉乘</option><option value="less_walking">少走路</option></select></label>}
      {mode === 'transit' && planning.live_routes && <p className="planning-muted">Google API 不提供日本大眾運輸資料；日本行程請開啟各段導航確認班次。</p>}
      {daily.start_time && <p className="planning-muted">出發時間：{daily.start_time} · {planning.data.timezone || localZone()}</p>}
      <div className="planning-actions"><button className="planning-link-button" type="button" disabled={busy || locating} onClick={useLocation}><LocateFixed size={14} />{locating ? '定位中…' : '以目前位置為起點'}</button>{location && <button className="planning-link-button" type="button" onClick={() => { setLocation(null); onPreview(null); }}>清除定位</button>}</div>
      <div className="planning-two"><button className="btn-secondary" type="button" disabled={busy || !!dayDraft} onClick={() => void run(false)}><Navigation size={15} />補齊交通</button><button className="btn-primary" type="button" disabled={busy || !!dayDraft} onClick={() => void run(true)}><Route size={15} />推薦順路安排</button></div>
      <button className="planning-link-button" type="button" disabled={busy || !!dayDraft} onClick={() => void run(true, true)}>以現在時間重新估算剩餘行程</button>
      {busy && <p className="planning-muted" role="status">處理中…道路比較通常需要幾秒，請稍候。</p>}
      {error && <p className="planning-error" role="alert">{error}</p>}
      {route && <div className="planning-preview">
        <div className="planning-heading"><strong>{route.changed ? '建議的新順序' : '目前順序'}</strong><span className="planning-pill">{route.metric === 'travel_time' ? '依交通時間比較' : '依直線距離比較'}</span></div>
        {route.departure_at && <p className="planning-muted">從 {new Date(route.departure_at).toLocaleString('zh-TW', { timeZone: route.timezone, month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} 起算 · {route.timezone}</p>}
        <ol className="planning-stop-list">{route.stops.map(s => <li key={s.item_id}><span>{s.name}</span>{s.arrival_at && <small>預估 {new Date(s.arrival_at).toLocaleTimeString('zh-TW', { timeZone: route.timezone, hour: '2-digit', minute: '2-digit' })}</small>}{s.fixed_time && <small>固定 {s.fixed_time}</small>}</li>)}</ol>
        {route.saving !== null && route.saving > 0 && <p className="planning-success">{route.metric === 'travel_time' ? `參考交通時間可減少約 ${Math.round(route.saving / 60)} 分鐘` : `可減少約 ${(route.saving / 1000).toFixed(1)} km 直線折返`}</p>}
        {route.warnings.map((w, i) => <p className="planning-muted" key={i}>{w}</p>)}
        {route.conflicts.map((w, i) => <p className="planning-warning" role="alert" key={i}>{w}</p>)}
        {route.changed && canEdit && <button className="btn-primary" type="button" disabled={busy || !route.can_apply} onClick={() => void apply()}>套用建議順序</button>}
        {!route.changed && <p className="planning-muted">這次比較沒有找到更短的可用順序，保留原安排。</p>}
        <details><summary>查看所有交通段（{route.legs.length}）</summary>{route.legs.map((leg, i) => <RouteLegCard leg={leg} key={i} />)}</details>
        {route.legs.some(l => l.source.startsWith('OSRM')) && <p className="planning-muted">路線：OSRM / FOSSGIS · © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a> · <a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noopener noreferrer">修正地圖</a></p>}
      </div>}
    </section>
    <section className="glass-card planning-panel"><button className="planning-link-button" type="button" onClick={() => setShowRestaurants(!showRestaurants)}>{showRestaurants ? '收起餐廳與訂位指引' : '依今日路線找餐廳／分店與訂位方式'}</button>{showRestaurants && <Suspense fallback={<p className="planning-muted">載入餐廳查詢…</p>}><RestaurantPanel day={day} mode={mode} currentLocation={location} /></Suspense>}</section>
    {pending.length > 0 && <section className="glass-card planning-panel"><h3><Ticket size={18} />旅程待辦 · {pending.length}</h3>{pending.map(i => {
      const extra = planning.data.items[i.id] || emptyAssistance();
      const overdue = extra.ticket_deadline && new Date(extra.ticket_deadline).getTime() < Date.now() && extra.ticket_status !== 'purchased';
      return <div className="planning-todo" key={i.id}><strong>Day {i.day_number} · {i.name}</strong><span>{ticketLabels[extra.ticket_status]}{extra.reservation_status === 'todo' ? ' · 待訂位' : ''}</span>{extra.ticket_deadline && <span className={overdue ? 'planning-warning' : 'planning-muted'}>{overdue ? '期限已過：' : '期限：'}{new Date(extra.ticket_deadline).toLocaleString('zh-TW')}</span>}</div>;
    })}</section>}
    {showSetup && <Suspense fallback={<p className="planning-muted">載入航班與住宿…</p>}><TravelSetupModal dayCount={dayCount} flightId={setupFlightId} onClose={() => setShowSetup(false)} /></Suspense>}
    {dayItems.length === 0 && <p className="planning-muted">先加入今天想去的地點，就能補交通或推薦順序。</p>}
  </>;
}
