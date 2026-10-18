import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { MapPin, Search, X } from 'lucide-react';
import { emptyPlace, mapsSearch, searchPlanningPlaces } from '@/api/planning';
import type { Place, PlaceResult } from '@/api/planning';
import { useTripStore } from '@/stores';

interface Props {
  itineraryId: number;
  label: string;
  value: Place | null;
  onChange: (value: Place | null) => void;
}

export default function PlacePicker({ itineraryId, label, value, onChange }: Props) {
  const id = useId();
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const automatic = useTripStore(s => s.trip?.id === itineraryId && !!s.planning?.live_maps);
  const sequence = useRef(0);
  const latest = useRef({ value, onChange });
  latest.current = { value, onChange };
  const search = useCallback(async (text: string, autoFill: boolean) => {
    const keyword = text.trim();
    if (!keyword) return;
    const requestId = ++sequence.current;
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await searchPlanningPlaces(itineraryId, keyword);
      const current = latest.current.value;
      if (sequence.current === requestId && current?.name.trim() === keyword) {
        const candidates = response.places;
        // Only a single match can fill an empty address without confirmation.
        // Ambiguous branches remain selectable, and manual addresses stay intact.
        if (autoFill && candidates.length === 1 && candidates[0].address && !current.address.trim()) {
          const match = candidates[0];
          latest.current.onChange({ ...current, address: match.address, latitude: match.latitude,
            longitude: match.longitude, place_id: match.place_id });
          setResults([]);
          setNotice(`已自動補上「${match.name}」的詳細地址，請確認地點。資料：${match.source}`);
        } else {
          setResults(candidates);
          if (candidates.length) setNotice('找到以下地點，請選取正確分店／入口以補齊詳細地址。');
        }
        if (!candidates.length) setError('找不到地點，可加上城市／地址，或先手動填寫。');
      }
    } catch (e) {
      if (sequence.current === requestId) setError(e instanceof Error ? e.message : '搜尋失敗');
    } finally { if (sequence.current === requestId) setBusy(false); }
  }, [itineraryId]);

  useEffect(() => {
    // Public Nominatim does not allow autocomplete. Only Google is automatic.
    if (!automatic || composing || !query || query.trim().length < 2) return;
    const timer = window.setTimeout(() => void search(query, true), 900);
    return () => window.clearTimeout(timer);
  }, [automatic, composing, query, search]);

  useEffect(() => () => { sequence.current++; }, [itineraryId]);

  const cancelLookup = () => {
    sequence.current++; setQuery(null); setResults([]); setBusy(false); setError(''); setNotice('');
  };
  const searchNow = () => {
    setQuery(null);
    void search(value?.name || '', true);
  };
  return <div className="planning-place">
    <label htmlFor={id} className="planning-label">{label}</label>
    <div className="planning-input-row">
      <input id={id} className="glass-input" autoComplete="off" placeholder={automatic ? '輸入地點，自動查找詳細地址' : '輸入名稱或地址，按搜尋補齊地址'} value={value?.name ?? ''} onChange={e => {
        cancelLookup(); setQuery(e.target.value);
        onChange(e.target.value ? { ...emptyPlace(), name: e.target.value } : null);
      }} onCompositionStart={() => { sequence.current++; setBusy(false); setComposing(true); }} onCompositionEnd={e => {
        setComposing(false); setQuery(e.currentTarget.value);
      }} onKeyDown={e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (!composing && !e.nativeEvent.isComposing) searchNow();
        }
      }} />
      <button type="button" className="planning-icon" disabled={busy || composing || !value?.name.trim()} onClick={searchNow} aria-label={`搜尋${label}`}><Search size={17} /></button>
      {value && <button type="button" className="planning-icon" onClick={() => { cancelLookup(); onChange(null); }} aria-label={`清除${label}`}><X size={17} /></button>}
    </div>
    {automatic && <span className="planning-muted">輸入後稍候會查找地址；同名地點會列出選項。</span>}
    {busy && <span className="planning-muted" role="status">搜尋中…</span>}
    {notice && <p className="planning-muted" role="status">{notice}</p>}
    {error && <p className="planning-error" role="alert">{error}</p>}
    {results.length > 0 && <div className="suggestions-list">{results.map(p => <button type="button" className="suggestion-item planning-place-result" key={p.place_id ?? p.address} onClick={() => {
      cancelLookup(); onChange({ name: p.name, address: p.address, latitude: p.latitude, longitude: p.longitude, place_id: p.place_id });
    }}><strong>{p.name}</strong><span>{p.address}</span></button>)}<p className="planning-muted">地點資料：{results[0].source}</p></div>}
    {value && <>
      <label htmlFor={`${id}-address`} className="planning-label">詳細地址（可修改）</label>
      <input id={`${id}-address`} className="glass-input planning-address" aria-label={`${label}地址`} placeholder="搜尋後自動補上，也可手動填寫" value={value.address} onChange={e => {
        cancelLookup(); onChange({ ...value, address: e.target.value, latitude: null, longitude: null, place_id: null });
      }} />
      <div className="planning-muted"><MapPin size={12} /> {value.latitude !== null ? '已定位' : '可先存地點；搜尋選取位置後可比較距離'} <a href={mapsSearch(value)} target="_blank" rel="noopener noreferrer">查看地圖</a></div>
    </>}
  </div>;
}
