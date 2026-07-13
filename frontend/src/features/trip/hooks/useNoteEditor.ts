import { useCallback, useEffect, useRef, useState } from 'react';
import { useTripStore } from '@/stores';
import type { Note } from '@/types';
import type { NoteUpdateEvent, TypingEvent } from './useTripSocket';

const SAVE_DEBOUNCE_MS = 600;
const TYPING_TIMEOUT_MS = 2000;

interface UseNoteEditorArgs {
  note: Note;
  currentUserId: number | undefined;
  sendTyping: (noteId: number) => void;
  lastTyping: TypingEvent | null;
  lastNoteUpdate: NoteUpdateEvent | null;
}

/**
 * Owns collaborative editing for a single note: debounced autosave, typing
 * broadcasts, live remote content sync, and a flush-on-unmount safety save.
 * Mount this hook via a component keyed by note id so state resets per note.
 */
export const useNoteEditor = ({
  note,
  currentUserId,
  sendTyping,
  lastTyping,
  lastNoteUpdate,
}: UseNoteEditorArgs) => {
  const saveNote = useTripStore((state) => state.saveNote);

  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content ?? '');
  const [typingLabel, setTypingLabel] = useState('');

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef = useRef({ title, content });
  latestRef.current = { title, content };

  const flush = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
      void saveNote(note.id, { ...latestRef.current });
    }
  }, [note.id, saveNote]);

  const handleChange = (nextTitle: string, nextContent: string) => {
    setTitle(nextTitle);
    setContent(nextContent);
    sendTyping(note.id);

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveTimeoutRef.current = null;
      void saveNote(note.id, { title: nextTitle, content: nextContent });
    }, SAVE_DEBOUNCE_MS);
  };

  // Apply live remote edits, but never clobber our own in-flight typing.
  useEffect(() => {
    if (!lastNoteUpdate || lastNoteUpdate.noteId !== note.id) return;
    if (saveTimeoutRef.current) return;
    setTitle(lastNoteUpdate.title);
    setContent(lastNoteUpdate.content ?? '');
  }, [lastNoteUpdate, note.id]);

  // Show a transient "someone is editing" indicator.
  useEffect(() => {
    if (!lastTyping || lastTyping.noteId !== note.id || lastTyping.userId === currentUserId) return;
    setTypingLabel(lastTyping.label);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => setTypingLabel(''), TYPING_TIMEOUT_MS);
  }, [lastTyping, note.id, currentUserId]);

  useEffect(
    () => () => {
      flush();
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    },
    [flush],
  );

  return { title, content, typingLabel, handleChange };
};
