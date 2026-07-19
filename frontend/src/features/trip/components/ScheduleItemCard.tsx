import React from 'react';
import { Clock, MapPin, Navigation, Pencil, Trash2 } from 'lucide-react';
import type { ItineraryItem } from '@/types';
import { findTransportMode } from '../transportModes';

interface ScheduleItemCardProps {
  item: ItineraryItem;
  onEdit: (item: ItineraryItem) => void;
  onDelete: (itemId: number) => void;
  /** Viewers see the card without edit/delete buttons. */
  readOnly?: boolean;
}

const buildMapsUrl = (item: ItineraryItem): string => {
  if (item.latitude && item.longitude) {
    return `https://www.google.com/maps/dir/?api=1&destination=${item.latitude},${item.longitude}`;
  }
  const query = item.address || item.name;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
};

const TransportPill: React.FC<{ item: ItineraryItem }> = ({ item }) => {
  const mode = findTransportMode(item.transport_mode);
  if (!mode) return null;
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        alignSelf: 'flex-start',
        background: 'rgba(255, 255, 255, 0.04)',
        border: '1px solid var(--glass-border)',
        borderRadius: '999px',
        padding: '3px 10px',
        fontSize: '11px',
        color: 'var(--text-secondary)',
      }}
    >
      <mode.Icon size={12} />
      {mode.label}
      {item.transport_note && <span>· {item.transport_note}</span>}
    </div>
  );
};

const ScheduleItemCard: React.FC<ScheduleItemCardProps> = ({ item, onEdit, onDelete, readOnly }) => (
  <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
    <TransportPill item={item} />
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div style={{ display: 'flex', gap: '10px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '46px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '2px',
              color: 'var(--accent-color)',
              fontWeight: 700,
              fontSize: '13px',
            }}
          >
            <Clock size={12} />
            {item.time || '--:--'}
          </div>
        </div>

        <div>
          <h4 style={{ fontSize: '16px', fontWeight: 700 }}>{item.name}</h4>
          {item.address && (
            <p
              style={{
                fontSize: '11px',
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                gap: '2px',
                marginTop: '2px',
              }}
            >
              <MapPin size={11} />
              {item.address.split(',')[0]}
            </p>
          )}
        </div>
      </div>

      {!readOnly && (
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '2px' }}>
        <button
          onClick={() => onEdit(item)}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: '4px',
          }}
          title="編輯景點"
        >
          <Pencil size={16} />
        </button>
        <button
          onClick={() => onDelete(item.id)}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: '4px',
          }}
          title="刪除景點"
        >
          <Trash2 size={16} />
        </button>
      </div>
      )}
    </div>

    {item.description && (
      <div
        style={{
          background: 'rgba(255, 255, 255, 0.04)',
          borderRadius: '8px',
          padding: '10px',
          fontSize: '13px',
          color: 'var(--text-secondary)',
        }}
      >
        {item.description}
      </div>
    )}

    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderTop: '1px solid var(--glass-border)',
        paddingTop: '8px',
        marginTop: '4px',
      }}
    >
      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
        {item.cost > 0 ? `預估花費: $${item.cost}` : '無預估花費'}
      </span>
      <a
        href={buildMapsUrl(item)}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-primary"
        style={{
          width: 'auto',
          padding: '6px 12px',
          fontSize: '12px',
          borderRadius: '8px',
          textDecoration: 'none',
        }}
      >
        <Navigation size={12} />
        導航
      </a>
    </div>
  </div>
);

export default ScheduleItemCard;
