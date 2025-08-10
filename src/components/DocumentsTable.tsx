"use client";

import { DocumentRow, OcrStatus, apiFetch } from "@/lib/api";
import { getToken } from "@/lib/api";
import { useEffect, useState } from "react";
import OcrStatusPanel from "./OcrStatusPanel";

type Props = {
  docs: DocumentRow[];
  onRefresh: () => void;
  onStartOcr: (docId: number, statusEndpoint: string) => void;
};

export default function DocumentsTable({ docs, onRefresh, onStartOcr }: Props) {
  const [replacingId, setReplacingId] = useState<number | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState<string>("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDocs, setSelectedDocs] = useState<number[]>([]);
  const [ocrText, setOcrText] = useState<string>("");
  const [statuses, setStatuses] = useState<Map<number, OcrStatus>>(new Map());
  const [activeOcrIds, setActiveOcrIds] = useState<number[]>([]);

  function bytes(n: number) {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1024 / 1024).toFixed(1)} MB`;
  }

  // Update the status in the docs array when the OCR status is updated
  function handleStatusUpdate(docId: number, status: OcrStatus) {
    setStatuses((prev) => {
      const newStatuses = new Map(prev);
      newStatuses.set(docId, status);
      return newStatuses;
    });

    // If OCR is completed, refresh the documents list to update the "OCR" column
    if (status.status === 'completed') {
      onRefresh();
    }

    // Remove from active OCR IDs if completed or failed
    if (status.status === 'completed' || status.status === 'failed') {
      setActiveOcrIds(prev => prev.filter(id => id !== docId));
    }
  }

  async function handleStartOcr(docId: number, endpoint: string) {
    setStatuses((prev) => prev.set(docId, { status: 'queued', progress: 0 }));
    setActiveOcrIds(prev => [...prev, docId]);
    await onStartOcr(docId, endpoint);
  }

  async function replaceFile(docId: number, file: File) {
    const form = new FormData();
    form.append("file", file);
    try {
      setReplacingId(docId);
      await apiFetch(`/documents/${docId}/file`, { method: "PUT", body: form });
      await onRefresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setReplacingId(null);
    }
  }

  async function runOcr(docId: number) {
    try {
      // Set initial status immediately
      handleStatusUpdate(docId, { status: 'queued', progress: 0 });
      setActiveOcrIds(prev => [...prev, docId]);

      const res = await apiFetch<{ accepted: boolean; documentId: number; statusEndpoint: string }>(
        `/documents/${docId}/ocr`,
        { method: "POST" }
      );
      
      // Start polling for this document
      onStartOcr(docId, `/documents/${docId}/ocr/status`);
    } catch (err: any) {
      alert(err.message);
      handleStatusUpdate(docId, { status: 'failed', progress: 0, error: err.message });
    }
  }

  async function fetchFileBlob(docId: number): Promise<Blob> {
    const token = getToken();
    const res = await fetch(`/documents/${docId}/file`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!res.ok) throw new Error(await res.text());
    return res.blob(); 
  }

  async function handlePreview(doc: DocumentRow) {
    try {
      const blob = await fetchFileBlob(doc.id);
      const url = URL.createObjectURL(blob);
      openModal(url, doc.originalName || `document-${doc.id}`);
    } catch (err: any) {
      alert(`Preview failed: ${err.message}`);
    }
  }

  async function handlePreviewOcr(doc: DocumentRow) {
    try {
      const token = getToken(); 
      const res = await fetch(`/documents/${doc.id}/ocr/status`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) throw new Error('Failed to fetch OCR status');
      const data = await res.json();

      if (data.status === "completed") {
        setOcrText(data.extractedText); 
        openModal("", doc.originalName || `document-${doc.id}`);
      } else {
        alert("OCR is still processing or failed.");
      }
    } catch (err: any) {
      alert(`Failed to load OCR text: ${err.message}`);
    }
  }

  async function handleDownload(doc: DocumentRow) {
    try {
      const token = getToken();
      const res = await fetch(`/documents/${doc.id}/file?download=1`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = doc.originalName || `document-${doc.id}`;
      document.body.appendChild(a);
      a.click();
      a.remove();

      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (err: any) {
      alert(`Download failed: ${err.message}`);
    }
  }

  async function deleteFile(docId: number) {
    try {
      await apiFetch(`/documents/${docId}`, { method: "DELETE" });
      onRefresh();
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  }

  function toggleSelect(docId: number) {
    setSelectedDocs(prev => 
      prev.includes(docId) ? prev.filter(id => id !== docId) : [...prev, docId]
    );
  }

  function toggleSelectAll() {
    if (selectedDocs.length === docs.length) {
      setSelectedDocs([]);
    } else {
      setSelectedDocs(docs.map(doc => doc.id));
    }
  }

  async function deleteSelected() {
    try {
      for (const docId of selectedDocs) {
        await deleteFile(docId);
      }
      setSelectedDocs([]);
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  }

  const openModal = (url: string, name: string) => {
    setPreviewUrl(url);
    setPreviewName(name);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setPreviewUrl(null);
    setOcrText("");
  };

  async function ocrForSelected() {
    try {
      for (const docId of selectedDocs) {
        await runOcr(docId);
      }
    } catch (err: any) {
      alert(`OCR failed: ${err.message}`);
    }
  }

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  return (
    <section className="bg-white p-8 rounded-xl shadow-lg border border-gray-100">
      <div className="overflow-x-auto">
        <div className="flex justify-between mb-4">
          <button
            onClick={toggleSelectAll}
            className="bg-gray-100 text-xs text-gray-600 rounded px-4 py-2 hover:bg-gray-200"
          >
            Select All
          </button>

          <div>
            <button
              onClick={ocrForSelected}
              className="bg-indigo-600 text-xs text-white rounded px-4 py-2 hover:bg-indigo-700"
            >
              Run OCR on All Selected
            </button>
            <button
              onClick={deleteSelected}
              className="bg-red-600 text-xs text-white rounded px-4 py-2 hover:bg-red-700 mr-2"
            >
              Delete All Selected
            </button>
          </div>
        </div>

        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="py-3 px-4">
                <input
                  type="checkbox"
                  checked={selectedDocs.length === docs.length}
                  onChange={toggleSelectAll}
                  className="form-checkbox"
                />
              </th>
              <th className="py-3 px-4">ID</th>
              <th className="py-3 px-4">Original Name</th>
              <th className="py-3 px-4">Size</th>
              <th className="py-3 px-4">Created</th>
              <th className="py-3 px-4">OCR</th>
              <th className="py-3 px-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {docs.length === 0 && (
              <tr><td colSpan={7} className="py-6 text-center text-gray-500">No documents yet.</td></tr>
            )}
            {docs.map((d) => (
              <tr key={d.id} className="border-b last:border-0">
                <td className="py-2 px-4">
                  <input
                    type="checkbox"
                    checked={selectedDocs.includes(d.id)}
                    onChange={() => toggleSelect(d.id)}
                    className="form-checkbox"
                  />
                </td>
                <td className="py-2 px-4">{d.id}</td>
                <td className="py-2 px-4">{d.originalName}</td>
                <td className="py-2 px-4">{bytes(d.size)}</td>
                <td className="py-2 px-4">{new Date(d.createdAt).toLocaleString()}</td>
                <td className="py-2 px-4">
                  {d.extractedText ? (
                    <span className="text-green-700">Ready</span>
                  ) : (
                    <span className="text-gray-500">Not generated</span>
                  )}
                </td>
                <td className="py-2 px-4">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handlePreview(d)}
                      className="bg-gray-100 text-xs text-gray-600 rounded px-2 py-1 hover:bg-gray-200"
                    >
                      Preview File
                    </button>

                    <button
                      onClick={() => handlePreviewOcr(d)}
                      disabled={!d.extractedText}
                      className={`bg-yellow-600 text-xs text-white rounded px-2 py-1 hover:bg-yellow-700 ${!d.extractedText ? 'cursor-not-allowed opacity-50' : ''}`}
                    >
                      Preview OCR
                    </button>

                    <button
                      onClick={() => handleDownload(d)}
                      className="bg-gray-100 text-xs text-gray-600 rounded px-2 py-1 hover:bg-gray-200"
                    >
                      Download
                    </button>

                    <button
                      onClick={() => runOcr(d.id)}
                      className="bg-indigo-600 text-xs text-white rounded px-2 py-1 hover:bg-indigo-700"
                    >
                      Run OCR
                    </button>

                    <button
                      onClick={() => deleteFile(d.id)}
                      className="bg-red-600 text-xs text-white rounded px-2 py-1 hover:bg-red-700"
                    >
                      Delete File
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Only show status panel for documents with active OCR */}
      {activeOcrIds.length > 0 && (
        <div className="mt-8">
            <OcrStatusPanel
            documentIds={docs.map(doc => doc.id)}
            activeOcrIds={activeOcrIds}
            statusEndpoint="/documents"
            onFinish={() => {
                onRefresh(); // Refresh when all OCR processes finish
            }}
            onStatusUpdate={handleStatusUpdate}
            />
        </div>
        
      )}

      {/* Modal for Image Preview */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-3xl p-6 relative">
            <button
              onClick={closeModal}
              className="absolute top-2 right-2 text-xl text-gray-500 hover:text-gray-800"
            >
              &times;
            </button>
            <h3 className="text-xl font-semibold mb-6 pb-10 text-center">{previewName}</h3> 
            <div className="modal-body overflow-auto" style={{ maxHeight: '80vh' }}>
              {ocrText ? (
                <div
                  className="text-left whitespace-pre-wrap"
                  style={{
                    maxHeight: '70vh',
                    paddingRight: '10px', 
                  }}
                >
                  {ocrText}
                </div>
              ) : (
                previewUrl && (
                  <img
                    src={previewUrl}
                    alt="Document Preview"
                    className="max-w-full h-auto"
                    style={{ objectFit: 'contain', maxHeight: '70vh' }}
                  />
                )
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}