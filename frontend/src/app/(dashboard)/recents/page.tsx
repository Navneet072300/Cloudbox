'use client';

import { useQuery } from '@tanstack/react-query';
import { filesApi, FolderContents } from '@/lib/api';
import { FileGrid } from '@/components/drive/filegrid';
export default function RecentsPage() {
  const { data, isLoading } = useQuery<FolderContents>({
    queryKey: ['files', 'recents'],
    queryFn: (): Promise<FolderContents> =>
      filesApi.list(null, 1).then((r: { data: FolderContents }) => r.data),
  });

  const recent = [...(data?.files ?? [])]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 50);

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Recent files</h1>
      <FileGrid
        files={recent}
        folders={[]}
        loading={isLoading}
        viewMode="list"
        folderId={null}
        onFolderOpen={() => {}}
      />
    </div>
  );
}
