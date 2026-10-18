import { useState } from 'react';
import { Plus, Search, Utensils } from 'lucide-react';
import { useTripStore } from '@/stores';
import * as itinerariesApi from '@/api/itineraries';
import { emptyAssistance, mapsSearch, searchPlanningPlaces } from '@/api/planning';
import type { Place, PlaceResult, SearchResult } from '@/api/planning';

export default function RestaurantPanel({ day, mode, currentLocation }: { day: number; mode: string; currentLocation: Place | null }) {
  const trip = useTripStore(s => s.trip)!;
  const planning = useTripStore(s => s.planning)!;
  const [query, setQuery] = useState('');
  const [anchor, setAnchor] = useState('auto');
  const [rank, setRank] = useState('on_route');
  const [budget, setBudget] = useState('any');
  const [result, setResult] = useState<SearchResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [added, setAdded] = useState<string[]>([]);
  const [party, setParty] = useState(2);
  const [mealTime, setMealTime] = useState('');
  const canEdit = trip.my_role !== 'viewer';
  const items = trip.items.filter(i => i.day_number === day && planning.data.items[i.id]?.progress !== 'skipped').sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
  const activeIndex = anchor === 'auto' ? Math.max(0, items.findIndex(i => planning.data.items[i.id]?.progress !== 'done')) : items.findIndex(i => String(i.id) === anchor);
  const reference: Place | null = anchor === 'current' ? currentLocation : items[activeIndex] ? { ...items[activeIndex], address: items[activeIndex].address || '' } : planning.data.days[day]?.start || planning.day_anchors?.[day]?.start || null;
  const next = items[activeIndex + 1];
  const after = anchor === 'current' ? items.find(i => planning.data.items[i.id]?.progress !== 'done') : next;
  const search = async () => {
    setBusy(true); setError('');
    try {
      setResult(await searchPlanningPlaces(trip.id, query.trim() || '附近餐廳', { center: reference, next_stop: after ? { ...after, address: after.address || '' } : null, restaurants_only: true, rank_by: rank, mode }));
    } catch (e) { setError(e instanceof Error ? e.message : '查詢失敗'); }
    finally { setBusy(false); }
  };
  const add = async (place: PlaceResult) => {
    setBusy(true); setError('');
    let created = false;
    try {
      const item = await itinerariesApi.createItineraryItem(trip.id, { day_number: day, name: place.name, address: place.address, latitude: place.latitude, longitude: place.longitude, description: '餐廳；訂位與營業時間請確認店家資訊。', time: null });
      created = true;
      setAdded(list => [...list, place.place_id || place.name]);
      const latest = useTripStore.getState().planning!;
      await useTripStore.getState().savePlanning({ ...latest.data, items: { ...latest.data.items, [item.id]: { ...emptyAssistance(), duration_minutes: 75, ticket_status: 'none', reservation_status: place.reservable === false ? 'unavailable' : 'todo', reservation_url: place.booking_url || place.website || '', reservation_phone: place.phone || '', party_size: party, booking_notes: '請確認此分店是否接受預約、開放訂位日期、訂金及取消規則。' } } });
    } catch (e) { setError((created ? '餐廳已加入，輔助資料請在景點卡片補填。' : '') + (e instanceof Error ? e.message : '加入失敗')); }
    finally { await useTripStore.getState().fetchTrip(trip.id); setBusy(false); }
  };
  const levels: Record<string, string> = { PRICE_LEVEL_FREE: '免費', PRICE_LEVEL_INEXPENSIVE: '平價', PRICE_LEVEL_MODERATE: '中等', PRICE_LEVEL_EXPENSIVE: '較高', PRICE_LEVEL_VERY_EXPENSIVE: '高價' };
  const shown = result?.places.filter(p => budget === 'any' || !p.price_level || (budget === 'low' ? ['PRICE_LEVEL_FREE', 'PRICE_LEVEL_INEXPENSIVE'].includes(p.price_level) : budget === 'medium' ? p.price_level === 'PRICE_LEVEL_MODERATE' : ['PRICE_LEVEL_EXPENSIVE', 'PRICE_LEVEL_VERY_EXPENSIVE'].includes(p.price_level)));
  return <div className="planning-panel">
    <h3><Utensils size={17} />附近餐廳／指定分店</h3>
    <form className="planning-editor" onSubmit={e => { e.preventDefault(); void search(); }}>
      <label className="planning-label">想吃什麼／指定品牌<input className="glass-input" placeholder="例如：牛舌、壽司或店名；可留空" value={query} onChange={e => setQuery(e.target.value)} /></label>
      <label className="planning-label">以哪個位置找餐廳<select className="glass-input" value={anchor} onChange={e => { setAnchor(e.target.value); setResult(null); }}><option value="auto">依第一個待訪景點</option>{currentLocation && <option value="current">目前位置</option>}{items.map(i => <option value={String(i.id)} key={i.id}>{i.name} 之後</option>)}</select></label>
      <div className="planning-two"><label className="planning-label">排序<select className="glass-input" value={rank} onChange={e => { setRank(e.target.value); setResult(null); }}><option value="on_route">放進行程較順</option><option value="nearest">距離用餐前地點較近</option></select></label><label className="planning-label">預算篩選<select className="glass-input" value={budget} onChange={e => setBudget(e.target.value)}><option value="any">不限</option><option value="low">平價</option><option value="medium">中等</option><option value="high">較高</option></select></label></div>
      <p className="planning-muted">目前參考：{reference?.name || '尚未選定地點'}{after ? ` → ${after.name}` : ''}。未取得價格的店家仍會列出，請至店家確認。</p>
      <button className="btn-secondary" type="submit" disabled={busy}><Search size={15} />{busy ? '查詢中…' : '推薦餐廳／尋找分店'}</button>
    </form>
    {error && <p className="planning-error" role="alert">{error}</p>}
    {!result && <a href={mapsSearch({ name: `${query || '餐廳'} ${reference?.name || ''}`, address: '', latitude: null, longitude: null })} target="_blank" rel="noopener noreferrer">在 Google Maps 查詢附近店家／分店 ↗</a>}
    {result && <>
      <p className="planning-muted">{result.notice} · 查詢於 {new Date(result.checked_at).toLocaleTimeString('zh-TW')} · 資料：{result.source}</p>
      {shown?.length === 0 && <p className="planning-muted">附近收錄資料中找不到符合條件的店家，不代表沒有分店。可換店名、調整預算，或開啟地圖查詢。</p>}
      {shown?.map(p => <article className="planning-restaurant" key={p.place_id || p.name}>
        <strong>{p.name}</strong><p className="planning-muted">{p.address || '地址資訊尚不完整，請確認地圖上的分店位置'}</p>
        <p className="planning-muted">{p.distance_meters != null ? `直線距離 ${(p.distance_meters / 1000).toFixed(1)} km` : ''}{p.detour_meters != null ? ` · 加入路線約增加 ${(p.detour_meters / 1000).toFixed(1)} km 直線距離` : ''} · {p.price_level ? levels[p.price_level] || '價格待確認' : '價格待確認'}</p>
        {p.travel_seconds != null && <p className="planning-muted">前往約 {Math.round(p.travel_seconds / 60)} 分鐘{p.detour_seconds != null ? ` · 插入行程約增加 ${Math.round(p.detour_seconds / 60)} 分鐘交通` : ''}</p>}
        {p.hours && p.hours.length > 0 && <details><summary>營業時間資料（請確認到訪日期）</summary>{p.hours.map((h, i) => <p className="planning-muted" key={i}>{h}</p>)}</details>}
        <p className="planning-muted">{p.reservable === true ? '資料顯示接受訂位，指定時段是否有位仍需確認。' : p.reservable === false ? '資料顯示不接受訂位，請向店家確認排隊方式。' : '訂位方式尚未確認，請先查看店家網站或電話詢問。'}</p>
        <div className="planning-actions"><a href={p.maps_url || mapsSearch(p)} target="_blank" rel="noopener noreferrer">確認分店位置 ↗</a>{p.website && <a href={p.website} target="_blank" rel="noopener noreferrer">店家網站 ↗</a>}{p.booking_url && <a href={p.booking_url} target="_blank" rel="noopener noreferrer">訂位入口 ↗</a>}{p.phone && <span className="planning-muted">電話：{p.phone}</span>}</div>
        {canEdit && <button className="btn-secondary" type="button" disabled={busy || added.includes(p.place_id || p.name)} onClick={() => void add(p)}><Plus size={14} />{added.includes(p.place_id || p.name) ? '已加入今日' : '加入今日行程'}</button>}
      </article>)}
      <a href={mapsSearch({ name: `${query || '餐廳'} ${reference?.name || ''}`, address: '', latitude: null, longitude: null })} target="_blank" rel="noopener noreferrer">在 Google Maps 補查其他分店 ↗</a>
      <p className="planning-muted">免費資料來自 <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>，收錄並非完整名單。</p>
    </>}
    <details className="planning-reservation-guide"><summary>如何訂位／電話詢問範例</summary>
      <ol><li>先確認分店地址，再從店家網站找「Reservation／予約」。</li><li>確認開放日期、人數、訂金及取消規則；有提供電話時可直接詢問。</li><li>收到確認後，在景點卡片標記「已訂位」，填入固定預約時間。</li></ol>
      <div className="planning-two"><label className="planning-label">人數<input className="glass-input" type="number" min="1" max="100" value={party} onChange={e => setParty(Number(e.target.value))} /></label><label className="planning-label">想預約的時間<input className="glass-input" type="time" value={mealTime} onChange={e => setMealTime(e.target.value)} /></label></div>
      <p className="planning-muted">中文：您好，請問可以預約〔日期〕{mealTime || '〔時間〕'}、{party} 位嗎？</p>
      <p className="planning-muted">日文：〔日付〕の{mealTime || '〔時間〕'}に、{party}名で予約できますか？</p>
    </details>
  </div>;
}
