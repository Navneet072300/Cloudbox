'use client';

import { formatFileSize, formatDate } from '@/lib/utils';
import { Trash2, RotateCcw, FileIcon } from 'lucide-react';
import { FileRecord } from '@/lib/api';

// Trash shows soft-deleted files. The backend serves them via a dedicated
// GET /files?deleted=true endpoint (housekeeping job purges after 30 days).
// Until that route is wired into the frontend, this page renders the empty state.
const trashed: FileRecord[] = [];

export default function TrashPage() {
  if (trashed.length === 0) {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-64 text-gray-500">
        <Trash2 className="w-10 h-10 mb-3 text-gray-300" />
        <p className="text-sm">Trash is empty</p>
        <p className="text-xs mt-1 text-gray-400">Deleted files are kept for 30 days</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Trash</h1>
        <p className="text-xs text-gray-400">Files are permanently deleted after 30 days</p>
      </div>
      <div className="space-y-2">
        {trashed.map((file) => (
          <div
            key={file.id}
            className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-200 opacity-75 hover:opacity-100 transition-opacity"
          >
            <div className="flex items-center gap-3 min-w-0">
              <FileIcon className="w-5 h-5 text-gray-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-700 truncate">{file.name}</p>
                <p className="text-xs text-gray-400">
                  {formatFileSize(file.size)} · Deleted {formatDate(file.updatedAt)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-4">
              <button
                type="button"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Restore
              </button>
              <button
                type="button"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
