import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, Plus, RefreshCw } from 'lucide-react';
import { useTripStore } from '@/stores';
import type { ItineraryItem } from '@/types';
import { useTripContext } from '../context';
import InviteCode from './InviteCode';
import PresenceBar from './PresenceBar';
import ScheduleItemForm from './ScheduleItemForm';
import ScheduleItemCard from './ScheduleItemCard';

const getDayCount = (start: string | null, end: string | null): number => {
  if (!start || !end) return 1;
  const diff = Math.abs(new Date(end).getTime() - new Date(start).getTime());
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
  return days || 1;
};

const sortByTime = (items: ItineraryItem[]): ItineraryItem[] =>
  [...items].sort((a, b) => {
    if (a.time && b.time) return a.time.localeCompare(b.time);
    if (a.time) return -1;
    if (b.time) return 1;
    return a.sort_order - b.sort_order;
  });

const SchedulePanel: React.FC = () => {
  const navigate = useNavigate();
  const { itineraryId, activeUsers } = useTripContext();
  const trip = useTripStore((state) => state.trip);
  const refresh = useTripStore((state) => state.refresh);
  const removeItem = useTripStore((state) => state.removeItem);

  const [selectedDay, setSelectedDay] = useState(1);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingItem, setEditingItem] = useState<ItineraryItem | null>(null);

  const daysList = useMemo(
    () =>
      Array.from(
        { length: getDayCount(trip?.start_date ?? null, trip?.end_date ?? null) },
        (_, i) => i + 1,
      ),
    [trip?.start_date, trip?.end_date],
  );

  const sortedItems = useMemo(
    () => sortByTime((trip?.items ?? []).filter((item) => item.day_number === selectedDay)),
    [trip?.items, selectedDay],
  );

  const handleDelete = (itemId: number) => {
    if (!window.confirm('確定要刪除此行程景點嗎？')) return;
    void removeItem(itemId);
  };

  const handleEdit = (item: ItineraryItem) => {
    setShowAddForm(false);
    setEditingItem(item);
  };

  return (
    <div className="animate-slide-up" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <div className="app-header">
        <button
          onClick={() => navigate('/trips')}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <ArrowLeft size={20} />
        </button>
        <div style={{ flex: 1, textAlign: 'center', padding: '0 8px', overflow: 'hidden' }}>
          <h2
            style={{
              fontSize: '16px',
              fontWeight: 800,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {trip?.title || '載入中...'}
          </h2>
          {trip && <InviteCode code={trip.invite_code} />}
        </div>
        <button
          onClick={() => void refresh()}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            padding: '6px',
          }}
          title="同步最新資料"
        >
          <RefreshCw size={18} />
        </button>
      </div>

      <div className="content-area">
        <PresenceBar users={activeUsers} />

        <div
          style={{
            display: 'flex',
            gap: '8px',
            overflowX: 'auto',
            paddingBottom: '8px',
            marginBottom: '16px',
            scrollbarWidth: 'none',
          }}
        >
          {daysList.map((day) => (
            <button
              key={day}
              onClick={() => setSelectedDay(day)}
              style={{
                padding: '8px 16px',
                borderRadius: '12px',
                border: '1px solid var(--glass-border)',
                background: selectedDay === day ? 'var(--accent-gradient)' : 'var(--glass-bg)',
                color: selectedDay === day ? 'white' : 'var(--text-primary)',
                fontWeight: 600,
                fontSize: '14px',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              Day {day}
            </button>
          ))}
        </div>

        <div className="split-layout">
          <div className="split-aside">
            {!showAddForm && !editingItem && (
              <button
                className="btn-primary"
                onClick={() => setShowAddForm(true)}
                style={{ marginBottom: '20px' }}
              >
                <Plus size={18} />
                規劃新景點/活動
              </button>
            )}

            {showAddForm && (
              <ScheduleItemForm
                itineraryId={itineraryId}
                dayNumber={selectedDay}
                onClose={() => setShowAddForm(false)}
              />
            )}

            {editingItem && (
              <ScheduleItemForm
                key={editingItem.id}
                item={editingItem}
                itineraryId={itineraryId}
                dayNumber={editingItem.day_number}
                onClose={() => setEditingItem(null)}
              />
            )}
          </div>

          <div className="split-main">
            {sortedItems.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-secondary)' }}>
                <MapPin size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
                <p>Day {selectedDay} 尚未規劃任何景點</p>
                <p style={{ fontSize: '12px', marginTop: '4px' }}>
                  點選「規劃新景點/活動」新增第一個目的地！
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {sortedItems.map((item) => (
                  <ScheduleItemCard
                    key={item.id}
                    item={item}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SchedulePanel;
