ALTER TABLE public.knowledge_documents
  ADD COLUMN IF NOT EXISTS total_segments INTEGER,
  ADD COLUMN IF NOT EXISTS processed_segments INTEGER DEFAULT 0;

ALTER TABLE public.knowledge_chunks
  ADD COLUMN IF NOT EXISTS segment_index INTEGER,
  ADD COLUMN IF NOT EXISTS page_start INTEGER,
  ADD COLUMN IF NOT EXISTS page_end INTEGER;