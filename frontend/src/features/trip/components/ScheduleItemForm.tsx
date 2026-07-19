import React, { useState } from 'react';
import type { FormEvent } from 'react';
import { useTripStore } from '@/stores';
import type { ItineraryItem, NominatimSuggestion } from '@/types';
import { useLocationSearch } from '../hooks/useLocationSearch';
import { TRANSPORT_MODES } from '../transportModes';
import LocationAutocomplete from './LocationAutocomplete';

interface ScheduleItemFormProps {
  itineraryId: number;
  dayNumber: number;
  onClose: () => void;
  /** When provided, the form edits this item instead of creating a new one. */
  item?: ItineraryItem;
}

const labelStyle: React.CSSProperties = { fontSize: '11px', color: 'var(--text-secondary)' };

const ScheduleItemForm: React.FC<ScheduleItemFormProps> = ({
  itineraryId,
  dayNumber,
  onClose,
  item,
}) => {
  const addItem = useTripStore((state) => state.addItem);
  const updateItem = useTripStore((state) => state.updateItem);
  const trip = useTripStore((state) => state.trip);
  const { suggestions, loading: loadingSuggestions, search, clearSuggestions } = useLocationSearch();
  const isEditing = item !== undefined;

  const dayCount = (() => {
    if (!trip?.start_date || !trip?.end_date) return 1;
    const diff = Math.abs(new Date(trip.end_date).getTime() - new Date(trip.start_date).getTime());
    return Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1 || 1;
  })();

  const [name, setName] = useState(item?.name ?? '');
  const [searchQuery, setSearchQuery] = useState(item?.name ?? '');
  const [time, setTime] = useState(item?.time ?? '');
  const [cost, setCost] = useState(item?.cost ? String(item.cost) : '');
  const [address, setAddress] = useState(item?.address ?? '');
  const [lat, setLat] = useState<number | null>(item?.latitude ?? null);
  const [lng, setLng] = useState<number | null>(item?.longitude ?? null);
  const [note, setNote] = useState(item?.description ?? '');
  const [transportMode, setTransportMode] = useState(item?.transport_mode ?? '');
  const [transportNote, setTransportNote] = useState(item?.transport_note ?? '');
  const [editDay, setEditDay] = useState(item?.day_number ?? dayNumber);
  const [submitting, setSubmitting] = useState(false);

  const handleQueryChange = (query: string) => {
    setSearchQuery(query);
    setName(query);
    search(query);
  };

  const handleSelectSuggestion = (suggestion: NominatimSuggestion) => {
    const label = suggestion.display_name.split(',')[0];
    setName(label);
    setSearchQuery(label);
    setAddress(suggestion.display_name);
    setLat(parseFloat(suggestion.lat));
    setLng(parseFloat(suggestion.lon));
    clearSuggestions();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim()) return;

    setSubmitting(true);
    try {
      if (isEditing) {
        // Moving to another day appends the item at that day's end.
        const dayChanged = editDay !== item.day_number;
        const targetDayMax = dayChanged
          ? Math.max(
              -1,
              ...(trip?.items ?? [])
                .filter((it) => it.day_number === editDay)
                .map((it) => it.sort_order),
            )
          : null;
        await updateItem(item.id, {
          day_number: editDay,
          name,
          description: note || null,
          address: address || null,
          latitude: lat,
          longitude: lng,
          time: time || null,
          transport_mode: transportMode || null,
          transport_note: transportNote || null,
          cost: parseFloat(cost) || 0,
          sort_order: targetDayMax !== null ? targetDayMax + 1 : item.sort_order,
        });
      } else {
        await addItem(itineraryId, {
          day_number: dayNumber,
          name,
          description: note || null,
          address: address || null,
          latitude: lat,
          longitude: lng,
          time: time || null,
          transport_mode: transportMode || null,
          transport_note: transportNote || null,
          cost: parseFloat(cost) || 0,
        });
      }
      onClose();
    } catch (err) {
      console.error('Failed to save item:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="glass-card" style={{ marginBottom: '20px', border: '1px solid var(--accent-color)' }}>
      <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '12px' }}>
        {isEditing ? `編輯 Day ${item.day_number} 景點 / 活動` : `新增 Day ${dayNumber} 景點 / 活動`}
      </h3>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <LocationAutocomplete
          value={searchQuery}
          suggestions={suggestions}
          loading={loadingSuggestions}
          onChange={handleQueryChange}
          onSelect={handleSelectSuggestion}
        />

        {isEditing && dayCount > 1 && (
          <div>
            <label style={labelStyle}>天數</label>
            <select
              className="glass-input"
              value={editDay}
              onChange={(e) => setEditDay(Number(e.target.value))}
            >
              {Array.from({ length: dayCount }, (_, i) => i + 1).map((day) => (
                <option key={day} value={day}>
                  Day {day}
                </option>
              ))}
            </select>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <div>
            <label style={labelStyle}>抵達時間</label>
            <input
              type="time"
              className="glass-input"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>
          <div>
            <label style={labelStyle}>預估花費</label>
            <input
              type="number"
              placeholder="TWD"
              className="glass-input"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <div>
            <label style={labelStyle}>前往方式 (選填)</label>
            <select
              className="glass-input"
              value={transportMode}
              onChange={(e) => setTransportMode(e.target.value)}
            >
              <option value="">未指定</option>
              {TRANSPORT_MODES.map((mode) => (
                <option key={mode.value} value={mode.value}>
                  {mode.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>交通備註 (選填)</label>
            <input
              type="text"
              placeholder="如：約20分鐘 / 搭乘山手線"
              className="glass-input"
              value={transportNote}
              onChange={(e) => setTransportNote(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label style={labelStyle}>景點地址 (選填)</label>
          <input
            type="text"
            placeholder="地址"
            className="glass-input"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </div>

        <div>
          <label style={labelStyle}>備註說明 (選填)</label>
          <textarea
            placeholder="如：門票資訊、必吃美食..."
            className="glass-input"
            style={{ height: '60px', resize: 'none' }}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '4px' }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              clearSuggestions();
              onClose();
            }}
          >
            取消
          </button>
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? '儲存中...' : '儲存'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ScheduleItemForm;
