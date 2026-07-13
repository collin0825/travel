import React, { useState } from 'react';
import type { FormEvent } from 'react';
import Modal from '@/components/Modal';
import { useItinerariesStore } from '@/stores';
import type { ItinerarySummary } from '@/types';

interface CreateTripModalProps {
  onClose: () => void;
  onCreated: () => void;
  /** When provided, the modal edits this trip instead of creating a new one. */
  trip?: ItinerarySummary;
}

/** Trims a date-ish string down to the YYYY-MM-DD an <input type="date"> expects. */
const toDateInput = (value: string | null | undefined): string =>
  value ? value.slice(0, 10) : '';

const CreateTripModal: React.FC<CreateTripModalProps> = ({ onClose, onCreated, trip }) => {
  const createItinerary = useItinerariesStore((state) => state.createItinerary);
  const updateItinerary = useItinerariesStore((state) => state.updateItinerary);
  const isEditing = trip !== undefined;

  const [title, setTitle] = useState(trip?.title ?? '');
  const [description, setDescription] = useState(trip?.description ?? '');
  const [startDate, setStartDate] = useState(toDateInput(trip?.start_date));
  const [endDate, setEndDate] = useState(toDateInput(trip?.end_date));
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    const payload = {
      title,
      description: description || null,
      start_date: startDate || null,
      end_date: endDate || null,
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
    <Modal title={isEditing ? '編輯行程' : '規劃新行程'} onClose={onClose}>
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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <div>
            <label
              style={{
                fontSize: '11px',
                color: 'var(--text-secondary)',
                display: 'block',
                marginBottom: '4px',
              }}
            >
              出發日期
            </label>
            <input
              type="date"
              className="glass-input"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <label
              style={{
                fontSize: '11px',
                color: 'var(--text-secondary)',
                display: 'block',
                marginBottom: '4px',
              }}
            >
              結束日期
            </label>
            <input
              type="date"
              className="glass-input"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
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
