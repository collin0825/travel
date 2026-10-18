import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BedDouble, Plane, Plus, Trash2, X } from 'lucide-react';
import { useTripStore } from '@/stores';
import { localZone } from '@/api/planning';
import type { Flight, PlanningData, Stay } from '@/api/planning';
import PlacePicker from './PlacePicker';

interface Props { dayCount: number; onClose: () => void; flightId?: string }
const zones = ['Asia/Taipei', 'Asia/Tokyo', 'Asia/Seoul', 'Asia/Hong_Kong', 'Asia/Bangkok', 'Asia/Singapore', 'Europe/Paris', 'Europe/London', 'America/Los_Angeles', 'America/New_York', 'Australia/Sydney', 'UTC'];

function FlightTimePicker({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const id = useId();
  const [hour = '', minute = ''] = value.split(':');
  const update = (nextHour: string, nextMinute: string) => onChange(nextHour || nextMinute ? `${nextHour}:${nextMinute}` : '');
  return <div className="planning-label"><span id={id}>{label}（選填，24 小時制）</span>
    <div className="planning-time-inputs" role="group" aria-labelledby={id}>
      <select className="glass-input" aria-label={`${label}小時`} value={hour} onChange={e => update(e.target.value, minute)}><option value="">時</option>{Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')).map(v => <option value={v} key={v}>{v}</option>)}</select>
      <span aria-hidden="true">:</span>
      <select className="glass-input" aria-label={`${label}分鐘`} value={minute} onChange={e => update(hour, e.target.value)}><option value="">分</option>{Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')).map(v => <option value={v} key={v}>{v}</option>)}</select>
    </div>
    {value && <button type="button" className="planning-link-button" onClick={() => onChange('')}>清除{label}</button>}
  </div>;
}

export default function TravelSetupModal({ dayCount, onClose, flightId }: Props) {
  const trip = useTripStore(s => s.trip)!;
  const planning = useTripStore(s => s.planning)!;
  const save = useTripStore(s => s.savePlanning);
  const flightDate = (kind: Flight['kind']) => (kind === 'departure' ? trip.end_date : trip.start_date) || null;
  const selectedFlight = planning.data.flights.find(f => f.id === flightId);
  const [draft, setDraft] = useState<PlanningData>(() => structuredClone(planning.data));
  const [tab, setTab] = useState<'stays' | 'flights'>(selectedFlight ? 'flights' : 'stays');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [stay, setStay] = useState<Stay | null>(null);
  const [flight, setFlight] = useState<Flight | null>(() => selectedFlight ? { ...structuredClone(selectedFlight),
    departure_date: selectedFlight.departure_date || selectedFlight.departure_at?.slice(0, 10) || flightDate(selectedFlight.kind),
    arrival_date: selectedFlight.arrival_date || selectedFlight.arrival_at?.slice(0, 10) || flightDate(selectedFlight.kind) } : null);
  const [departureTime, setDepartureTime] = useState(selectedFlight?.departure_at?.slice(11, 16) || '');
  const [arrivalTime, setArrivalTime] = useState(selectedFlight?.arrival_at?.slice(11, 16) || '');
  const [stayMode, setStayMode] = useState('range');
  const modalRef = useRef<HTMLElement>(null);
  const closeRef = useRef<() => void>(() => {});
  const zone = draft.timezone || localZone();
  const changeDraft = (data: PlanningData) => { setDraft(data); setDirty(true); setError(''); };
  const close = () => { if (!busy && (!dirty && !stay && !flight || window.confirm('尚未儲存的修改將不保留，確定關閉？'))) onClose(); };
  closeRef.current = close;
  useEffect(() => {
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    modalRef.current?.querySelector<HTMLElement>('button')?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeRef.current();
      if (event.key !== 'Tab') return;
      const fields = modalRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]');
      if (!fields?.length) return;
      const first = fields[0], last = fields[fields.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', handleKey);
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', handleKey); if (previous instanceof HTMLElement) previous.focus(); };
  }, []);
  const completedFlight = (): Flight | null => {
    if (!flight?.label.trim()) { setError('請填寫航班名稱或編號。'); return null; }
    if ([departureTime, arrivalTime].some(value => value && !/^([01]\d|2[0-3]):[0-5]\d$/.test(value))) { setError('請完整選擇時間的小時與分鐘，或按清除時間。'); return null; }
    if ((departureTime && !flight.departure_date) || (arrivalTime && !flight.arrival_date)) { setError('有填時間時，也請選擇對應的航班日期。'); return null; }
    return { ...flight,
      departure_at: departureTime && flight.departure_date ? `${flight.departure_date}T${departureTime}` : null,
      arrival_at: arrivalTime && flight.arrival_date ? `${flight.arrival_date}T${arrivalTime}` : null };
  };
  const saveDraft = async () => {
    if (stay) { setError('請先按「加入住宿」完成正在編輯的資料，或取消編輯。'); return; }
    let data = draft;
    if (flight) {
      const completed = completedFlight();
      if (!completed) return;
      data = { ...draft, flights: [...draft.flights.filter(f => f.id !== completed.id), completed] };
    }
    setBusy(true); setError('');
    try {
      // Preserve the revision that the editor was opened against, not a newer
      // collaborator revision whose changes the draft has not incorporated.
      const current = useTripStore.getState().planning;
      if (!current || current.revision !== planningAtOpen) throw new Error('其他成員已更新資料，請關閉並重新開啟後再編輯。');
      await save(data); onClose();
    } catch (e) { setError(e instanceof Error ? e.message : '儲存失敗'); }
    finally { setBusy(false); }
  };
  const [planningAtOpen] = useState(planning.revision);
  const addStay = () => {
    if (!stay?.location.name.trim()) { setError('請填寫住宿地點。'); return; }
    if (stay.last_night < stay.first_night) { setError('結束晚數不能早於開始晚數。'); return; }
    const overlap = draft.stays.some(s => s.id !== stay.id && stay.first_night <= s.last_night && stay.last_night >= s.first_night);
    if (overlap) { setError('住宿日期重疊，請先修改或移除原住宿。'); return; }
    changeDraft({ ...draft, stays: [...draft.stays.filter(s => s.id !== stay.id), stay].sort((a, b) => a.first_night - b.first_night) }); setStay(null);
  };
  const addFlight = () => {
    const completed = completedFlight();
    if (!completed) return;
    changeDraft({ ...draft, flights: [...draft.flights.filter(f => f.id !== completed.id), completed] }); setFlight(null);
  };
  const editFlight = (entry: Flight) => {
    setFlight({ ...entry, departure_date: entry.departure_date || entry.departure_at?.slice(0, 10) || flightDate(entry.kind),
      arrival_date: entry.arrival_date || entry.arrival_at?.slice(0, 10) || flightDate(entry.kind) });
    setDepartureTime(entry.departure_at?.slice(11, 16) || '');
    setArrivalTime(entry.arrival_at?.slice(11, 16) || '');
    setError('');
  };
  const newFlight = (kind: Flight['kind']) => editFlight({ id: crypto.randomUUID(), label: '', kind,
    origin: null, destination: null, departure_at: null, arrival_at: null,
    departure_timezone: kind === 'departure' ? zone : localZone(),
    arrival_timezone: kind === 'departure' ? localZone() : zone, airport_buffer_minutes: 120 });
  const searchUrl = flight ? `https://www.google.com/search?q=${encodeURIComponent(`${flight.label.trim()} ${flight.departure_date || ''} 航班 起飛 抵達`)}` : '';
  return createPortal(<div className="planning-overlay" role="presentation" onClick={close}>
    <section ref={modalRef} className="glass-card planning-modal" role="dialog" aria-modal="true" aria-label="航班與住宿" onClick={e => e.stopPropagation()}>
      <div className="planning-heading"><div><h2>航班與住宿</h2><p className="planning-muted">都可選填，既有旅程也能隨時補上。住宿不設定回程時間。</p></div><button type="button" className="planning-icon" onClick={close} aria-label="關閉航班與住宿"><X /></button></div>
      {trip.start_date && <p className="planning-muted">旅程期間：{trip.start_date} ～ {trip.end_date || trip.start_date}。去程預填開始日、回程預填結束日；跨日航班可自行調整。</p>}
      <label className="planning-label">目的地時區（選填）<input list="planning-timezones" className="glass-input" value={draft.timezone ?? ''} placeholder={`未設定時使用 ${localZone()}`} onChange={e => changeDraft({ ...draft, timezone: e.target.value || null })} /></label>
      <datalist id="planning-timezones">{zones.map(z => <option value={z} key={z} />)}</datalist>
      <div className="planning-tabs"><button type="button" className={tab === 'stays' ? 'active' : ''} onClick={() => setTab('stays')}><BedDouble size={16} />住宿地點</button><button type="button" className={tab === 'flights' ? 'active' : ''} onClick={() => setTab('flights')}><Plane size={16} />航班時間</button></div>
      {tab === 'stays' ? <>
        <p className="planning-muted">Day 2 從第 1 晚住宿出發，結束於第 2 晚住宿；換飯店也能分別安排。第 0 晚代表旅程開始前已入住。</p>
        {draft.stays.map(s => <div className="planning-entry" key={s.id}><div><strong>{s.location.name}</strong><p className="planning-muted">第 {s.first_night}～{s.last_night} 晚 · {s.location.address}</p></div><div className="planning-actions"><button type="button" className="planning-link-button" onClick={() => { setStay(structuredClone(s)); setStayMode('range'); }}>編輯</button><button type="button" className="planning-icon" aria-label={`移除住宿${s.location.name}`} onClick={() => changeDraft({ ...draft, stays: draft.stays.filter(x => x.id !== s.id) })}><Trash2 size={16} /></button></div></div>)}
        {stay ? <div className="planning-editor">
          <label className="planning-label">住宿安排方式<select className="glass-input" value={stayMode} onChange={e => {
            setStayMode(e.target.value);
            setStay({ ...stay, first_night: e.target.value === 'all' ? 1 : stay.first_night, last_night: e.target.value === 'all' ? Math.max(1, dayCount - 1) : e.target.value === 'night' ? stay.first_night : stay.last_night });
          }}><option value="all">整趟同一個住宿</option><option value="range">依晚數區間</option><option value="night">只設定一晚</option></select></label>
          {stayMode !== 'all' && <div className="planning-two"><label className="planning-label">從第幾晚<input type="number" min="0" max="365" className="glass-input" value={stay.first_night} onChange={e => setStay({ ...stay, first_night: Number(e.target.value), last_night: stayMode === 'night' ? Number(e.target.value) : stay.last_night })} /></label><label className="planning-label">到第幾晚<input type="number" min="0" max="365" disabled={stayMode === 'night'} className="glass-input" value={stay.last_night} onChange={e => setStay({ ...stay, last_night: Number(e.target.value) })} /></label></div>}
          <PlacePicker itineraryId={trip.id} label="住宿地點" value={stay.location} onChange={p => setStay({ ...stay, location: p || { name: '', address: '', latitude: null, longitude: null } })} />
          <div className="planning-two"><button className="btn-secondary" type="button" onClick={() => setStay(null)}>取消編輯</button><button className="btn-primary" type="button" onClick={addStay}>加入住宿</button></div>
        </div> : <button className="btn-secondary" type="button" onClick={() => { setStayMode(draft.stays.length ? 'range' : 'all'); setStay({ id: crypto.randomUUID(), location: { name: '', address: '', latitude: null, longitude: null }, first_night: draft.stays.length ? Math.max(...draft.stays.map(s => s.last_night)) + 1 : 1, last_night: Math.max(1, dayCount - 1) }); }}><Plus size={16} />新增住宿地點</button>}
      </> : <>
        {draft.flights.map(f => <div className="planning-entry" key={f.id}><div><strong>{f.label}</strong><p className="planning-muted">{({ arrival: '抵達', departure: '離境', connection: '其他航段' })[f.kind]} · {f.departure_at?.replace('T', ' ') || `${f.departure_date || '日期待填'} 時間待填`} → {f.arrival_at?.replace('T', ' ') || `${f.arrival_date || '日期待填'} 時間待填`}</p></div><div className="planning-actions"><button className="planning-link-button" type="button" onClick={() => editFlight(structuredClone(f))}>編輯</button><button type="button" className="planning-icon" aria-label={`移除航班${f.label}`} onClick={() => changeDraft({ ...draft, flights: draft.flights.filter(x => x.id !== f.id) })}><Trash2 size={16} /></button></div></div>)}
        {flight ? <div className="planning-editor">
          <label className="planning-label">航班名稱／編號<input className="glass-input" value={flight.label} placeholder="例如：去程 BR198" onChange={e => setFlight({ ...flight, label: e.target.value })} /></label>
          <div className="planning-actions">{flight.label.trim() && <a href={searchUrl} target="_blank" rel="noopener noreferrer">查詢此日期的航班 ↗</a>}{/\bIT\s*\d{1,4}\b/i.test(flight.label) && <a href="https://www.tigerairtw.com/zh-tw/ready-to-go/flight-schedule" target="_blank" rel="noopener noreferrer">台灣虎航官方時刻表 ↗</a>}</div>
          <p className="planning-muted">目前未接航班資料 API，查詢連結會開啟新頁，不會自動回填。請依搭乘日期與訂位確認信填入機場及時間；時間可留空。</p>
          <label className="planning-label">航段用途<select className="glass-input" value={flight.kind} onChange={e => {
            const kind = e.target.value as Flight['kind'];
            const previous = flightDate(flight.kind);
            setFlight({ ...flight, kind,
              departure_date: !departureTime && flight.departure_date === previous ? flightDate(kind) : flight.departure_date,
              arrival_date: !arrivalTime && flight.arrival_date === previous ? flightDate(kind) : flight.arrival_date,
              departure_timezone: !departureTime && !flight.origin ? (kind === 'departure' ? zone : localZone()) : flight.departure_timezone,
              arrival_timezone: !arrivalTime && !flight.destination ? (kind === 'departure' ? localZone() : zone) : flight.arrival_timezone });
          }}><option value="arrival">去程／抵達旅遊目的地</option><option value="departure">回程／離開旅遊目的地</option><option value="connection">其他／轉機航段</option></select></label>
          <PlacePicker itineraryId={trip.id} label="出發機場／航廈（選填）" value={flight.origin} onChange={p => setFlight({ ...flight, origin: p })} />
          <div className="planning-two"><label className="planning-label">起飛日期<input type="date" className="glass-input" value={flight.departure_date || ''} onChange={e => setFlight({ ...flight, departure_date: e.target.value || null })} /></label><FlightTimePicker label="起飛當地時間" value={departureTime} onChange={setDepartureTime} /></div>
          <label className="planning-label">起飛地時區<input list="planning-timezones" className="glass-input" value={flight.departure_timezone} onChange={e => setFlight({ ...flight, departure_timezone: e.target.value })} /></label>
          <PlacePicker itineraryId={trip.id} label="抵達機場／航廈（選填）" value={flight.destination} onChange={p => setFlight({ ...flight, destination: p })} />
          <div className="planning-two"><label className="planning-label">抵達日期<input type="date" className="glass-input" value={flight.arrival_date || ''} onChange={e => setFlight({ ...flight, arrival_date: e.target.value || null })} /></label><FlightTimePicker label="抵達當地時間" value={arrivalTime} onChange={setArrivalTime} /></div>
          <label className="planning-label">抵達地時區<input list="planning-timezones" className="glass-input" value={flight.arrival_timezone} onChange={e => setFlight({ ...flight, arrival_timezone: e.target.value })} /></label>
          {flight.kind === 'departure' && <label className="planning-label">建議提早抵達機場（分鐘，可調整）<input type="number" min="0" max="480" className="glass-input" value={flight.airport_buffer_minutes} onChange={e => setFlight({ ...flight, airport_buffer_minutes: Number(e.target.value) })} /></label>}
          <div className="planning-two"><button className="btn-secondary" type="button" onClick={() => setFlight(null)}>取消編輯</button><button className="btn-primary" type="button" onClick={addFlight}>加入航班</button></div>
        </div> : <div className="planning-two"><button className="btn-secondary" type="button" onClick={() => newFlight('arrival')}><Plus size={16} />新增去程航班</button><button className="btn-secondary" type="button" onClick={() => newFlight('departure')}><Plus size={16} />新增回程航班</button></div>}
      </>}
      {error && <p className="planning-error" role="alert">{error}</p>}
      <div className="planning-modal-footer"><button className="btn-secondary" type="button" onClick={close} disabled={busy}>取消</button><button className="btn-primary" type="button" onClick={() => void saveDraft()} disabled={busy}>{busy ? '儲存中…' : '儲存輔助資料'}</button></div>
    </section>
  </div>, document.body);
}
