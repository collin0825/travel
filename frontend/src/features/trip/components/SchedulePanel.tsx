import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, Plus, RefreshCw, Users } from 'lucide-react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { CollisionDetection, DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useTripStore } from '@/stores';
import type { ItineraryItem } from '@/types';
import { useTripContext } from '../context';
import InviteCode from './InviteCode';
import PresenceBar from './PresenceBar';
import ScheduleItemForm from './ScheduleItemForm';
import ScheduleItemCard from './ScheduleItemCard';
import SortableScheduleItem from './SortableScheduleItem';
import MembersModal from './MembersModal';

const getDayCount = (start: string | null, end: string | null): number => {
  if (!start || !end) return 1;
  const diff = Math.abs(new Date(end).getTime() - new Date(start).getTime());
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
  return days || 1;
};

/** Manual order is the display source of truth; time is a label only. */
const sortByOrder = (items: ItineraryItem[]): ItineraryItem[] =>
  [...items].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);

const dayDroppableId = (day: number) => `day-${day}`;

/** Prefer whatever is directly under the pointer (day tabs), else closest item. */
const collisionDetection: CollisionDetection = (args) => {
  const withPointer = pointerWithin(args);
  return withPointer.length > 0 ? withPointer : closestCenter(args);
};

interface DayTabProps {
  day: number;
  selected: boolean;
  dragging: boolean;
  onSelect: (day: number) => void;
}

const DayTabDroppable: React.FC<DayTabProps> = ({ day, selected, dragging, onSelect }) => {
  const { isOver, setNodeRef } = useDroppable({ id: dayDroppableId(day) });
  return (
    <button
      ref={setNodeRef}
      onClick={() => onSelect(day)}
      style={{
        padding: '8px 16px',
        borderRadius: '12px',
        border:
          dragging && isOver ? '1px dashed var(--accent-color)' : '1px solid var(--glass-border)',
        background: selected ? 'var(--accent-gradient)' : 'var(--glass-bg)',
        color: selected ? 'white' : 'var(--text-primary)',
        fontWeight: 600,
        fontSize: '14px',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      Day {day}
    </button>
  );
};

const SchedulePanel: React.FC = () => {
  const navigate = useNavigate();
  const { itineraryId, activeUsers } = useTripContext();
  const trip = useTripStore((state) => state.trip);
  const refresh = useTripStore((state) => state.refresh);
  const removeItem = useTripStore((state) => state.removeItem);
  const reorderItems = useTripStore((state) => state.reorderItems);

  const [selectedDay, setSelectedDay] = useState(1);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingItem, setEditingItem] = useState<ItineraryItem | null>(null);
  const [activeItem, setActiveItem] = useState<ItineraryItem | null>(null);
  const [showMembers, setShowMembers] = useState(false);

  // Server enforces permissions; this only hides editing affordances for viewers.
  const canEdit = trip?.my_role !== 'viewer';

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const daysList = useMemo(
    () =>
      Array.from(
        { length: getDayCount(trip?.start_date ?? null, trip?.end_date ?? null) },
        (_, i) => i + 1,
      ),
    [trip?.start_date, trip?.end_date],
  );

  const sortedItems = useMemo(
    () => sortByOrder((trip?.items ?? []).filter((item) => item.day_number === selectedDay)),
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

  const handleDragStart = (event: DragStartEvent) => {
    setActiveItem(sortedItems.find((item) => item.id === event.active.id) ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveItem(null);
    const { active, over } = event;
    if (!over || !trip) return;

    const currentIds = sortedItems.map((item) => item.id);

    if (typeof over.id === 'string' && over.id.startsWith('day-')) {
      const targetDay = Number(over.id.slice(4));
      if (targetDay === selectedDay) return;
      // Cross-day move: append the dragged item to the target day's end.
      const targetIds = sortByOrder(trip.items.filter((item) => item.day_number === targetDay)).map(
        (item) => item.id,
      );
      void reorderItems(trip.id, [
        { day_number: selectedDay, item_ids: currentIds.filter((id) => id !== active.id) },
        { day_number: targetDay, item_ids: [...targetIds, Number(active.id)] },
      ]);
      return;
    }

    if (active.id === over.id) return;
    const oldIndex = currentIds.indexOf(Number(active.id));
    const newIndex = currentIds.indexOf(Number(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    void reorderItems(trip.id, [
      { day_number: selectedDay, item_ids: arrayMove(currentIds, oldIndex, newIndex) },
    ]);
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
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <button
            onClick={() => setShowMembers(true)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '6px',
            }}
            title="行程成員"
          >
            <Users size={18} />
          </button>
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
      </div>

      <div className="content-area">
        <PresenceBar users={activeUsers} />

        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetection}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveItem(null)}
        >
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
            <DayTabDroppable
              key={day}
              day={day}
              selected={selectedDay === day}
              dragging={activeItem !== null}
              onSelect={setSelectedDay}
            />
          ))}
        </div>

        <div className="split-layout">
          <div className="split-aside">
            {canEdit && !showAddForm && !editingItem && (
              <button
                className="btn-primary"
                onClick={() => setShowAddForm(true)}
                style={{ marginBottom: '20px' }}
              >
                <Plus size={18} />
                規劃新景點/活動
              </button>
            )}

            {canEdit && showAddForm && (
              <ScheduleItemForm
                itineraryId={itineraryId}
                dayNumber={selectedDay}
                onClose={() => setShowAddForm(false)}
              />
            )}

            {canEdit && editingItem && (
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
              <SortableContext
                items={sortedItems.map((item) => item.id)}
                strategy={verticalListSortingStrategy}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {sortedItems.map((item) =>
                    canEdit ? (
                      <SortableScheduleItem
                        key={item.id}
                        item={item}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                      />
                    ) : (
                      <ScheduleItemCard
                        key={item.id}
                        item={item}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        readOnly
                      />
                    ),
                  )}
                </div>
              </SortableContext>
            )}
          </div>
        </div>

        <DragOverlay>
          {activeItem && (
            <ScheduleItemCard item={activeItem} onEdit={() => {}} onDelete={() => {}} />
          )}
        </DragOverlay>
        </DndContext>
      </div>

      {showMembers && <MembersModal onClose={() => setShowMembers(false)} />}
    </div>
  );
};

export default SchedulePanel;
