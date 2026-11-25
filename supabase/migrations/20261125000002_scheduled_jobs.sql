-- Scheduled maintenance with pg_cron (available on the Supabase free tier).
-- Soft-deleted rows are kept for 30 days so every device can sync the deletion, then purged.

create extension if not exists pg_cron with schema pg_catalog;

create or replace function public.purge_soft_deleted()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare t text;
begin
  -- children first so cascades stay cheap
  foreach t in array array[
    'drawing_strokes','journal_blocks','notes','subtasks','milestones','habit_logs','daily_priorities',
    'daily_reflections','reminders','focus_sessions','attachments','tags','notebook_pages','notebook_sections',
    'notebooks','journal_entries','calendar_events','tasks','task_recurrences','goals','projects','habits',
    'drawings','daily_pages'
  ] loop
    execute format('delete from public.%I where deleted_at is not null and deleted_at < now() - interval ''30 days''', t);
  end loop;
end;
$$;

revoke all on function public.purge_soft_deleted() from public, anon, authenticated;

select cron.schedule('maknotes-purge-soft-deleted', '17 3 * * *', $$select public.purge_soft_deleted()$$);
