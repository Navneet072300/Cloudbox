'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { authApi } from '@/lib/api';
import { formatFileSize } from '@/lib/utils';
import { clsx } from 'clsx';
import { Cloud, HardDrive, Share2, Clock, Trash2, LogOut } from 'lucide-react';

const NAV = [
  { label: 'My Drive',  href: '/',        icon: HardDrive },
  { label: 'Shared',    href: '/shared',   icon: Share2 },
  { label: 'Recents',   href: '/recents',  icon: Clock },
  { label: 'Trash',     href: '/trash',    icon: Trash2 },
];

export function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();
  const { user, logout } = useAuthStore();

  const handleLogout = async () => {
    const rt = localStorage.getItem('refreshToken');
    if (rt) await authApi.logout(rt).catch(() => {});
    logout();
    router.replace('/login');
  };

  const usedPct = user
    ? Math.min(100, Math.round((user.storageUsed / user.storageQuota) * 100))
    : 0;

  return (
    <aside className="w-56 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 h-14 border-b border-gray-100 flex-shrink-0">
        <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
          <Cloud className="h-4 w-4 text-white" />
        </div>
        <span className="font-bold text-gray-900 text-base">CloudBox</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {NAV.map(({ label, href, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={clsx(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              pathname === href
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            )}
          >
            <Icon className="h-4 w-4 flex-shrink-0" />
            {label}
          </Link>
        ))}
      </nav>

      {/* Storage meter */}
      {user && (
        <div className="px-4 py-3 border-t border-gray-100">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Storage</span>
            <span>{usedPct}%</span>
          </div>
          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={clsx('h-full rounded-full transition-all', usedPct > 90 ? 'bg-red-500' : 'bg-blue-500')}
              style={{ width: `${usedPct}%` }}
            />
          </div>
          <p className="text-[10px] text-gray-400 mt-1">
            {formatFileSize(user.storageUsed)} / {formatFileSize(user.storageQuota)}
          </p>
        </div>
      )}

      {/* User */}
      <div className="px-3 py-3 border-t border-gray-100 flex items-center gap-2">
        <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
          {user?.name?.[0]?.toUpperCase() ?? '?'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
          <p className="text-[10px] text-gray-400 truncate">{user?.email}</p>
        </div>
        <button onClick={handleLogout} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400" title="Sign out">
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
}
