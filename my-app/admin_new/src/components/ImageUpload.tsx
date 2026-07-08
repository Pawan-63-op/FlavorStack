"use client";
import { useState, useRef, useId } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui//label";
import { Upload, X } from "lucide-react";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { Input } from "@/components/ui/input";

interface ImageUploadProps {
  value?: string;
  onChange: (file: File | null, previewUrl: string | null) => void;
  label?: string;
  accept?: string;
  /** Owner-write image endpoints reject bodies over this size (Phase-10.md Batch 10.0 §9, server cap 5 MB). */
  maxSizeBytes?: number;
}

const DEFAULT_MAX_SIZE_BYTES = 5 * 1024 * 1024;

export function ImageUpload({
  value,
  onChange,
  label = "Image",
  accept = "image/*",
  maxSizeBytes = DEFAULT_MAX_SIZE_BYTES,
}: ImageUploadProps) {
  const [preview, setPreview] = useState<string | null>(value || null);
  const [sizeError, setSizeError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Unique per instance so the <label htmlFor> association is correct even when
  // multiple ImageUpload components render on the same page.
  const inputId = useId();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > maxSizeBytes) {
      setSizeError(`Image must be ${Math.floor(maxSizeBytes / (1024 * 1024))} MB or smaller`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setSizeError(null);

    const reader = new FileReader();
    reader.onloadend = () => {
      const previewUrl = reader.result as string;
      setPreview(previewUrl);
      onChange(file, previewUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleRemove = () => {
    setPreview(null);
    setSizeError(null);
    onChange(null, null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-4">
        {preview ? (
          <div className="relative">
            <ImageWithFallback
              src={preview}
              alt="Preview"
              className="w-32 h-32 object-cover rounded-lg border-2 border-border"
            />
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
              onClick={handleRemove}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <div className="w-32 h-32 border-2 border-dashed border-border rounded-lg flex items-center justify-center bg-muted/30">
            <Upload className="h-8 w-8 text-muted-foreground" />
          </div>
        )}
        <div className="flex-1">
          <Input
            ref={fileInputRef}
            type="file"
            accept={accept}
            onChange={handleFileChange}
            className="sr-only"
            id={inputId}
          />
          {/* Native <label htmlFor> trigger — opens the file picker without a
              JS `.click()` on a hidden input, which some browsers/environments
              (e.g. WSL) silently ignore. */}
          <Button asChild variant="outline">
            <label htmlFor={inputId} className="cursor-pointer">
              <Upload className="h-4 w-4 mr-2" />
              {preview ? "Change Image" : "Upload Image"}
            </label>
          </Button>
          <p className="text-sm text-muted-foreground mt-2">
            PNG, JPG, GIF up to {Math.floor(maxSizeBytes / (1024 * 1024))}MB
          </p>
          {sizeError && <p className="text-sm text-destructive mt-1">{sizeError}</p>}
        </div>
      </div>
    </div>
  );
}
