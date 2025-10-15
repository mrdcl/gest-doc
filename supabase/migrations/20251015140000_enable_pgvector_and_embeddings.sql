/*
  # Enable pgvector and Create Embeddings Schema

  1. Enable Extensions
    - Enable pgvector extension for vector similarity search

  2. New Tables
    - `document_chunks`
      - `id` (uuid, primary key)
      - `document_id` (uuid) - references documents table
      - `chunk_index` (integer) - order of chunk in document
      - `content` (text) - text content of chunk
      - `char_count` (integer) - character count
      - `token_count` (integer, nullable) - estimated token count
      - `metadata` (jsonb) - chunk metadata (page, section, etc.)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `chunk_embeddings`
      - `id` (uuid, primary key)
      - `chunk_id` (uuid) - references document_chunks
      - `embedding` (vector(384)) - embedding vector (nomic-embed-text dimension)
      - `model_name` (text) - model used for embedding
      - `model_version` (text) - version of model
      - `created_at` (timestamptz)

  3. Performance
    - HNSW index for fast similarity search
    - Regular indexes for foreign keys and common queries
    - Optimized for 100k+ chunks

  4. Security
    - RLS enabled on all tables
    - Users can only access chunks/embeddings for documents they can access

  5. Functions
    - Similarity search function
    - Chunk document function
    - Get relevant chunks function
*/

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create document_chunks table
CREATE TABLE IF NOT EXISTS document_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL,
  content text NOT NULL,
  char_count integer NOT NULL,
  token_count integer,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(document_id, chunk_index)
);

-- Create chunk_embeddings table
CREATE TABLE IF NOT EXISTS chunk_embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chunk_id uuid NOT NULL REFERENCES document_chunks(id) ON DELETE CASCADE,
  embedding vector(384) NOT NULL,
  model_name text NOT NULL DEFAULT 'nomic-embed-text',
  model_version text NOT NULL DEFAULT 'v1.5',
  created_at timestamptz DEFAULT now(),
  UNIQUE(chunk_id)
);

-- Enable RLS
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE chunk_embeddings ENABLE ROW LEVEL SECURITY;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id
  ON document_chunks(document_id);

CREATE INDEX IF NOT EXISTS idx_document_chunks_chunk_index
  ON document_chunks(document_id, chunk_index);

CREATE INDEX IF NOT EXISTS idx_chunk_embeddings_chunk_id
  ON chunk_embeddings(chunk_id);

-- Create HNSW index for fast similarity search
-- m = 16 (connections per layer), ef_construction = 64 (search quality during build)
CREATE INDEX IF NOT EXISTS idx_chunk_embeddings_embedding_hnsw
  ON chunk_embeddings USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Alternative: IVFFlat index (faster build, slightly less accurate)
-- CREATE INDEX IF NOT EXISTS idx_chunk_embeddings_embedding_ivfflat
--   ON chunk_embeddings USING ivfflat (embedding vector_cosine_ops)
--   WITH (lists = 100);

-- Function to search similar chunks
CREATE OR REPLACE FUNCTION search_similar_chunks(
  query_embedding vector(384),
  match_threshold float DEFAULT 0.5,
  match_count integer DEFAULT 10,
  filter_document_ids uuid[] DEFAULT NULL
)
RETURNS TABLE(
  chunk_id uuid,
  document_id uuid,
  content text,
  similarity float,
  metadata jsonb
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id as chunk_id,
    dc.document_id,
    dc.content,
    1 - (ce.embedding <=> query_embedding) as similarity,
    dc.metadata
  FROM chunk_embeddings ce
  JOIN document_chunks dc ON dc.id = ce.chunk_id
  WHERE
    (filter_document_ids IS NULL OR dc.document_id = ANY(filter_document_ids))
    AND 1 - (ce.embedding <=> query_embedding) > match_threshold
  ORDER BY ce.embedding <=> query_embedding
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get chunks for a document
CREATE OR REPLACE FUNCTION get_document_chunks(
  p_document_id uuid
)
RETURNS TABLE(
  chunk_id uuid,
  chunk_index integer,
  content text,
  char_count integer,
  has_embedding boolean,
  metadata jsonb
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id as chunk_id,
    dc.chunk_index,
    dc.content,
    dc.char_count,
    EXISTS(SELECT 1 FROM chunk_embeddings ce WHERE ce.chunk_id = dc.id) as has_embedding,
    dc.metadata
  FROM document_chunks dc
  WHERE dc.document_id = p_document_id
  ORDER BY dc.chunk_index;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to estimate token count (rough approximation: ~4 chars per token)
CREATE OR REPLACE FUNCTION estimate_token_count(text_content text)
RETURNS integer AS $$
BEGIN
  RETURN CEIL(LENGTH(text_content) / 4.0)::integer;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to chunk document text
-- This is a simple implementation, production would use more sophisticated chunking
CREATE OR REPLACE FUNCTION chunk_document_text(
  p_document_id uuid,
  p_text_content text,
  p_chunk_size integer DEFAULT 1000,
  p_overlap integer DEFAULT 200
)
RETURNS integer AS $$
DECLARE
  v_chunk_count integer := 0;
  v_text_length integer;
  v_position integer := 1;
  v_chunk_text text;
  v_chunk_end integer;
BEGIN
  -- Delete existing chunks for this document
  DELETE FROM document_chunks WHERE document_id = p_document_id;

  v_text_length := LENGTH(p_text_content);

  -- Create chunks with overlap
  WHILE v_position <= v_text_length LOOP
    v_chunk_end := LEAST(v_position + p_chunk_size - 1, v_text_length);
    v_chunk_text := SUBSTRING(p_text_content FROM v_position FOR (v_chunk_end - v_position + 1));

    -- Insert chunk
    INSERT INTO document_chunks (
      document_id,
      chunk_index,
      content,
      char_count,
      token_count,
      metadata
    ) VALUES (
      p_document_id,
      v_chunk_count,
      v_chunk_text,
      LENGTH(v_chunk_text),
      estimate_token_count(v_chunk_text),
      jsonb_build_object(
        'start_pos', v_position,
        'end_pos', v_chunk_end
      )
    );

    v_chunk_count := v_chunk_count + 1;
    v_position := v_position + p_chunk_size - p_overlap;
  END LOOP;

  RETURN v_chunk_count;
END;
$$ LANGUAGE plpgsql;

-- RLS Policies

-- Policy: Users can view chunks for documents they can access
CREATE POLICY "Users can view chunks for accessible documents"
  ON document_chunks
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM documents d
      WHERE d.id = document_id
      AND (
        d.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM document_access da
          WHERE da.document_id = d.id
          AND da.user_id = auth.uid()
        )
      )
    )
  );

-- Policy: System can insert chunks (via functions)
CREATE POLICY "System can insert chunks"
  ON document_chunks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM documents d
      WHERE d.id = document_id
      AND d.owner_id = auth.uid()
    )
  );

-- Policy: System can update chunks
CREATE POLICY "System can update chunks"
  ON document_chunks
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM documents d
      WHERE d.id = document_id
      AND d.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM documents d
      WHERE d.id = document_id
      AND d.owner_id = auth.uid()
    )
  );

-- Policy: System can delete chunks
CREATE POLICY "System can delete chunks"
  ON document_chunks
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM documents d
      WHERE d.id = document_id
      AND d.owner_id = auth.uid()
    )
  );

-- Policy: Users can view embeddings for accessible chunks
CREATE POLICY "Users can view embeddings for accessible chunks"
  ON chunk_embeddings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM document_chunks dc
      JOIN documents d ON d.id = dc.document_id
      WHERE dc.id = chunk_id
      AND (
        d.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM document_access da
          WHERE da.document_id = d.id
          AND da.user_id = auth.uid()
        )
      )
    )
  );

-- Policy: System can insert embeddings
CREATE POLICY "System can insert embeddings"
  ON chunk_embeddings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM document_chunks dc
      JOIN documents d ON d.id = dc.document_id
      WHERE dc.id = chunk_id
      AND d.owner_id = auth.uid()
    )
  );

-- Policy: System can update embeddings
CREATE POLICY "System can update embeddings"
  ON chunk_embeddings
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM document_chunks dc
      JOIN documents d ON d.id = dc.document_id
      WHERE dc.id = chunk_id
      AND d.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM document_chunks dc
      JOIN documents d ON d.id = dc.document_id
      WHERE dc.id = chunk_id
      AND d.owner_id = auth.uid()
    )
  );

-- Create view for chunk statistics
CREATE OR REPLACE VIEW document_chunk_stats AS
SELECT
  d.id as document_id,
  d.title as document_name,
  COUNT(dc.id) as chunk_count,
  SUM(dc.char_count) as total_chars,
  SUM(dc.token_count) as total_tokens,
  COUNT(ce.id) as embedded_chunks,
  ROUND(100.0 * COUNT(ce.id) / NULLIF(COUNT(dc.id), 0), 2) as embedding_percentage
FROM documents d
LEFT JOIN document_chunks dc ON dc.document_id = d.id
LEFT JOIN chunk_embeddings ce ON ce.chunk_id = dc.id
GROUP BY d.id, d.title;

-- Grant permissions on view
GRANT SELECT ON document_chunk_stats TO authenticated;

-- Create view for embedding search analytics
CREATE OR REPLACE VIEW embedding_search_performance AS
SELECT
  COUNT(*) as total_embeddings,
  AVG(LENGTH(embedding::text)) as avg_embedding_size,
  pg_size_pretty(pg_total_relation_size('chunk_embeddings')) as table_size,
  pg_size_pretty(pg_indexes_size('chunk_embeddings')) as index_size
FROM chunk_embeddings;

-- Grant permissions on view
GRANT SELECT ON embedding_search_performance TO authenticated;

-- Add helpful comment
COMMENT ON TABLE document_chunks IS 'Stores text chunks from documents for semantic search and RAG';
COMMENT ON TABLE chunk_embeddings IS 'Stores vector embeddings for document chunks, enables similarity search';
COMMENT ON FUNCTION search_similar_chunks IS 'Search for chunks similar to a query embedding using cosine similarity';
COMMENT ON FUNCTION get_document_chunks IS 'Get all chunks for a specific document with embedding status';
COMMENT ON FUNCTION chunk_document_text IS 'Automatically chunk document text into overlapping segments';
