import React, { useState } from 'react';
import type { FormEvent } from 'react';
import { DayPicker } from 'react-day-picker';
import type { DateRange } from 'react-day-picker';
import { zhTW } from 'react-day-picker/locale';
import Modal from '@/components/Modal';
import { useItinerariesStore } from '@/stores';
import type { ItinerarySummary } from '@/types';

interface CreateTripModalProps {
  onClose: () => void;
  onCreated: () => void;
  /** When provided, the modal edits this trip instead of creating a new one. */
  trip?: ItinerarySummary;
}

/** Parses YYYY-MM-DD as a local date; new Date(string) would shift by timezone. */
const parseLocalDate = (value: string | null | undefined): Date | undefined => {
  if (!value) return undefined;
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
};

/** Serializes a local date to YYYY-MM-DD; toISOString() would shift by timezone. */
const toYMD = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const initialRange = (trip?: ItinerarySummary): DateRange | undefined => {
  const from = parseLocalDate(trip?.start_date);
  if (!from) return undefined;
  return { from, to: parseLocalDate(trip?.end_date) ?? from };
};

const CreateTripModal: React.FC<CreateTripModalProps> = ({ onClose, onCreated, trip }) => {
  const createItinerary = useItinerariesStore((state) => state.createItinerary);
  const updateItinerary = useItinerariesStore((state) => state.updateItinerary);
  const isEditing = trip !== undefined;

  const [title, setTitle] = useState(trip?.title ?? '');
  const [description, setDescription] = useState(trip?.description ?? '');
  const [range, setRange] = useState<DateRange | undefined>(() => initialRange(trip));
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const dayCount =
    range?.from && range?.to
      ? Math.round((range.to.getTime() - range.from.getTime()) / (1000 * 60 * 60 * 24)) + 1
      : range?.from
        ? 1
        : 0;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    // A range with only a start day counts as a one-day trip.
    const start = range?.from ? toYMD(range.from) : null;
    const end = range?.to ? toYMD(range.to) : start;
    const payload = {
      title,
      description: description || null,
      start_date: start,
      end_date: end,
    };
    try {
      if (isEditing) {
        await updateItinerary(trip.id, payload);
      } else {
        await createItinerary(payload);
      }
      onCreated();
    } catch (err) {
      setError((err as Error).message || (isEditing ? '更新失敗，請稍後再試' : '建立失敗，請稍後再試'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title={isEditing ? '編輯行程' : '規劃新行程'} onClose={onClose} maxWidth={400}>
      {error && (
        <div style={{ color: 'var(--danger-color)', fontSize: '13px', marginBottom: '12px' }}>
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <input
          type="text"
          placeholder="行程名稱 (例如：東京五天四夜櫻花季)"
          className="glass-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
        <textarea
          placeholder="行程簡介 (選填)"
          className="glass-input"
          style={{ height: '80px', resize: 'none' }}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '4px',
            }}
          >
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              {range?.from
                ? `出發 ${toYMD(range.from)} → 結束 ${toYMD(range.to ?? range.from)}（${dayCount} 天）`
                : '點選日期選擇起訖（選填）'}
            </span>
            {range?.from && (
              <button
                type="button"
                onClick={() => setRange(undefined)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent-color)',
                  cursor: 'pointer',
                  fontSize: '12px',
                  padding: '2px 4px',
                }}
              >
                清除日期
              </button>
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <DayPicker
              mode="range"
              locale={zhTW}
              selected={range}
              onSelect={setRange}
              defaultMonth={range?.from}
            />
          </div>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '8px',
            marginTop: '8px',
          }}
        >
          <button type="button" className="btn-secondary" onClick={onClose}>
            取消
          </button>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? (isEditing ? '更新中...' : '建立中...') : isEditing ? '儲存' : '建立'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default CreateTripModal;
