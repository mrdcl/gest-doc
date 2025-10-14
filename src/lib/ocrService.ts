import { supabase } from './supabase';

export async function processDocumentOCR(documentId: string): Promise<boolean> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.error('No session found');
      return false;
    }

    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-document-ocr`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ documentId }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('OCR processing failed:', error);
      return false;
    }

    const result = await response.json();
    console.log('OCR processing successful:', result);
    return true;
  } catch (error) {
    console.error('Error calling OCR function:', error);
    return false;
  }
}

export async function reprocessAllDocuments(onProgress?: (current: number, total: number) => void): Promise<{ success: number; failed: number }> {
  try {
    const { data: documents, error } = await supabase
      .from('entity_documents')
      .select('id, file_name, mime_type')
      .order('uploaded_at', { ascending: true });

    if (error) throw error;

    if (!documents || documents.length === 0) {
      return { success: 0, failed: 0 };
    }

    let success = 0;
    let failed = 0;

    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i];

      if (onProgress) {
        onProgress(i + 1, documents.length);
      }

      const mimeType = doc.mime_type?.toLowerCase() || '';
      const isProcessable = mimeType === 'application/pdf' || mimeType.startsWith('image/');

      if (!isProcessable) {
        console.log(`Skipping ${doc.file_name} - unsupported type: ${mimeType}`);
        continue;
      }

      const result = await processDocumentOCR(doc.id);

      if (result) {
        success++;
      } else {
        failed++;
      }

      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return { success, failed };
  } catch (error) {
    console.error('Error reprocessing documents:', error);
    throw error;
  }
}
