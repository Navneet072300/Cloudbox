'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { filesApi, FileRecord } from '@/lib/api';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { formatDate, formatFileSize } from '@/lib/utils';
import { RotateCcw, Loader2 } from 'lucide-react';

interface Props { file: FileRecord; onClose: () => void; }

export function VersionsPanel({ file, onClose }: Props) {
  const queryClient = useQueryClient();

  const { data: versions = [], isLoading } = useQuery({
    queryKey: ['versions', file.id],
    queryFn:  () => filesApi.listVersions(file.id).then((r) => r.data),
  });

  const { mutate: restore, isPending, variables: restoringId } = useMutation({
    mutationFn: (versionId: string) => filesApi.restoreVersion(file.id, versionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files'] });
      queryClient.invalidateQueries({ queryKey: ['versions', file.id] });
      onClose();
    },
  });

  return (
    <Modal open title="Version history" onClose={onClose} className="max-w-lg">
      <p className="px-6 py-2 text-sm text-gray-500 border-b border-gray-100 truncate">{file.name}</p>
      <div className="max-h-80 overflow-y-auto divide-y divide-gray-100">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Loading versions…</div>
        ) : versions.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">No versions found</div>
        ) : (
          versions.map((v, i) => (
            <div key={v.id} className="flex items-center gap-4 px-6 py-3.5">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">Version {v.versionNum}</span>
                  {i === 0 && (
                    <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">Current</span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  {formatDate(v.createdAt)} · {formatFileSize(v.size)}
                </p>
              </div>
              {i > 0 && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => restore(v.id)}
                  disabled={isPending && restoringId === v.id}
                >
                  {isPending && restoringId === v.id
                    ? <Loader2 className="h-3 w-3 animate-spin" />
                    : <RotateCcw className="h-3 w-3" />
                  }
                  Restore
                </Button>
              )}
            </div>
          ))
        )}
      </div>
      <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
        <Button variant="ghost" onClick={onClose}>Close</Button>
      </div>
    </Modal>
  );
}
