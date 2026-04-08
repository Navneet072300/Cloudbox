"use client";
import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { foldersApi } from "@/lib/api";
import { useUpload } from "@/hooks/useUpload";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Upload, FolderPlus, Grid3X3, List, Loader2 } from "lucide-react";

interface Props {
  folderId: string | null;
  viewMode: "grid" | "list";
  onViewModeChange: (m: "grid" | "list") => void;
}

export function Toolbar({ folderId, viewMode, onViewModeChange }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showFolder, setShowFolder] = useState(false);
  const [folderName, setFolderName] = useState("");
  const { uploadFiles } = useUpload(folderId);
  const queryClient = useQueryClient();

  const { mutate: createFolder, isPending } = useMutation({
    mutationFn: () => foldersApi.create(folderName.trim(), folderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["files", folderId] });
      setShowFolder(false);
      setFolderName("");
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length) uploadFiles(files);
    e.target.value = "";
  };

  return (
    <>
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 bg-white">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileSelect}
        />

        <Button onClick={() => fileInputRef.current?.click()} size="sm">
          <Upload className="h-3.5 w-3.5" />
          Upload
        </Button>

        <Button
          variant="secondary"
          size="sm"
          onClick={() => setShowFolder(true)}
        >
          <FolderPlus className="h-3.5 w-3.5" />
          New folder
        </Button>

        <div className="flex-1" />

        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          <button
            type="button"
            onClick={() => onViewModeChange("grid")}
            className={`p-1.5 ${viewMode === "grid" ? "bg-gray-100" : "hover:bg-gray-50"}`}
            title="Grid view"
          >
            <Grid3X3 className="h-4 w-4 text-gray-600" />
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange("list")}
            className={`p-1.5 ${viewMode === "list" ? "bg-gray-100" : "hover:bg-gray-50"}`}
            title="List view"
          >
            <List className="h-4 w-4 text-gray-600" />
          </button>
        </div>
      </div>

      <Modal
        open={showFolder}
        onClose={() => setShowFolder(false)}
        title="New folder"
      >
        <form
          className="p-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (folderName.trim()) createFolder();
          }}
        >
          <div className="space-y-1.5">
            <label
              htmlFor="folder-name"
              className="text-sm font-medium text-gray-700"
            >
              Folder name
            </label>
            <Input
              id="folder-name"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              placeholder="My folder"
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowFolder(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !folderName.trim()}>
              {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Create
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
