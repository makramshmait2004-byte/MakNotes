import { insert } from '@/data/repo';

export async function createJournalEntry(date: string, title?: string) {
  return insert('journal_entries', { entry_date: date, title: title ?? null });
}

export const JOURNAL_CATEGORIES = ['personal', 'work', 'gratitude', 'ideas', 'health', 'learning', 'travel', 'dreams'];

export const MORNING_PROMPTS = [
  'What would make today great?',
  'What am I grateful for this morning?',
  'What is the one thing I must finish today?',
  'How do I want to feel at the end of the day?',
];

export const EVENING_PROMPTS = [
  'What went well today?',
  'What did I learn?',
  'What could I have done better?',
  'What am I grateful for tonight?',
  'What will I focus on tomorrow?',
];

export function countWords(text: string) {
  const m = text.trim().match(/\S+/g);
  return m ? m.length : 0;
}
