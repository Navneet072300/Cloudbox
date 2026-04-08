'use client';
import { useState } from 'react';
import { useUploadStore } from '@/store/uploadStore';
import { formatFileSize } from '@/lib/utils';
import { CheckCircle, XCircle, Loader2, X, ChevronDown } from 'lucide-react';
import { clsx } from 'clsx';

export function UploadQueue() {
  const { queue, clearCompleted, removeItem } = useUploadStore();
  const [collapsed, setCollapsed] = useState(false);

  if (!queue.length) return null;

  const active = queue.filter((i) => i.status !== 'done' && i.status !== 'error').length;
  const done   = queue.filter((i) => i.status === 'done').length;
  const errors = queue.filter((i) => i.status === 'error').length;

  return (
    <div className="fixed bottom-4 right-4 w-80 bg-white rounded-2xl border border-gray-200 shadow-2xl overflow-hidden z-50">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 bg-gray-900 text-white cursor-pointer"
        onClick={() => setCollapsed((c) => !c)}
      >
        <span className="text-sm font-medium">
          {active > 0 ? `Uploading ${active} file${active > 1 ? 's' : ''}…`
                      : `${done} upload${done > 1 ? 's' : ''} complete`}
          {errors > 0 && <span className="ml-1.5 text-red-400">{errors} failed</span>}
        </span>
        <div className="flex items-center gap-2">
          {done > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); clearCompleted(); }}
              className="text-xs text-gray-400 hover:text-white transition-colors"
            >
              Clear
            </button>
          )}
          <ChevronDown className={clsx('h-4 w-4 transition-transform', collapsed && 'rotate-180')} />
        </div>
      </div>

      {!collapsed && (
        <div className="max-h-72 overflow-y-auto divide-y divide-gray-100">
          {queue.map((item) => (
            <div key={item.id} className="flex items-center gap-3 px-4 py-3">
              {/* Status icon */}
              <div className="flex-shrink-0 w-4">
                {item.status === 'done'   && <CheckCircle className="h-4 w-4 text-green-500" />}
                {item.status === 'error'  && <XCircle     className="h-4 w-4 text-red-500" />}
                {!['done', 'error'].includes(item.status) && (
                  <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex justify-between">
                  <p className="text-sm font-medium text-gray-800 truncate">{item.file.name}</p>
                  <span className="text-xs text-gray-400 ml-2 flex-shrink-0">{formatFileSize(item.file.size)}</span>
                </div>
                {item.error && (
                  <p className="text-xs text-red-500 mt-0.5 truncate">{item.error}</p>
                )}
                {['uploading', 'assembling', 'hashing'].includes(item.status) && (
                  <div className="mt-1.5">
                    <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all duration-300"
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {item.status === 'assembling' ? 'Assembling…' :
                       item.status === 'hashing'    ? 'Hashing…' : `${item.progress}%`}
                    </p>
                  </div>
                )}
              </div>

              {/* Remove */}
              {['done', 'error'].includes(item.status) && (
                <button onClick={() => removeItem(item.id)} className="flex-shrink-0 p-0.5 rounded hover:bg-gray-100 text-gray-400">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
