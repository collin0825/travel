import React from 'react';
import { ArrowLeft } from 'lucide-react';
import type { Note } from '@/types';
import { useTripContext } from '../context';
import { useNoteEditor } from '../hooks/useNoteEditor';

interface NoteEditorProps {
  note: Note;
  currentUserId: number | undefined;
  onBack: () => void;
  /** Viewers can read but not edit. */
  readOnly?: boolean;
}

const NoteEditor: React.FC<NoteEditorProps> = ({ note, currentUserId, onBack, readOnly }) => {
  const { lastTyping, lastNoteUpdate, sendTyping } = useTripContext();
  const { title, content, typingLabel, handleChange } = useNoteEditor({
    note,
    currentUserId,
    sendTyping,
    lastTyping,
    lastNoteUpdate,
  });

  return (
    <div className="animate-slide-up" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <div className="app-header">
        <button
          onClick={onBack}
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
          返回
        </button>
        <div style={{ fontSize: '12px', color: 'var(--accent-color)', fontWeight: 'bold' }}>
          {typingLabel}
        </div>
        <div style={{ width: '24px' }} />
      </div>

      <div className="content-area" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        <input
          type="text"
          value={title}
          readOnly={readOnly}
          onChange={(e) => {
            if (!readOnly) handleChange(e.target.value, content);
          }}
          placeholder="無標題備忘錄"
          style={{
            background: 'none',
            border: 'none',
            borderBottom: '1px solid var(--glass-border)',
            color: 'var(--text-primary)',
            fontSize: '22px',
            fontWeight: 800,
            padding: '8px 0 16px 0',
            outline: 'none',
            width: '100%',
            marginBottom: '16px',
            fontFamily: 'inherit',
          }}
        />

        <textarea
          value={content}
          readOnly={readOnly}
          onChange={(e) => {
            if (!readOnly) handleChange(title, e.target.value);
          }}
          placeholder={readOnly ? '（唯讀）' : '開始輸入筆記內容，內容會自動即時儲存並同步給朋友...'}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-primary)',
            fontSize: '15px',
            lineHeight: 1.6,
            outline: 'none',
            width: '100%',
            flex: 1,
            resize: 'none',
            fontFamily: 'inherit',
          }}
        />
      </div>
    </div>
  );
};

export default NoteEditor;
