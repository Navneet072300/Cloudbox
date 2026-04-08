"use client";
import { useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FileRecord, FolderRecord, filesApi, foldersApi } from "@/lib/api";
import { formatFileSize, formatDate } from "@/lib/utils";
import { clsx } from "clsx";
import {
  Folder,
  FileText,
  Image,
  Film,
  Music,
  Archive,
  MoreVertical,
  Download,
  Share2,
  History,
  Trash2,
  Pencil,
} from "lucide-react";
import { ShareModal } from "../share/sharemodal";
import { VersionsPanel } from "../versions/versionspanel";

interface Props {
  files: FileRecord[];
  folders: FolderRecord[];
  loading: boolean;
  viewMode: "grid" | "list";
  folderId: string | null;
  onFolderOpen: (id: string, name: string) => void;
}

export function FileGrid({
  files,
  folders,
  loading,
  viewMode,
  folderId,
  onFolderOpen,
}: Props) {
  const [shareFile, setShareFile] = useState<FileRecord | null>(null);
  const [versionsFile, setVersionsFile] = useState<FileRecord | null>(null);
  const queryClient = useQueryClient();

  const { mutate: deleteFile } = useMutation({
    mutationFn: (id: string) => filesApi.deleteFile(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["files", folderId] }),
  });

  const { mutate: deleteFolder } = useMutation({
    mutationFn: (id: string) => foldersApi.delete(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["files", folderId] }),
  });

  const downloadFile = async (file: FileRecord) => {
    const { data } = await filesApi.downloadUrl(file.id);
    const a = document.createElement("a");
    a.href = data.url;
    a.download = data.fileName;
    a.click();
  };

  if (loading) return <GridSkeleton />;
  if (!files.length && !folders.length) return <EmptyState />;

  if (viewMode === "list") {
    return (
      <>
        <div className="rounded-xl border border-gray-200 overflow-hidden bg-white">
          <div className="grid grid-cols-[32px_1fr_140px_100px_40px] gap-4 px-4 py-2 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500 uppercase tracking-wide">
            <div />
            <div>Name</div>
            <div>Modified</div>
            <div>Size</div>
            <div />
          </div>

          {folders.map((folder) => (
            <div
              key={folder.id}
              className="grid grid-cols-[32px_1fr_140px_100px_40px] gap-4 px-4 py-2.5 border-b border-gray-50 hover:bg-gray-50 cursor-pointer group"
              onDoubleClick={() => onFolderOpen(folder.id, folder.name)}
            >
              <Folder className="h-5 w-5 text-yellow-400 self-center" />
              <span className="text-sm font-medium text-gray-800 self-center truncate">
                {folder.name}
              </span>
              <span className="text-xs text-gray-400 self-center">
                {formatDate(folder.createdAt)}
              </span>
              <span className="text-xs text-gray-400 self-center">—</span>
              <RowMenu
                onDelete={() => {
                  if (confirm(`Delete "${folder.name}"?`))
                    deleteFolder(folder.id);
                }}
              />
            </div>
          ))}

          {files.map((file) => (
            <div
              key={file.id}
              className="grid grid-cols-[32px_1fr_140px_100px_40px] gap-4 px-4 py-2.5 border-b border-gray-50 hover:bg-gray-50 group"
            >
              <FileIcon mimeType={file.mimeType} size="sm" />
              <span className="text-sm font-medium text-gray-800 self-center truncate">
                {file.name}
              </span>
              <span className="text-xs text-gray-400 self-center">
                {formatDate(file.updatedAt)}
              </span>
              <span className="text-xs text-gray-400 self-center">
                {formatFileSize(file.size)}
              </span>
              <RowMenu
                onDownload={() => downloadFile(file)}
                onShare={() => setShareFile(file)}
                onVersions={() => setVersionsFile(file)}
                onDelete={() => {
                  if (confirm(`Delete "${file.name}"?`)) deleteFile(file.id);
                }}
              />
            </div>
          ))}
        </div>

        {shareFile && (
          <ShareModal file={shareFile} onClose={() => setShareFile(null)} />
        )}
        {versionsFile && (
          <VersionsPanel
            file={versionsFile}
            onClose={() => setVersionsFile(null)}
          />
        )}
      </>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-2">
        {folders.map((folder) => (
          <GridCard
            key={folder.id}
            label={folder.name}
            icon={<Folder className="h-10 w-10 text-yellow-400" />}
            onDoubleClick={() => onFolderOpen(folder.id, folder.name)}
            onDelete={() => {
              if (confirm(`Delete "${folder.name}"?`)) deleteFolder(folder.id);
            }}
          />
        ))}
        {files.map((file) => (
          <GridCard
            key={file.id}
            label={file.name}
            sublabel={formatFileSize(file.size)}
            icon={<FileIcon mimeType={file.mimeType} size="lg" />}
            onDownload={() => downloadFile(file)}
            onShare={() => setShareFile(file)}
            onVersions={() => setVersionsFile(file)}
            onDelete={() => {
              if (confirm(`Delete "${file.name}"?`)) deleteFile(file.id);
            }}
          />
        ))}
      </div>

      {shareFile && (
        <ShareModal file={shareFile} onClose={() => setShareFile(null)} />
      )}
      {versionsFile && (
        <VersionsPanel
          file={versionsFile}
          onClose={() => setVersionsFile(null)}
        />
      )}
    </>
  );
}

function GridCard({
  label,
  sublabel,
  icon,
  onDoubleClick,
  onDownload,
  onShare,
  onVersions,
  onDelete,
}: any) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div
      className="relative flex flex-col items-center gap-1.5 p-3 rounded-xl border border-transparent hover:border-gray-200 hover:bg-white hover:shadow-sm cursor-pointer group transition-all select-none"
      onDoubleClick={onDoubleClick}
    >
      {icon}
      <p className="text-xs text-gray-700 text-center font-medium line-clamp-2 break-all w-full">
        {label}
      </p>
      {sublabel && <p className="text-[10px] text-gray-400">{sublabel}</p>}

      <button
        type="button"
        title="More options"
        className="absolute top-1 right-1 p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-gray-200 transition-opacity"
        onClick={(e) => {
          e.stopPropagation();
          setMenuOpen(!menuOpen);
        }}
      >
        <MoreVertical className="h-3 w-3 text-gray-500" />
      </button>

      {menuOpen && (
        <DropMenu
          onDownload={onDownload}
          onShare={onShare}
          onVersions={onVersions}
          onDelete={onDelete}
          onClose={() => setMenuOpen(false)}
        />
      )}
    </div>
  );
}

function RowMenu({ onDownload, onShare, onVersions, onDelete }: any) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative self-center">
      <button
        className="p-1 rounded hover:bg-gray-200 opacity-0 group-hover:opacity-100"
        onClick={() => setOpen(!open)}
      >
        <MoreVertical className="h-3.5 w-3.5 text-gray-500" />
      </button>
      {open && (
        <DropMenu
          onDownload={onDownload}
          onShare={onShare}
          onVersions={onVersions}
          onDelete={onDelete}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

function DropMenu({ onDownload, onShare, onVersions, onDelete, onClose }: any) {
  const item = (
    label: string,
    icon: ReactNode,
    action?: () => void,
    danger?: boolean,
  ) =>
    action ? (
      <button
        key={label}
        onClick={() => {
          action();
          onClose();
        }}
        className={clsx(
          "flex items-center gap-2 w-full px-3 py-2 text-xs rounded-md hover:bg-gray-100 transition-colors",
          danger && "text-red-600",
        )}
      >
        {icon} {label}
      </button>
    ) : null;

  return (
    <>
      <div className="fixed inset-0 z-10" onClick={onClose} />
      <div className="absolute right-0 top-full mt-1 z-20 bg-white rounded-xl shadow-xl border border-gray-200 py-1 w-40 text-sm">
        {item("Download", <Download className="h-3.5 w-3.5" />, onDownload)}
        {item("Share", <Share2 className="h-3.5 w-3.5" />, onShare)}
        {item("Versions", <History className="h-3.5 w-3.5" />, onVersions)}
        <div className="my-1 border-t border-gray-100" />
        {item("Delete", <Trash2 className="h-3.5 w-3.5" />, onDelete, true)}
      </div>
    </>
  );
}

function FileIcon({
  mimeType,
  size = "sm",
}: {
  mimeType: string;
  size?: "sm" | "lg";
}) {
  const cls = size === "lg" ? "h-10 w-10" : "h-5 w-5 self-center";
  if (mimeType.startsWith("image/"))
    return <Image className={clsx(cls, "text-green-500")} />;
  if (mimeType.startsWith("video/"))
    return <Film className={clsx(cls, "text-purple-500")} />;
  if (mimeType.startsWith("audio/"))
    return <Music className={clsx(cls, "text-pink-500")} />;
  if (/zip|tar|gz|rar/.test(mimeType))
    return <Archive className={clsx(cls, "text-orange-400")} />;
  return <FileText className={clsx(cls, "text-blue-400")} />;
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-center select-none">
      <Folder className="h-16 w-16 text-gray-200 mb-3" />
      <p className="text-gray-500 font-medium">This folder is empty</p>
      <p className="text-sm text-gray-400 mt-1">
        Drop files here or click Upload
      </p>
    </div>
  );
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-4 lg:grid-cols-6 gap-3">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="flex flex-col items-center gap-2 p-3">
          <div className="h-10 w-10 rounded-lg bg-gray-200 animate-pulse" />
          <div className="h-3 w-16 rounded bg-gray-200 animate-pulse" />
        </div>
      ))}
    </div>
  );
}
