import React from 'react';
import { Calendar, LogOut, Pencil, Trash2, Users } from 'lucide-react';
import type { ItinerarySummary } from '@/types';

interface TripCardProps {
  trip: ItinerarySummary;
  onSelect: (id: number) => void;
  onEdit: (trip: ItinerarySummary) => void;
  onLeave: (trip: ItinerarySummary) => void;
  onDelete: (trip: ItinerarySummary) => void;
}

const iconButtonStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--text-muted)',
  cursor: 'pointer',
  padding: '6px',
  display: 'flex',
  alignItems: 'center',
};

const formatDate = (value: string | null): string =>
  value ? new Date(value).toLocaleDateString() : '';

const TripCard: React.FC<TripCardProps> = ({ trip, onSelect, onEdit, onLeave, onDelete }) => {
  const start = formatDate(trip.start_date);
  const end = formatDate(trip.end_date);

  const handleEdit = (event: React.MouseEvent) => {
    event.stopPropagation();
    onEdit(trip);
  };

  const handleLeave = (event: React.MouseEvent) => {
    event.stopPropagation();
    onLeave(trip);
  };

  const handleDelete = (event: React.MouseEvent) => {
    event.stopPropagation();
    onDelete(trip);
  };

  return (
    <div
      className="glass-card"
      onClick={() => onSelect(trip.id)}
      style={{
        cursor: 'pointer',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <div style={{ flex: 1, marginRight: '16px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '6px' }}>{trip.title}</h3>
        {trip.description && (
          <p
            style={{
              color: 'var(--text-secondary)',
              fontSize: '13px',
              marginBottom: '8px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {trip.description}
          </p>
        )}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '4px 12px',
            color: 'var(--text-muted)',
            fontSize: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
            <Calendar size={13} />
            {start ? `${start} - ${end}` : '未定日期'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
            <Users size={13} />
            {trip.members?.length || 1} 人
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
        <button onClick={handleEdit} style={iconButtonStyle} title="編輯行程">
          <Pencil size={16} />
        </button>
        <button
          onClick={handleLeave}
          style={{ ...iconButtonStyle, color: 'var(--warning-color)' }}
          title="退出行程"
        >
          <LogOut size={16} />
        </button>
        <button
          onClick={handleDelete}
          style={{ ...iconButtonStyle, color: 'var(--danger-color)' }}
          title="刪除行程"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
};

export default TripCard;
