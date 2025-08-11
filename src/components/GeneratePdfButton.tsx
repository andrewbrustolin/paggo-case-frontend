import { useState } from 'react';
import { getToken } from '@/lib/api';

interface GeneratePdfButtonProps {
  docId: number;
  disabled?: boolean;
  hasExtractedText: boolean;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
  onLlmRun?: () => void; // Add this back
}

export function GeneratePdfButton({ 
  docId, 
  disabled, 
  hasExtractedText,
  onSuccess, 
  onError,
  onLlmRun // Add this back
}: GeneratePdfButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGeneratePdf = async () => {
    try {
      setIsGenerating(true);
      const token = getToken();
      
      // First check if LLM session exists
      const sessionRes = await fetch(`/documents/${docId}/llm/session`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (!sessionRes.ok) {
        throw new Error('Please run LLM contextualization first');
      }

      const sessionData = await sessionRes.json();
      if (!sessionData.answers || sessionData.answers.length === 0) {
        throw new Error('Please run LLM contextualization first');
      }

      // Generate PDF
      const response = await fetch(`/documents/${docId}/pdf/generate`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (!response.ok) {
        throw new Error('Failed to generate PDF');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `document-${docId}-report.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      onSuccess?.();
    } catch (err) {
      console.error('PDF generation failed:', err);
      onError?.(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsGenerating(false);
    }
  };

  const isDisabled = disabled || !hasExtractedText || isGenerating;

  return (
    <button
      onClick={handleGeneratePdf}
      disabled={isDisabled}
      className={`bg-green-600 text-xs text-white rounded px-2 py-1 hover:bg-green-700 ${
        isDisabled ? 'cursor-not-allowed opacity-50' : ''
      } ${
        isGenerating ? 'relative' : ''
      }`}
      title={!hasExtractedText ? "OCR text required" : undefined}
    >
      {isGenerating ? (
        <>
          <span className="invisible">Generate PDF</span>
          <div className="absolute inset-0 flex items-center justify-center">
            <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        </>
      ) : (
        'Generate PDF'
      )}
    </button>
  );
}