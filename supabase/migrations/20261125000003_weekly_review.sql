-- Allow a weekly ("Sunday review") reflection on a daily page, next to morning and evening.
alter table public.daily_reflections drop constraint if exists daily_reflections_kind_check;
alter table public.daily_reflections add constraint daily_reflections_kind_check check (kind in ('morning', 'evening', 'weekly'));
