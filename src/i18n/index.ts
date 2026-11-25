import { create } from 'zustand';
import { ar } from './ar';

export type Lang = 'en' | 'ar';

export const useLang = create<{ lang: Lang }>(() => ({ lang: (localStorage.getItem('maknotes-lang') as Lang) || 'en' }));

export function setLang(lang: Lang) {
  try {
    localStorage.setItem('maknotes-lang', lang);
  } catch {
    /* storage unavailable */
  }
  useLang.setState({ lang });
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
}

function interpolate(s: string, vars?: Record<string, string | number>) {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
}

/** Translate an English source string. Missing Arabic strings fall back to English. */
export function translate(lang: Lang, s: string, vars?: Record<string, string | number>) {
  return interpolate(lang === 'ar' ? (ar[s] ?? s) : s, vars);
}

export function useT() {
  const lang = useLang((s) => s.lang);
  return (s: string, vars?: Record<string, string | number>) => translate(lang, s, vars);
}

export function useLocale() {
  const lang = useLang((s) => s.lang);
  return lang === 'ar' ? 'ar-u-nu-latn' : 'en-GB';
}

export const t = (s: string, vars?: Record<string, string | number>) => translate(useLang.getState().lang, s, vars);
