"use client";

import { useEffect, useState } from "react";
import AuthGate from "@/components/AuthGate";
import UploadForm from "@/components/UploadForm";
import UploadWithOcrForm from "@/components/UploadWithOcrForm";
import DocumentsTable from "@/components/DocumentsTable";
import { DocumentRow, apiFetch } from "@/lib/api";

export default function Page() {
  const [docs, setDocs] = useState<DocumentRow[]>([]);
  const [statusDocId, setStatusDocId] = useState<number | null>(null);
  const [statusEndpoint, setStatusEndpoint] = useState<string | null>(null);

  async function loadDocs() {
    const rows = await apiFetch<DocumentRow[]>("/documents");
    setDocs(rows);
  }

  useEffect(() => {
    loadDocs().catch(() => {});
  }, []);

  return (
    <AuthGate onLogin={loadDocs}>
      {({ logout }) => (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Documents</h1>
            <button
              onClick={logout}
              className="bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium py-2 px-4 rounded-lg transition-colors duration-200 flex items-center"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 mr-2"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z"
                  clipRule="evenodd"
                />
              </svg>
              Log Out
            </button>
          </div>

          <section className="mb-8">
            <div className="grid md:grid-cols-1 gap-6">
                <UploadForm onDone={loadDocs} />
            </div>
          </section>

          <div className="mt-8">
            <DocumentsTable
              docs={docs}
              onRefresh={loadDocs}
              onStartOcr={(id, endpoint) => {
                setStatusDocId(id);
                setStatusEndpoint(endpoint);
              }}
            />
          </div>
        </div>
      )}
    </AuthGate>
  );
}