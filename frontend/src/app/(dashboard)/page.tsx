'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { filesApi } from '@/lib/api';
import { Toolbar } from '@/components/drive/toolbar';
import { Breadcrumb } from '@/components/drive/breadcrumb';
import { FileGrid } from '@/components/drive/filegrid';
import { UploadZone } from '@/components/drive/uploadzone';

interface Crumb { id: string; name: string; }

export default function DrivePage() {
  const [folderId,   setFolderId]   = useState<string | null>(null);
  const [crumbs,     setCrumbs]     = useState<Crumb[]>([]);
  const [viewMode,   setViewMode]   = useState<'grid' | 'list'>('grid');

  const { data, isLoading } = useQuery({
    queryKey: ['files', folderId],
    queryFn:  () => filesApi.list(folderId, 1).then((r: { data: import('@/lib/api').FolderContents }) => r.data),
  });

  const navigateFolder = (id: string, name: string) => {
    setFolderId(id);
    setCrumbs((c) => [...c, { id, name }]);
  };

  const navigateCrumb = (index: number) => {
    if (index === -1) { setFolderId(null); setCrumbs([]); }
    else { setFolderId(crumbs[index].id); setCrumbs((c) => c.slice(0, index + 1)); }
  };

  return (
    <UploadZone folderId={folderId}>
      <Toolbar folderId={folderId} viewMode={viewMode} onViewModeChange={setViewMode} />
      <Breadcrumb items={crumbs} onNavigate={navigateCrumb} />
      <div className="flex-1 overflow-auto p-4">
        <FileGrid
          files={data?.files ?? []}
          folders={data?.folders ?? []}
          loading={isLoading}
          viewMode={viewMode}
          folderId={folderId}
          onFolderOpen={navigateFolder}
        />
      </div>
    </UploadZone>
  );
}
