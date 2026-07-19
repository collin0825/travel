import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import type { ItineraryItem } from '@/types';
import ScheduleItemCard from './ScheduleItemCard';

interface SortableScheduleItemProps {
  item: ItineraryItem;
  onEdit: (item: ItineraryItem) => void;
  onDelete: (itemId: number) => void;
}

/**
 * Sortable wrapper around ScheduleItemCard. Drag listeners live on the grip
 * handle only, so the card's buttons and links stay clickable.
 */
const SortableScheduleItem: React.FC<SortableScheduleItemProps> = ({ item, onEdit, onDelete }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        display: 'flex',
        alignItems: 'stretch',
        gap: '4px',
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      }}
    >
      <button
        {...attributes}
        {...listeners}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--text-muted)',
          cursor: 'grab',
          padding: '0 2px',
          display: 'flex',
          alignItems: 'center',
          touchAction: 'none',
        }}
        title="拖曳排序"
      >
        <GripVertical size={16} />
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <ScheduleItemCard item={item} onEdit={onEdit} onDelete={onDelete} />
      </div>
    </div>
  );
};

export default SortableScheduleItem;
