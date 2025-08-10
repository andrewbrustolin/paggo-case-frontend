"use client";

import { apiFetch } from "@/lib/api";
import { useState, useRef } from "react";

type Props = {
  onAccepted: (docId: number, statusEndpoint: string) => void;
};

export default function UploadWithOcrForm({ onAccepted }: Props) {
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
      
      // Use the combined upload+OCR endpoint
      const res = await apiFetch<{ 
        accepted: boolean;
        documentId: number;
        statusEndpoint: string;
      }>("/documents/with-ocr/async", { 
        method: "POST", 
        body: form 
      });

      if (!res.accepted) {
        throw new Error("OCR request was not accepted");
      }

      if (input) input.value = "";
      setFileName(null);
      onAccepted(res.documentId, res.statusEndpoint);
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
    <form onSubmit={onSubmit} className="bg-white p-6 rounded-2xl shadow-md space-y-4">
      <h2 className="text-xl font-medium text-center">Upload + OCR (async)</h2>

      <div className="flex flex-col items-start space-y-2">
        <input
          name="file"
          type="file"
          accept="image/png,image/jpeg"
          className="hidden"
          onChange={handleFileChange}
          ref={fileInputRef}
          required
        />

        <button
          type="button"
          onClick={triggerFileInput}
          className="w-full bg-white border border-gray-300 text-gray-800 rounded-lg py-2 hover:bg-gray-50 transition-colors"
        >
          Choose File
        </button>

        <button
          type="submit"
          disabled={busy || !fileName}
          className={`w-full bg-indigo-600 text-white rounded-lg py-2 hover:bg-indigo-700 transition-colors ${
            busy || !fileName ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          {busy ? "Processing..." : "Upload & Start OCR"}
        </button>

        <span className="text-sm text-gray-600">
          {fileName ? fileName : "No file chosen"}
        </span>
      </div>
    </form>
  );
}