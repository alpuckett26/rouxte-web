-- Storage bucket for org documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'org-documents',
  'org-documents',
  false,
  52428800,
  ARRAY[
    'application/pdf',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'text/plain',
    'image/png',
    'image/jpeg',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
) ON CONFLICT (id) DO NOTHING;

-- RLS: only org members can read their org's files
CREATE POLICY "org-documents: read own org"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'org-documents'
  AND auth.uid() IN (
    SELECT user_id FROM user_profiles
    WHERE org_id::text = (storage.foldername(name))[1]
  )
);

-- Only managers/admins can insert
CREATE POLICY "org-documents: insert managers"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'org-documents'
  AND auth.uid() IN (
    SELECT user_id FROM user_profiles
    WHERE org_id::text = (storage.foldername(name))[1]
    AND role IN ('admin', 'sales_manager')
  )
);

-- Only managers/admins can delete
CREATE POLICY "org-documents: delete managers"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'org-documents'
  AND auth.uid() IN (
    SELECT user_id FROM user_profiles
    WHERE org_id::text = (storage.foldername(name))[1]
    AND role IN ('admin', 'sales_manager')
  )
);

-- Metadata table
CREATE TABLE org_documents (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id       uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  uploaded_by  uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  name         text NOT NULL,
  description  text,
  category     text NOT NULL DEFAULT 'other',
  file_path    text NOT NULL,
  file_size    bigint NOT NULL DEFAULT 0,
  mime_type    text NOT NULL DEFAULT '',
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE org_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org-documents meta: read own org"
ON org_documents FOR SELECT
USING (org_id IN (SELECT org_id FROM user_profiles WHERE user_id = auth.uid()));

CREATE POLICY "org-documents meta: insert managers"
ON org_documents FOR INSERT
WITH CHECK (
  org_id IN (
    SELECT org_id FROM user_profiles
    WHERE user_id = auth.uid() AND role IN ('admin', 'sales_manager')
  )
);

CREATE POLICY "org-documents meta: delete managers"
ON org_documents FOR DELETE
USING (
  org_id IN (
    SELECT org_id FROM user_profiles
    WHERE user_id = auth.uid() AND role IN ('admin', 'sales_manager')
  )
);

CREATE INDEX org_documents_org_idx ON org_documents(org_id, created_at DESC);
