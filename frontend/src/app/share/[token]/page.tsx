'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { sharesApi } from '@/lib/api';
import { formatFileSize } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Cloud, Download, Lock, FileText } from 'lucide-react';

export default function SharePage({ params }: { params: { token: string } }) {
  const [password, setPassword] = useState('');
  const [entered,  setEntered]  = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['share', params.token, entered],
    queryFn:  () => sharesApi.access(params.token, entered ? password : undefined).then((r) => r.data),
    retry:    false,
  });

  const needsPassword = (error as any)?.response?.status === 401;

  const handleDownload = () => {
    if (!data?.file?.url) return;
    const a = document.createElement('a');
    a.href     = data.file.url;
    a.download = data.file.name ?? 'file';
    a.click();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 w-full max-w-md p-8">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Cloud className="h-4 w-4 text-white" />
          </div>
          <span className="font-bold text-gray-900">CloudBox</span>
        </div>

        {isLoading && <div className="text-center text-gray-400 py-8">Loading…</div>}

        {needsPassword && !entered && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-gray-600 mb-2">
              <Lock className="h-5 w-5" />
              <p className="font-medium">This share is password protected</p>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="share-pw" className="text-sm font-medium text-gray-700">Password</label>
              <Input
                id="share-pw"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                autoFocus
              />
            </div>
            <Button className="w-full" onClick={() => setEntered(true)}>
              Unlock
            </Button>
          </div>
        )}

        {error && !needsPassword && (
          <div className="text-center py-8">
            <p className="text-gray-500 font-medium">Share not found or expired</p>
          </div>
        )}

        {data?.file && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
              <FileText className="h-10 w-10 text-blue-400 flex-shrink-0" />
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 truncate">{data.file.name}</p>
                <p className="text-sm text-gray-500">{formatFileSize(data.file.size)}</p>
              </div>
            </div>

            <Button className="w-full" size="lg" onClick={handleDownload}>
              <Download className="h-4 w-4" /> Download file
            </Button>

            <p className="text-xs text-center text-gray-400">
              {data.share.permission === 'VIEW' ? 'View only' : 'View & edit'} access
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
