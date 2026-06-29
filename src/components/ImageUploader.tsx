/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from 'react';
import { Upload, X, Image as ImageIcon, CheckCircle2 } from 'lucide-react';

interface ImageUploaderProps {
  previewUrl: string | undefined;
  onChange: (base64OrUrl: string | undefined) => void;
}

export default function ImageUploader({ previewUrl, onChange }: ImageUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file (PNG, JPG, JPEG).');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      onChange(base64String);
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(undefined);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="w-full">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
        id="image-file-input"
      />

      {previewUrl ? (
        <div className="relative w-full h-[220px] rounded-xl overflow-hidden border border-zinc-200 group">
          <img
            src={previewUrl}
            alt="Issue evidence preview"
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
          {/* Overlay mask */}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 bg-white text-zinc-900 rounded-lg text-xs font-semibold hover:bg-zinc-100 shadow-sm cursor-pointer"
            >
              Replace Photo
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="p-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 shadow-sm cursor-pointer"
              title="Remove photo"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="absolute bottom-3 left-3 px-2.5 py-1 bg-zinc-900/85 text-white text-[10px] font-semibold rounded-md flex items-center gap-1 shadow">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Evidence Locked
          </div>
        </div>
      ) : (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`w-full h-[180px] rounded-xl border-2 border-dashed flex flex-col items-center justify-center p-4 text-center cursor-pointer transition-all duration-200 ${
            isDragging
              ? 'border-rose-500 bg-rose-50/50 scale-[0.99]'
              : 'border-zinc-300 hover:border-zinc-400 hover:bg-zinc-50'
          }`}
        >
          <div className="p-3 bg-zinc-100 rounded-full text-zinc-500 group-hover:scale-110 transition-transform mb-3">
            <Upload className="w-5 h-5" />
          </div>
          <p className="text-sm font-semibold text-zinc-800">
            Click to upload, or drag and drop
          </p>
          <p className="text-xs text-zinc-500 mt-1">
            PNG, JPG, or JPEG (Max 5MB)
          </p>
        </div>
      )}
    </div>
  );
}
