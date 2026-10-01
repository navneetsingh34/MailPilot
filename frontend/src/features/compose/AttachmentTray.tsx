import { FileText, X } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { formatBytes } from '@/lib/format';

interface AttachmentTrayProps {
  files: File[];
  onRemove: (index: number) => void;
}

export function AttachmentTray({ files, onRemove }: AttachmentTrayProps) {
  const previews = useMemo(() => files.map((f) => (f.type.startsWith('image/') ? URL.createObjectURL(f) : null)), [files]);
  useEffect(() => () => previews.forEach((url) => url && URL.revokeObjectURL(url)), [previews]);

  if (files.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-3">
      {files.map((file, i) => (
        <div key={`${file.name}-${i}`} className="relative w-[158px] overflow-hidden rounded-xl border border-line bg-[#fafafa]">
          {previews[i] ? (
            <img src={previews[i]!} alt="" className="h-[88px] w-full object-cover" />
          ) : (
            <div className="flex h-[88px] items-center justify-center text-muted">
              <FileText className="size-8" />
            </div>
          )}
          <div className="px-2.5 py-2">
            <p className="truncate text-xs font-medium">{file.name}</p>
            <p className="text-[10px] text-muted">{formatBytes(file.size)}</p>
          </div>
          <button
            type="button"
            onClick={() => onRemove(i)}
            aria-label={`Remove ${file.name}`}
            className="absolute top-1.5 right-1.5 rounded-full bg-white/90 p-1 text-muted shadow hover:text-ink"
          >
            <X className="size-3" />
          </button>
        </div>
      ))}
    </div>
  );
}
