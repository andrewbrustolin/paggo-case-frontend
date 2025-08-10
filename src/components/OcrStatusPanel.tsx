"use client";

import { OcrStatus, apiFetch } from "@/lib/api";
import { useEffect, useState } from "react";

type Props = {
  documentIds: number[];
  activeOcrIds: number[];
  statusEndpoint: string | null;
  onFinish?: () => void;
  onStatusUpdate?: (docId: number, status: OcrStatus) => void;
};

const POLL_INTERVAL = 1200;

export default function OcrStatusPanel({ 
  documentIds = [], 
  activeOcrIds = [],
  statusEndpoint, 
  onFinish, 
  onStatusUpdate 
}: Props) {
  const [statuses, setStatuses] = useState<Map<number, OcrStatus>>(new Map());

  useEffect(() => {
    if (!statusEndpoint || activeOcrIds.length === 0) return;

    const activePollers = new Map<number, NodeJS.Timeout>();
    let isMounted = true;

    const pollDocument = async (docId: number) => {
      if (!isMounted) return;

      try {
        const st = await apiFetch<OcrStatus>(`${statusEndpoint}/${docId}/ocr/status`);
        
        if (!isMounted) return;

        setStatuses(prev => {
          const newStatuses = new Map(prev);
          newStatuses.set(docId, st);
          return newStatuses;
        });

        onStatusUpdate?.(docId, st);

        // Stop polling if completed or failed
        if (st.status === 'completed' || st.status === 'failed') {
          const poller = activePollers.get(docId);
          if (poller) {
            clearInterval(poller);
            activePollers.delete(docId);
          }

          // Check if all documents are done
          if (activePollers.size === 0) {
            onFinish?.();
          }
        }
      } catch (e) {
        console.error('Polling error:', e);
        const poller = activePollers.get(docId);
        if (poller) {
          clearInterval(poller);
          activePollers.delete(docId);
        }
      }
    };

    // Only poll documents that have active OCR
    activeOcrIds.forEach(docId => {
      // Initial poll immediately
      pollDocument(docId);
      
      // Then set up interval
      const intervalId = setInterval(() => pollDocument(docId), POLL_INTERVAL);
      activePollers.set(docId, intervalId);
    });

    return () => {
      isMounted = false;
      activePollers.forEach(poller => clearInterval(poller));
    };
  }, [activeOcrIds, statusEndpoint]); // Only re-run when activeOcrIds changes

  // Filter to only show status for documents with active OCR
  const documentsToShow = activeOcrIds.filter(docId => {
    const status = statuses.get(docId);
    return !status || (status.status !== 'completed' && status.status !== 'failed');
  });

  if (documentsToShow.length === 0) return null;

  return (
    <section className="bg-white p-4 rounded-2xl shadow space-y-4">
      {documentsToShow.map((docId) => {
        const status = statuses.get(docId) || { status: 'queued', progress: 0 };
        const pct = Math.min(status.progress ?? 0, 100);

        return (
          <div key={docId} className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-500">OCR status for document #{docId}</div>
              <div className="text-lg font-medium">
                {status.message || 
                 (status.status === 'queued' ? 'Queued' : 
                  status.status === 'running' ? 'Processing' : 
                  status.status === 'completed' ? 'Completed' : 
                  status.status === 'failed' ? 'Failed' : 'Pending')}
              </div>
            </div>
            <div className="w-64">
              <div className="h-2 bg-gray-200 rounded">
                <div 
                  className={`h-2 rounded ${
                    status.status === 'completed' ? 'bg-green-600' :
                    status.status === 'failed' ? 'bg-red-600' : 'bg-indigo-600'
                  }`} 
                  style={{ width: `${pct}%` }} 
                />
              </div>
              <div className="text-right text-xs text-gray-500 mt-1">
                {pct}% {status.status === 'completed' && '(Completed)'}
                {status.status === 'failed' && '(Failed)'}
              </div>
            </div>
          </div>
        );
      })}
    </section>
  );
}