'use client';
import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useUpload } from '@/hooks/useUpload';
import { Upload } from 'lucide-react';

interface Props {
  folderId: string | null;
  children: React.ReactNode;
}

export function UploadZone({ folderId, children }: Props) {
  const { uploadFiles } = useUpload(folderId);
  const [dragging, setDragging] = useState(false);

  const onDrop = useCallback((files: File[]) => {
    setDragging(false);
    if (files.length) uploadFiles(files);
  }, [uploadFiles]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDragEnter: () => setDragging(true),
    onDragLeave: () => setDragging(false),
    noClick:     true,
    noKeyboard:  true,
  });

  return (
    <div {...getRootProps()} className="relative flex flex-col flex-1 min-h-0">
      <input {...getInputProps()} />

      {isDragActive && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-blue-500/10 border-2 border-dashed border-blue-500 rounded-lg m-2 pointer-events-none">
          <Upload className="h-12 w-12 text-blue-500 mb-3" />
          <p className="text-lg font-bold text-blue-700">Drop to upload</p>
          <p className="text-sm text-blue-500 mt-1">Files will be added to current folder</p>
        </div>
      )}

      {children}
    </div>
  );
}
