/*
  # Add OCR Quality Tracking

  1. Changes
    - Add has_low_quality_ocr column to documents table
    - Add ocr_confidence_score column
    - Add ocr_processed_at timestamp
    - Create notification trigger for low quality OCR

  2. Purpose
    - Track OCR quality per document
    - Alert users when OCR quality is insufficient
    - Help identify documents that need reprocessing
*/

-- Add OCR quality columns to documents table
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS has_low_quality_ocr boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS ocr_confidence_score numeric(5,2),
  ADD COLUMN IF NOT EXISTS ocr_processed_at timestamptz;

-- Create index for filtering by OCR quality
CREATE INDEX IF NOT EXISTS idx_documents_low_quality_ocr
  ON documents(has_low_quality_ocr)
  WHERE has_low_quality_ocr = true;

-- Function to detect low quality OCR
CREATE OR REPLACE FUNCTION check_ocr_quality()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_word_count integer;
  v_avg_word_length numeric;
  v_has_gibberish boolean := false;
  v_confidence numeric := 100;
BEGIN
  -- Only check if content_text was updated
  IF NEW.content_text IS NULL OR LENGTH(TRIM(NEW.content_text)) = 0 THEN
    NEW.has_low_quality_ocr := true;
    NEW.ocr_confidence_score := 0;
    RETURN NEW;
  END IF;

  -- Count words
  v_word_count := array_length(string_to_array(NEW.content_text, ' '), 1);

  -- Very low word count for a document
  IF v_word_count < 10 THEN
    NEW.has_low_quality_ocr := true;
    NEW.ocr_confidence_score := 30;
    RETURN NEW;
  END IF;

  -- Calculate average word length
  v_avg_word_length := LENGTH(NEW.content_text)::numeric / NULLIF(v_word_count, 0);

  -- Suspicious patterns that indicate poor OCR
  IF v_avg_word_length < 2 OR v_avg_word_length > 20 THEN
    v_has_gibberish := true;
    v_confidence := v_confidence - 30;
  END IF;

  -- Check for excessive special characters (gibberish indicator)
  IF LENGTH(REGEXP_REPLACE(NEW.content_text, '[a-zA-Z0-9áéíóúñÁÉÍÓÚÑ\s]', '', 'g')) > (LENGTH(NEW.content_text) * 0.2) THEN
    v_has_gibberish := true;
    v_confidence := v_confidence - 40;
  END IF;

  -- Set quality flags
  NEW.has_low_quality_ocr := v_has_gibberish OR v_word_count < 20;
  NEW.ocr_confidence_score := GREATEST(0, LEAST(100, v_confidence));
  NEW.ocr_processed_at := NOW();

  RETURN NEW;
END;
$$;

-- Create trigger to check OCR quality on insert/update
DROP TRIGGER IF EXISTS trigger_check_ocr_quality ON documents;
CREATE TRIGGER trigger_check_ocr_quality
  BEFORE INSERT OR UPDATE OF content_text
  ON documents
  FOR EACH ROW
  WHEN (NEW.content_text IS NOT NULL)
  EXECUTE FUNCTION check_ocr_quality();

-- Function to create notification for low quality OCR
CREATE OR REPLACE FUNCTION notify_low_quality_ocr()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only notify if OCR quality is low and this is a new detection
  IF NEW.has_low_quality_ocr = true AND (OLD.has_low_quality_ocr IS NULL OR OLD.has_low_quality_ocr = false) THEN
    -- Create notification for document owner
    INSERT INTO notifications (
      user_id,
      type,
      title,
      message,
      action_url,
      metadata
    ) VALUES (
      NEW.uploaded_by,
      'warning',
      'OCR de Baja Calidad Detectado',
      'El documento "' || NEW.title || '" tiene OCR de baja calidad y puede no aparecer en búsquedas. Considera reprocesarlo.',
      '/documents/' || NEW.id,
      jsonb_build_object(
        'document_id', NEW.id,
        'document_title', NEW.title,
        'confidence_score', NEW.ocr_confidence_score,
        'action', 'reprocess_ocr'
      )
    );

    -- If document is part of a movement, notify about it
    IF NEW.movement_id IS NOT NULL THEN
      -- Notify users with access to the entity
      INSERT INTO notifications (
        user_id,
        type,
        title,
        message,
        metadata
      )
      SELECT DISTINCT
        cu.user_id,
        'warning',
        'OCR de Baja Calidad en Gestión',
        'Un documento en una gestión tiene OCR de baja calidad: "' || NEW.title || '"',
        jsonb_build_object(
          'document_id', NEW.id,
          'movement_id', NEW.movement_id,
          'confidence_score', NEW.ocr_confidence_score
        )
      FROM entity_movements em
      JOIN entities e ON e.id = em.entity_id
      JOIN client_users cu ON cu.client_id = e.client_id
      WHERE em.id = NEW.movement_id
        AND cu.is_active = true
        AND cu.user_id != NEW.uploaded_by; -- Don't duplicate notification
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger to send notifications
DROP TRIGGER IF EXISTS trigger_notify_low_quality_ocr ON documents;
CREATE TRIGGER trigger_notify_low_quality_ocr
  AFTER INSERT OR UPDATE OF has_low_quality_ocr
  ON documents
  FOR EACH ROW
  WHEN (NEW.has_low_quality_ocr = true)
  EXECUTE FUNCTION notify_low_quality_ocr();

-- Comment on columns
COMMENT ON COLUMN documents.has_low_quality_ocr IS
  'Indicates if OCR quality is too low for reliable search indexing';

COMMENT ON COLUMN documents.ocr_confidence_score IS
  'OCR quality confidence score (0-100)';

COMMENT ON COLUMN documents.ocr_processed_at IS
  'Timestamp when OCR quality was last checked';
