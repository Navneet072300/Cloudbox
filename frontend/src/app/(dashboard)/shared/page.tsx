'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { sharesApi, ShareRecord } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { Link2, Trash2, Clock } from 'lucide-react';
export default function SharedPage() {
  const queryClient = useQueryClient();

  const { data: shares = [] as ShareRecord[], isLoading } = useQuery<ShareRecord[]>({
    queryKey: ['shares'],
    queryFn: (): Promise<ShareRecord[]> =>
      sharesApi.mine().then((r: { data: ShareRecord[] }) => r.data),
  });

  async function handleRevoke(shareId: string) {
    await sharesApi.revoke(shareId);
    queryClient.invalidateQueries({ queryKey: ['shares'] });
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (shares.length === 0) {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-64 text-gray-500">
        <Link2 className="w-10 h-10 mb-3 text-gray-300" />
        <p className="text-sm">No shared links yet</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Shared by me</h1>
      <div className="space-y-2">
        {shares.map((share) => (
          <div
            key={share.id}
            className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0">
              <Link2 className="w-4 h-4 text-blue-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {share.file?.name ?? share.folder?.name ?? 'Shared item'}
                </p>
                <p className="text-xs text-gray-500 font-mono truncate">
                  /share/{share.token}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4 shrink-0 ml-4">
              {share.expiresAt && (
                <span className="flex items-center gap-1 text-xs text-gray-400">
                  <Clock className="w-3 h-3" />
                  {formatDate(share.expiresAt)}
                </span>
              )}
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                {share.permission}
              </span>
              <button
                type="button"
                onClick={() => handleRevoke(share.id)}
                className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                title="Revoke link"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
