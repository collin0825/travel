import React, { useState } from 'react';
import type { FormEvent } from 'react';
import { FileText, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useAuthStore, useTripStore } from '@/stores';
import { formatDateTime } from '@/utils/datetime';
import { useTripContext } from '../context';
import NoteEditor from './NoteEditor';

const NotesPanel: React.FC = () => {
  const { itineraryId } = useTripContext();
  const user = useAuthStore((state) => state.user);
  const trip = useTripStore((state) => state.trip);
  const refresh = useTripStore((state) => state.refresh);
  const addNote = useTripStore((state) => state.addNote);
  const removeNote = useTripStore((state) => state.removeNote);

  const [activeNoteId, setActiveNoteId] = useState<number | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const notes = trip?.notes ?? [];
  const activeNote = notes.find((note) => note.id === activeNoteId) ?? null;
  // Server enforces permissions; this only hides editing affordances for viewers.
  const canEdit = trip?.my_role !== 'viewer';

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newTitle.trim()) return;
    setSubmitting(true);
    try {
      const note = await addNote(itineraryId, { title: newTitle, content: '' });
      setNewTitle('');
      setShowAddForm(false);
      setActiveNoteId(note.id);
    } catch (err) {
      console.error('Failed to create note:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (event: React.MouseEvent, noteId: number) => {
    event.stopPropagation();
    if (!window.confirm('確定要刪除此備忘錄嗎？')) return;
    if (activeNoteId === noteId) setActiveNoteId(null);
    void removeNote(noteId);
  };

  if (activeNote) {
    return (
      <NoteEditor
        key={activeNote.id}
        note={activeNote}
        currentUserId={user?.id}
        onBack={() => setActiveNoteId(null)}
        readOnly={!canEdit}
      />
    );
  }

  return (
    <div className="animate-slide-up" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <div className="app-header">
        <h2 style={{ fontSize: '18px', fontWeight: 800 }}>旅遊備忘錄 / 筆記</h2>
        <button
          onClick={() => void refresh()}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            padding: '6px',
          }}
        >
          <RefreshCw size={18} />
        </button>
      </div>

      <div className="content-area">
        {canEdit && (
        <div className="actions-row">
          {!showAddForm ? (
            <button
              className="btn-primary"
              onClick={() => setShowAddForm(true)}
              style={{ marginBottom: '20px' }}
            >
              <Plus size={18} />
              新增備忘錄
            </button>
          ) : (
            <div
              className="glass-card"
              style={{ marginBottom: '20px', border: '1px solid var(--accent-color)' }}
            >
              <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '12px' }}>建立新備忘錄</h3>
              <form
                onSubmit={handleCreate}
                style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
              >
                <input
                  type="text"
                  placeholder="輸入筆記標題 (如: 行李準備清單、機票資訊)"
                  className="glass-input"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  required
                />
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '8px',
                    marginTop: '4px',
                  }}
                >
                  <button type="button" className="btn-secondary" onClick={() => setShowAddForm(false)}>
                    取消
                  </button>
                  <button type="submit" className="btn-primary" disabled={submitting}>
                    建立
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
        )}

        {notes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-secondary)' }}>
            <FileText size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
            <p>目前沒有任何備忘錄</p>
            <p style={{ fontSize: '12px', marginTop: '4px' }}>
              點選「新增備忘錄」記錄行李、景點備案吧！
            </p>
          </div>
        ) : (
          <div className="cards-grid" style={{ gap: '12px' }}>
            {notes.map((note) => (
              <div
                key={note.id}
                className="glass-card"
                onClick={() => setActiveNoteId(note.id)}
                style={{
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div style={{ flex: 1, marginRight: '16px', overflow: 'hidden' }}>
                  <h4
                    style={{
                      fontSize: '16px',
                      fontWeight: 700,
                      marginBottom: '4px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {note.title}
                  </h4>
                  <p
                    style={{
                      color: 'var(--text-secondary)',
                      fontSize: '12px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {note.content ? note.content.substring(0, 40) : '無內容，點擊編輯'}
                  </p>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                    最後修改: {formatDateTime(note.updated_at)}
                  </span>
                </div>

                {canEdit && (
                  <button
                    onClick={(e) => handleDelete(e, note.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: '6px',
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default NotesPanel;
