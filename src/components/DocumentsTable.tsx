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

interface OcrStatusResponse {
  status: string;
  extractedText?: string;
}

interface LlmResponse {
  explanation?: string;
  // Add other possible response properties here
}

export default function DocumentsTable({ docs, onRefresh, onStartOcr }: Props) {
  const [replacingId, setReplacingId] = useState<number | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState<string>("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDocs, setSelectedDocs] = useState<number[]>([]);
  const [ocrText, setOcrText] = useState<string>("");
  const [statuses, setStatuses] = useState<Map<number, OcrStatus>>(new Map());
  const [activeOcrIds, setActiveOcrIds] = useState<number[]>([]);
  const [llmSessions, setLlmSessions] = useState<Map<number, number | null>>(new Map());
  const [userQuestion, setUserQuestion] = useState<string>(""); // Track user input
  const [llmAnswers, setLlmAnswers] = useState<string[]>([]); // Track LLM answers
  const [llmQuestions, setLlmQuestions] = useState<string[]>([]); // Track LLM questions
  const [currentDocId, setCurrentDocId] = useState<number | null>(null);
  type ModalType = 'file' | 'ocr' | 'llm';
  const [modalType, setModalType] = useState<ModalType>('file');

  function isLlmSessionInitialized(docId: number): boolean {
    const llmId = llmSessions.get(docId);
    return llmId !== null && llmId !== undefined;
}

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

  const handleUserQuery = async () => {
    if (!userQuestion.trim()) return;

    if (!currentDocId) {
      alert("No document selected.");
      return;
    }

    try {
      const llmId = await getLlmIdForDoc(currentDocId);
      
      if (!llmId) {
        alert("No LLM session initialized for this document.");
        return;
      }

      const token = getToken();
      const res = await fetch(`/documents/${currentDocId}/llm/${llmId}/answer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ text: userQuestion }),
      });

      if (!res.ok) {
        const errorData = await res.json(); // Try to get error details
        alert(`Failed to send question: ${errorData.message || res.statusText}`);
        return;
      }

      const data = await res.json();
      const newAnswer = data.llmSession.answers[data.llmSession.answers.length - 1];

      setLlmQuestions((prev) => [...prev, userQuestion]);
      setLlmAnswers((prev) => [...prev, newAnswer]);
      setUserQuestion("");
    } catch (err) {
      console.error("LLM query failed:", err);
      alert(`LLM query failed: ${err instanceof Error ? err.message : String(err)}`);
    }
};

  async function handleRunLlm(docId: number) {
  try {
    setCurrentDocId(docId);
    const token = getToken();
    
    const res = await fetch(`/documents/${docId}/ocr/status`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    
    if (!res.ok && res.status !== 304) throw new Error('Failed to fetch OCR status');
    const data: OcrStatusResponse = await res.json();

    if (data.extractedText) {
      // Add context prompt to the OCR text
      const prompt = "Please give context to the following:\n\n" + data.extractedText;
      
      const llmSessionRes = await fetch(`/documents/${docId}/llm/session`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (llmSessionRes.ok) {
        const chatHistory = await llmSessionRes.json();
        openModalWithChatHistory(docId, {
          questions: chatHistory.questions,
          answers: chatHistory.answers
        });
      } else if (llmSessionRes.status === 404) {
        const llmResponse = await apiFetch(`/documents/${docId}/llm/initialize`, {
          method: 'POST',
          body: JSON.stringify({ text: prompt }), // Use the prompted text
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        }) as { llmSession: { id: number } };

        if (llmResponse.llmSession) {
          setLlmSessions((prev) => new Map(prev).set(docId, llmResponse.llmSession.id));
          
          // Set initial state with loading message
          openModalWithChatHistory(docId, {
            questions: [prompt],
            answers: ['Generating contextualization...']
          });

          // Poll for the actual response
          pollForContextualization(docId, llmResponse.llmSession.id);
        }
      }
    } else {
      alert('OCR is still processing or failed.');
    }
  } catch (err: unknown) {
    if (isError(err)) {
      alert(`Failure: ${err.message}`);
    } else {
      alert('An unknown error occurred');
    }
  }
}

async function pollForContextualization(docId: number, sessionId: number) {
  const token = getToken();
  let attempts = 0;
  const maxAttempts = 10;
  const pollInterval = 1000; // 1 second

  const poll = async () => {
    try {
      const res = await fetch(`/documents/${docId}/llm/session`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (res.ok) {
        const sessionData = await res.json();
        
        // Check if we have an answer now
        if (sessionData.answers.length > 0 && 
            sessionData.answers[0] !== 'Generating contextualization...') {
          // Update the answer in state
          setLlmAnswers(prev => {
            const newAnswers = [...prev];
            newAnswers[0] = sessionData.answers[0]; // Update first answer
            return newAnswers;
          });
          return;
        }
      }

      if (++attempts < maxAttempts) {
        setTimeout(poll, pollInterval);
      } else {
        console.warn('Contextualization polling timeout');
      }
    } catch (err) {
      console.error('Polling error:', err);
    }
  };

  poll();
}


// Helper function to get the LLM session ID
async function getLlmIdForDoc(docId: number): Promise<number | null> {
  const token = getToken();
  const llmSessionRes = await fetch(`/documents/${docId}/llm/session`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
  
  let llmId = null;
  if (llmSessionRes.ok) {
    const llmSessionData = await llmSessionRes.json();
    llmId = llmSessionData.id;
  }
  
  return llmId || null;  // Return the LLM session ID or null if not found
}

  // Type guard to check if the error is an instance of Error
  function isError(err: unknown): err is Error {
  return err instanceof Error;
    }


  async function openModalWithChatHistory(docId: number, chatHistory: { questions: string[], answers: string[] }) {
  try {
    if (!chatHistory || chatHistory.questions.length === 0) {
      alert('No chat history found');
      return;
    }

    setLlmQuestions(chatHistory.questions);
    setLlmAnswers(chatHistory.answers);
    setOcrText(chatHistory.questions[0]);

    setModalType('llm');
    setPreviewName('LLM Chat History');
    setIsModalOpen(true);

  } catch (err: unknown) {
    if (isError(err)) {
      alert(`Failed to load chat history: ${err.message}`);
    } else {
      alert('An unknown error occurred');
    }
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
      setCurrentDocId(doc.id);
      setModalType('file');
      openModal(url, doc.originalName);
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

      if (!res.ok && res.status !== 304) throw new Error('Failed to fetch OCR status');
      const data = await res.json();

      //if (data.status === "completed") {
      if (data) {
        setCurrentDocId(doc.id);
        setOcrText(data.extractedText); 
        setModalType('ocr');
        openModal("", doc.originalName);
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
                      onClick={() => handleDownload(d)}
                      className="bg-gray-100 text-xs text-gray-600 rounded px-2 py-1 hover:bg-gray-200"
                    >
                      Download File
                    </button>
                    <button
                      onClick={() => handlePreview(d)}
                      className="bg-purple-200 text-xs text-gray-600 rounded px-2 py-1 hover:bg-purple-300"
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
                      onClick={() => runOcr(d.id)}
                      className="bg-indigo-600 text-xs text-white rounded px-2 py-1 hover:bg-indigo-700"
                    >
                      Run OCR
                    </button>

                    <button
                      onClick={() => {
                        setCurrentDocId(d.id); 
                        handleRunLlm(d.id);    
                      }}
                      disabled={!d.extractedText}
                      className={`bg-blue-600 text-xs text-white rounded px-2 py-1 hover:bg-blue-700 ${!d.extractedText ? 'cursor-not-allowed opacity-50' : ''}`}
                    >
                      Run LLM
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

     
      {isModalOpen && (
  <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
    <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
      {/* Modal Header */}
      <div className="p-6 pb-0 flex-shrink-0">
        <div className="flex justify-between items-start">
          <h3 className="text-xl font-semibold">{previewName}</h3>
          <button
            onClick={closeModal}
            className="text-gray-500 hover:text-gray-800 text-2xl"
          >
            &times;
          </button>
        </div>
      </div>

      {/* Modal Body - Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {modalType === 'file' && previewUrl && (
          <div className="flex justify-center">
            <img 
              src={previewUrl} 
              alt="Document Preview" 
              className="max-w-full max-h-[70vh] object-contain"
            />
          </div>
        )}

        {modalType === 'ocr' && ocrText && (
          <pre className="whitespace-pre-wrap font-sans text-sm bg-gray-50 p-4 rounded">
            {ocrText}
          </pre>
        )}

        {modalType === 'llm' && (
          <div className="space-y-4">
            <h4 className="font-bold text-lg text-gray-800">LLM Chat History</h4>
            
            {/* OCR Generated Text (with prompt) */}
            {llmQuestions.length > 0 && (
              <div className="bg-gray-50 p-4 rounded">
                <h4 className="font-semibold text-indigo-700 mb-2">Document Content:</h4>
                <pre className="whitespace-pre-wrap text-sm text-gray-700 max-h-[200px] overflow-y-auto">
                  {llmQuestions[0].replace("Please give context to the following:\n\n", "")}
                </pre>
              </div>
            )}

            {/* Contextualization (First Answer) */}
            {llmAnswers.length > 0 && (
              <div className="bg-blue-50 p-4 rounded">
                <h4 className="font-semibold text-blue-700 mb-2">Contextualization:</h4>
                <pre className="whitespace-pre-wrap text-sm text-gray-700">
                  {llmAnswers[0]}
                </pre>
              </div>
            )}

            {/* Q&A History (Skip first items) */}
            {llmQuestions.length > 1 && (
              <div className="space-y-4">
                <h4 className="font-semibold text-gray-700">Conversation:</h4>
                {llmQuestions.slice(1).map((question, index) => (
                  <div key={index} className="space-y-2">
                    <div className="bg-white border border-gray-200 p-3 rounded">
                      <h4 className="font-semibold text-gray-700">Question:</h4>
                      <p className="whitespace-pre-wrap">{question}</p>
                    </div>
                    {llmAnswers[index + 1] && (
                      <div className="bg-gray-50 p-3 rounded ml-4">
                        <h4 className="font-semibold text-gray-700">Answer:</h4>
                        <p className="whitespace-pre-wrap">{llmAnswers[index + 1]}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input Area - Fixed at bottom (LLM mode only) */}
      {modalType === 'llm' && (
        <div className="p-6 border-t bg-white flex-shrink-0">
          <div className="flex gap-2">
            <input
              type="text"
              value={userQuestion}
              onChange={(e) => setUserQuestion(e.target.value)}
              className="flex-1 border p-2 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Ask a question about this document..."
              onKeyPress={(e) => e.key === 'Enter' && handleUserQuery()}
            />
            <button
              onClick={handleUserQuery}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
            >
              Ask
            </button>
          </div>
        </div>
      )}
    </div>
  </div>
)}
    </section>
  );
}