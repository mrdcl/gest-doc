import { createClient } from 'npm:@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface OCRRequest {
  documentId: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { documentId }: OCRRequest = await req.json();

    if (!documentId) {
      return new Response(
        JSON.stringify({ error: 'documentId is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: document, error: docError } = await supabase
      .from('entity_documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      return new Response(
        JSON.stringify({ error: 'Document not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: fileData, error: downloadError } = await supabase.storage
      .from('documents')
      .download(document.file_path);

    if (downloadError || !fileData) {
      return new Response(
        JSON.stringify({ error: 'Failed to download file' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    let extractedText = '';
    const mimeType = document.mime_type.toLowerCase();

    if (mimeType === 'application/pdf') {
      const arrayBuffer = await fileData.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      try {
        const pdfParse = await import('npm:pdf-parse@1.1.1');
        const data = await pdfParse.default(uint8Array);
        extractedText = data.text || '';
      } catch (pdfError) {
        console.error('PDF parsing error:', pdfError);
        extractedText = '[Error al extraer texto del PDF]';
      }
    } else if (mimeType.startsWith('image/')) {
      const Tesseract = await import('npm:tesseract.js@5.0.0');
      const arrayBuffer = await fileData.arrayBuffer();
      const blob = new Blob([arrayBuffer], { type: mimeType });

      try {
        const result = await Tesseract.recognize(blob, 'spa', {
          logger: (m: any) => console.log(m),
        });
        extractedText = result.data.text || '';
      } catch (ocrError) {
        console.error('OCR error:', ocrError);
        extractedText = '[Error en OCR]';
      }
    } else {
      extractedText = '[Tipo de archivo no soportado para OCR]';
    }

    const { error: insertError } = await supabase
      .from('document_content_index')
      .upsert(
        {
          document_id: documentId,
          content_text: extractedText,
          page_number: 1,
          indexed_at: new Date().toISOString(),
          ocr_confidence: 0.85,
          metadata: {
            mime_type: mimeType,
            processed_at: new Date().toISOString(),
          },
        },
        { onConflict: 'document_id' }
      );

    if (insertError) {
      console.error('Error inserting index:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to index content' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        documentId,
        textLength: extractedText.length,
        message: 'Document indexed successfully',
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error processing OCR:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});