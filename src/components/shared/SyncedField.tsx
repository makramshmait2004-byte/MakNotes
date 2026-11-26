import { useEffect, useRef, useState } from 'react';
import { Textarea } from '@/components/ui/input';

/**
 * Text field that keeps its own state while the user types and accepts outside (sync / initial load)
 * updates whenever the user is not actively typing in it. It is never remounted on save,
 * so the phone keyboard stays open.
 */
function useSynced<E extends HTMLInputElement | HTMLTextAreaElement>(value: string, onChange: (v: string) => void, onCommit: (v: string) => void) {
  const ref = useRef<E>(null);
  const [text, setText] = useState(value);
  const editing = useRef(false); // true only after the user typed and before blur
  useEffect(() => {
    const focused = ref.current !== null && document.activeElement === ref.current;
    if (!(focused && editing.current)) setText(value);
  }, [value]);
  return {
    ref,
    value: text,
    onChange: (e: { target: { value: string } }) => {
      editing.current = true;
      setText(e.target.value);
      onChange(e.target.value);
    },
    onBlur: (e: { target: { value: string } }) => {
      const wasEditing = editing.current;
      editing.current = false;
      if (wasEditing) onCommit(e.target.value);
    },
  };
}

type Base = { value: string; onValueChange: (v: string) => void; onCommit: (v: string) => void };

export function SyncedInput({ value, onValueChange, onCommit, ...rest }: Base & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'onBlur'>) {
  return <input {...rest} {...useSynced<HTMLInputElement>(value, onValueChange, onCommit)} />;
}

export function SyncedTextarea({ value, onValueChange, onCommit, ...rest }: Base & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange' | 'onBlur'>) {
  return <Textarea {...rest} {...useSynced<HTMLTextAreaElement>(value, onValueChange, onCommit)} />;
}
