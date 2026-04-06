-- Training documents with extracted text content
create table training_documents (
  id              uuid primary key default uuid_generate_v4(),
  storage_path    text not null unique,
  title           text not null,
  folder          text not null default 'training',
  content         text not null default '',
  sequence_order  int,
  created_at      timestamptz not null default now()
);

-- Per-rep progress through the training sequence
create table training_progress (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  org_id        uuid not null references orgs(id) on delete cascade,
  document_id   uuid not null references training_documents(id) on delete cascade,
  started_at    timestamptz,
  completed_at  timestamptz,
  quiz_passed   boolean not null default false,
  quiz_attempts int not null default 0,
  created_at    timestamptz not null default now(),
  unique(user_id, document_id)
);

create index training_progress_user_idx on training_progress(user_id);

-- RLS: reps read their own progress, managers read all in org
alter table training_documents enable row level security;
alter table training_progress enable row level security;

create policy "training_docs_read" on training_documents for select using (true);

create policy "training_progress_own" on training_progress
  for all using (user_id = auth.uid());
