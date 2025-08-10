"use client";

import { apiFetch } from "@/lib/api";
import { useState, useRef } from "react";

type Props = { onDone: () => void };

export default function UploadForm({ onDone }: Props) {
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const input = fileInputRef.current;
    const file = input?.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    try {
      setBusy(true);
      await apiFetch("/documents", { method: "POST", body: form });
      if (input) input.value = "";
      setFileName(null);
      onDone();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
    } else {
      setFileName(null);
    }
  }

  function triggerFileInput() {
    fileInputRef.current?.click();
  }

  return (
    <form
        onSubmit={onSubmit}
        className="bg-white p-6 rounded-2xl shadow-md space-y-4 w-full max-w-full mx-auto" // Max width is now full, with mx-auto to center the content
    >
        <h2 className="text-xl font-medium text-center">Upload Image</h2>

        <div className="flex flex-col items-center space-y-2"> {/* Center the buttons */}
        <input
            name="file"
            type="file"
            accept="image/png,image/jpeg"
            className="hidden"
            onChange={handleFileChange}
            ref={fileInputRef}
        />

        {/* Choose File button with white background */}
        <button
            type="button"
            onClick={triggerFileInput}
            className="w-full max-w-xs bg-white border border-gray-300 text-gray-800 rounded-lg py-2 hover:bg-gray-50 transition-colors"
        >
            Choose File
        </button>

        <button
            type="submit"
            disabled={busy || !fileName}
            className="w-full max-w-xs bg-blue-600 text-white rounded-lg py-2 hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
            {busy ? "Uploading…" : "Upload"}
        </button>

        <span className="text-sm text-gray-600">
            {fileName ? fileName : "No file chosen"}
        </span>
        </div>
    </form>
    );
}