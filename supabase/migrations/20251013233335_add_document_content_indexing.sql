/*
  # Document Content Indexing and OCR

  1. New Tables
    - `document_content_index`
      - `id` (uuid, primary key)
      - `document_id` (uuid, foreign key to entity_documents)
      - `content_text` (text) - Extracted text from OCR
      - `page_number` (integer) - Page number if applicable
      - `indexed_at` (timestamptz) - When indexing was performed
      - `ocr_confidence` (numeric) - OCR confidence score
      - `metadata` (jsonb) - Additional OCR metadata
  
  2. Security
    - Enable RLS on `document_content_index` table
    - Add policies for authenticated users to search their entities' documents
  
  3. Indexes
    - Full-text search index on content_text
    - Index on document_id for fast lookups
*/

-- Create document_content_index table
CREATE TABLE IF NOT EXISTS document_content_index (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES entity_documents(id) ON DELETE CASCADE,
  content_text text,
  page_number integer DEFAULT 1,
  indexed_at timestamptz DEFAULT now(),
  ocr_confidence numeric(5,2),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE document_content_index ENABLE ROW LEVEL SECURITY;

-- Create full-text search index
CREATE INDEX IF NOT EXISTS idx_document_content_search 
  ON document_content_index 
  USING gin(to_tsvector('spanish', content_text));

-- Create index on document_id
CREATE INDEX IF NOT EXISTS idx_document_content_doc_id 
  ON document_content_index(document_id);

-- Policy: Users can read content from documents they have access to
CREATE POLICY "Users can read document content from their entities"
  ON document_content_index
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM entity_documents ed
      JOIN entities e ON ed.entity_id = e.id
      JOIN clients c ON e.client_id = c.id
      WHERE ed.id = document_content_index.document_id
      AND c.id IN (
        SELECT client_id FROM client_users
        WHERE user_id = auth.uid()
      )
    )
  );

-- Policy: System can insert content (for OCR processing)
CREATE POLICY "System can insert document content"
  ON document_content_index
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM entity_documents ed
      JOIN entities e ON ed.entity_id = e.id
      JOIN clients c ON e.client_id = c.id
      WHERE ed.id = document_content_index.document_id
      AND c.id IN (
        SELECT client_id FROM client_users
        WHERE user_id = auth.uid()
      )
    )
  );

-- Create view for document search with highlights
CREATE OR REPLACE VIEW document_search_results AS
SELECT 
  dci.id,
  dci.document_id,
  ed.title as document_title,
  ed.file_name,
  ed.uploaded_at,
  dci.page_number,
  dci.content_text,
  dci.ocr_confidence,
  e.id as entity_id,
  e.name as entity_name,
  em.id as movement_id,
  mt.name as movement_type_name
FROM document_content_index dci
JOIN entity_documents ed ON dci.document_id = ed.id
JOIN entities e ON ed.entity_id = e.id
LEFT JOIN entity_movements em ON ed.movement_id = em.id
LEFT JOIN movement_types mt ON em.movement_type_id = mt.id;
