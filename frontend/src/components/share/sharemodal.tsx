'use client';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { sharesApi, FileRecord } from '@/lib/api';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Link2, Copy, Check, Clock, Lock, Loader2 } from 'lucide-react';

interface Props { file: FileRecord; onClose: () => void; }

export function ShareModal({ file, onClose }: Props) {
  const [token,      setToken]      = useState('');
  const [permission, setPermission] = useState<'VIEW' | 'EDIT'>('VIEW');
  const [expiry,     setExpiry]     = useState('7d');
  const [password,   setPassword]   = useState('');
  const [copied,     setCopied]     = useState(false);

  const { mutate: createShare, isPending } = useMutation({
    mutationFn: () => {
      const now = Date.now();
      const map: Record<string, number> = { '1d': 864e5, '7d': 6048e5, '30d': 2592e6 };
      const expiresAt = expiry !== 'never' ? new Date(now + map[expiry]).toISOString() : undefined;
      return sharesApi.create({ fileId: file.id, type: 'PUBLIC_LINK', permission, expiresAt, password: password || undefined });
    },
    onSuccess: ({ data }) => setToken(data.token),
  });

  const shareUrl = token ? `${typeof window !== 'undefined' ? window.location.origin : ''}/share/${token}` : null;

  const copyLink = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal open title={`Share "${file.name}"`} onClose={onClose}>
      <div className="px-6 pb-6 space-y-4">
        {/* Permission */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Permission</p>
          <div className="flex gap-2">
            {(['VIEW', 'EDIT'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPermission(p)}
                className={`flex-1 py-2 text-sm font-medium rounded-lg border transition-colors ${
                  permission === p
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {p === 'VIEW' ? 'Can view' : 'Can edit'}
              </button>
            ))}
          </div>
        </div>

        {/* Expiry */}
        <div>
          <label htmlFor="share-expiry" className="flex items-center gap-1 text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            <Clock className="h-3 w-3" /> Expires
          </label>
          <select
            id="share-expiry"
            value={expiry}
            onChange={(e) => setExpiry(e.target.value)}
            className="w-full rounded-lg border border-gray-200 text-sm px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          >
            <option value="1d">1 day</option>
            <option value="7d">7 days</option>
            <option value="30d">30 days</option>
            <option value="never">Never</option>
          </select>
        </div>

        {/* Password */}
        <div>
          <label htmlFor="share-password" className="flex items-center gap-1 text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            <Lock className="h-3 w-3" /> Password (optional)
          </label>
          <Input
            id="share-password"
            type="password"
            placeholder="Leave blank for no password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {/* Share link */}
        {shareUrl && (
          <div className="bg-gray-50 rounded-xl border border-gray-200 p-3">
            <p className="text-xs font-medium text-gray-500 mb-1.5">Shareable link</p>
            <div className="flex items-center gap-2">
              <p className="text-xs text-blue-600 truncate flex-1 font-mono">{shareUrl}</p>
              <button type="button" onClick={copyLink} className="p-1.5 rounded-lg hover:bg-gray-200 shrink-0" title="Copy link">
                {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4 text-gray-500" />}
              </button>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          {!shareUrl ? (
            <Button onClick={() => createShare()} disabled={isPending}>
              {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
              Create link
            </Button>
          ) : (
            <Button variant="secondary" onClick={copyLink}>
              {copied ? 'Copied!' : 'Copy link'}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
