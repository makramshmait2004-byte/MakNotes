import { useEffect, useState } from 'react';
import { FileText, Download } from 'lucide-react';
import { useRow } from '@/data/hooks';
import { fileBlob, fileUrl } from '@/data/files';
import { downloadBlob, formatBytes } from '@/lib/utils';
import { useT } from '@/i18n';

export function useFileUrl(attachmentId: string | null | undefined) {
  const att = useRow('attachments', attachmentId);
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (att) void fileUrl(att).then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, [att?.id, att?.path]); // eslint-disable-line react-hooks/exhaustive-deps
  return { att, url };
}

export function AttachmentImage({ attachmentId, className }: { attachmentId: string | null; className?: string }) {
  const { att, url } = useFileUrl(attachmentId);
  const t = useT();
  if (!att) return <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">{t('Image unavailable')}</div>;
  if (!url) return <div className="h-40 animate-pulse rounded-md bg-muted" aria-label={t('Loading image')} />;
  return <img src={url} alt={att.file_name} className={className ?? 'max-h-[70vh] w-full rounded-md object-contain'} loading="lazy" />;
}

export function AttachmentFile({ attachmentId }: { attachmentId: string | null }) {
  const { att } = useFileUrl(attachmentId);
  const t = useT();
  if (!att) return null;
  return (
    <button
      className="flex w-full items-center gap-3 rounded-md border p-3 text-start hover:bg-accent"
      onClick={async () => {
        const blob = await fileBlob(att);
        if (blob) downloadBlob(blob, att.file_name);
      }}
    >
      <FileText className="size-6 shrink-0 text-bronze" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{att.file_name}</span>
        <span className="text-xs text-muted-foreground">{att.size_bytes ? formatBytes(att.size_bytes) : ''} {att.mime_type ?? ''}</span>
      </span>
      <Download className="size-4 text-muted-foreground" aria-label={t('Download')} />
    </button>
  );
}
