import { useState } from 'react';
import { CalendarCheck, Check, Ticket } from 'lucide-react';
import { useTripStore } from '@/stores';
import { emptyAssistance, progressLabels, reservationLabels, ticketLabels } from '@/api/planning';
import type { ItemAssistance } from '@/api/planning';
import type { ItineraryItem } from '@/types';

export default function ItemAssistancePanel({ item, readOnly = false }: { item: ItineraryItem; readOnly?: boolean }) {
  const planning = useTripStore(s => s.planning);
  const save = useTripStore(s => s.savePlanning);
  const value = planning?.data.items[item.id] || emptyAssistance();
  const [draft, setDraft] = useState<ItemAssistance | null>(null);
  const [base, setBase] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!planning) return null;
  const persist = async (next: ItemAssistance, editing = false) => {
    setBusy(true); setError('');
    try {
      const current = useTripStore.getState().planning!;
      if (editing && JSON.stringify(current.data.items[item.id] || emptyAssistance()) !== base) throw new Error('這個景點的輔助資料已被更新，請重新展開編輯。');
      await save({ ...current.data, items: { ...current.data.items, [item.id]: next } });
      setDraft(null);
    } catch (e) { setError(e instanceof Error ? e.message : '儲存失敗'); }
    finally { setBusy(false); }
  };
  const deadlineLocal = (date: string | null) => {
    if (!date) return '';
    const parsed = new Date(date);
    return new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  };
  return <div className="planning-item-assistance">
    <div className="planning-item-summary">
      <label className="planning-progress"><span className="sr-only">{item.name}前往狀態</span><select aria-label={`${item.name}前往狀態`} value={value.progress} disabled={readOnly || busy} onChange={e => void persist({ ...value, progress: e.target.value as ItemAssistance['progress'] })}>{Object.entries(progressLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      {value.progress === 'done' && <Check size={14} />}
      {value.ticket_status !== 'none' && <span className={`planning-pill ${['required', 'reserved'].includes(value.ticket_status) ? 'warning' : ''}`}><Ticket size={12} />{ticketLabels[value.ticket_status]}</span>}
      {value.reservation_status !== 'none' && <span className={`planning-pill ${value.reservation_status === 'todo' ? 'warning' : ''}`}><CalendarCheck size={12} />{reservationLabels[value.reservation_status]}</span>}
      {(value.locked || value.appointment_time) && <span className="planning-pill">固定 {value.appointment_time || item.time || '順序'}</span>}
      {!readOnly && <button className="planning-link-button" type="button" onClick={() => {
        if (draft) { setDraft(null); return; }
        setDraft(structuredClone(value)); setBase(JSON.stringify(value)); setError('');
      }}>{draft ? '收起' : '購票／訂位與停留'}</button>}
    </div>
    {value.ticket_deadline && value.ticket_status !== 'purchased' && <p className="planning-warning">購票／預約期限：{new Date(value.ticket_deadline).toLocaleString('zh-TW')}</p>}
    {readOnly && <div className="planning-actions">{value.ticket_url && <a target="_blank" rel="noopener noreferrer" href={value.ticket_url}>購票資訊</a>}{value.reservation_url && <a target="_blank" rel="noopener noreferrer" href={value.reservation_url}>訂位入口</a>}{value.reservation_phone && <span>{value.reservation_phone}</span>}{value.booking_notes && <p>{value.booking_notes}</p>}</div>}
    {draft && <form className="planning-editor" onSubmit={e => { e.preventDefault(); void persist(draft, true); }}>
      <div className="planning-two"><label className="planning-label">預估停留（分鐘）<input className="glass-input" type="number" min="0" max="1440" required value={draft.duration_minutes} onChange={e => setDraft({ ...draft, duration_minutes: Number(e.target.value) })} /></label><label className="planning-label">固定預約時間（選填）<input className="glass-input" type="time" value={draft.appointment_time || ''} onChange={e => setDraft({ ...draft, appointment_time: e.target.value || null })} /></label></div>
      <label className="planning-checkbox"><input type="checkbox" checked={draft.locked} onChange={e => setDraft({ ...draft, locked: e.target.checked })} />鎖定此景點位置，順路建議不移動</label>
      <label className="planning-label">購票／預約狀態<select className="glass-input" value={draft.ticket_status} onChange={e => setDraft({ ...draft, ticket_status: e.target.value as ItemAssistance['ticket_status'] })}>{Object.entries(ticketLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label className="planning-label">購票／活動官網連結（選填）<input className="glass-input" type="url" placeholder="https://" value={draft.ticket_url} onChange={e => setDraft({ ...draft, ticket_url: e.target.value })} /></label>
      <label className="planning-label">購票／預約期限（選填，使用本機時區）<input className="glass-input" type="datetime-local" value={deadlineLocal(draft.ticket_deadline)} onChange={e => setDraft({ ...draft, ticket_deadline: e.target.value ? new Date(e.target.value).toISOString() : null })} /></label>
      <label className="planning-label">餐廳訂位狀態<select className="glass-input" value={draft.reservation_status} onChange={e => setDraft({ ...draft, reservation_status: e.target.value as ItemAssistance['reservation_status'] })}>{Object.entries(reservationLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label className="planning-label">分店訂位／官網連結（選填）<input className="glass-input" type="url" placeholder="https://" value={draft.reservation_url} onChange={e => setDraft({ ...draft, reservation_url: e.target.value })} /></label>
      <div className="planning-two"><label className="planning-label">訂位電話<input className="glass-input" type="tel" value={draft.reservation_phone} onChange={e => setDraft({ ...draft, reservation_phone: e.target.value })} /></label><label className="planning-label">用餐人數<input className="glass-input" type="number" min="1" max="100" value={draft.party_size ?? ''} onChange={e => setDraft({ ...draft, party_size: e.target.value ? Number(e.target.value) : null })} /></label></div>
      <label className="planning-label">訂位方式／確認資訊<textarea className="glass-input" value={draft.booking_notes} placeholder="例如：官網開放日前 30 天訂位；已確認 2 人" onChange={e => setDraft({ ...draft, booking_notes: e.target.value })} /></label>
      <p className="planning-muted">完成訂位後選「已訂位」並填固定預約時間。沒有可靠資訊時，購票需求保留待確認。</p>
      <div className="planning-two"><button className="btn-secondary" type="button" onClick={() => setDraft(null)}>取消</button><button className="btn-primary" type="submit" disabled={busy}>{busy ? '儲存中…' : '儲存景點輔助資料'}</button></div>
    </form>}
    {error && <p className="planning-error" role="alert">{error}</p>}
  </div>;
}
