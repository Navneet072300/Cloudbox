'use client';
import { ChevronRight, Home } from 'lucide-react';

interface Crumb { id: string; name: string; }

interface Props {
  items:      Crumb[];
  onNavigate: (index: number) => void;
}

export function Breadcrumb({ items, onNavigate }: Props) {
  return (
    <div className="flex items-center gap-1 px-4 py-2 border-b border-gray-200 bg-white text-sm overflow-x-auto">
      <button
        type="button"
        onClick={() => onNavigate(-1)}
        className="flex items-center gap-1 text-gray-500 hover:text-gray-900 font-medium shrink-0 transition-colors"
      >
        <Home className="h-3.5 w-3.5" />
        My Drive
      </button>

      {items.map((crumb, i) => (
        <div key={crumb.id} className="flex items-center gap-1 shrink-0">
          <ChevronRight className="h-3.5 w-3.5 text-gray-300" />
          <button
            type="button"
            onClick={() => onNavigate(i)}
            className={`font-medium transition-colors ${
              i === items.length - 1
                ? 'text-gray-900 cursor-default'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            {crumb.name}
          </button>
        </div>
      ))}
    </div>
  );
}
