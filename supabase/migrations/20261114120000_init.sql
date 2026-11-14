-- SPEC §11. All tables are server-only: RLS on, no public policies.
-- The app talks to them exclusively with the service role key.

create extension if not exists vector with schema extensions;

-- RAG chunks (derived from data/ — can be rebuilt with `pnpm rag:ingest`)
create table public.rag_chunks (
  id text primary key,                       -- sha256(slug + section + idx)
  slug text not null,
  psi_id text,
  section text not null,
  content text not null,
  metadata jsonb not null default '{}',
  embedding extensions.vector(1536) not null,
  content_hash text not null,
  catalog_version text not null,
  updated_at timestamptz not null default now()
);
create index rag_chunks_embedding_idx on public.rag_chunks
  using hnsw (embedding extensions.vector_cosine_ops);
create index rag_chunks_slug_idx on public.rag_chunks (slug);

create function public.match_rag_chunks(
  query_embedding extensions.vector(1536),
  match_count int default 12,
  min_similarity float default 0
)
returns table (
  id text, slug text, psi_id text, section text,
  content text, metadata jsonb, similarity float
)
language sql stable
set search_path = public, extensions
as $$
  select c.id, c.slug, c.psi_id, c.section, c.content, c.metadata,
         1 - (c.embedding <=> query_embedding) as similarity
  from public.rag_chunks c
  where 1 - (c.embedding <=> query_embedding) >= min_similarity
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

-- Chat (anonymous; no IP stored here)
create table public.chat_conversations (
  id uuid primary key,
  locale text not null,
  created_at timestamptz not null default now()
);

create table public.chat_turns (
  id bigserial primary key,
  conversation_id uuid not null references public.chat_conversations (id) on delete cascade,
  turn_index int not null,
  question text not null,
  request_messages jsonb,       -- exact messages sent (append-only history)
  response_content jsonb,       -- exact assistant content received
  cited_slugs text[] not null default '{}',
  model text,
  prompt_version text,
  catalog_version text,
  input_tokens int,
  output_tokens int,
  cache_read_tokens int,
  latency_ms int,
  cache_hit boolean not null default false,
  error text,
  created_at timestamptz not null default now(),
  unique (conversation_id, turn_index)
);

create table public.answer_cache (
  key text primary key,
  question text not null,
  locale text not null,
  response jsonb not null,
  created_at timestamptz not null default now()
);

create table public.rate_limits (
  ip_hash text not null,
  window_start timestamptz not null,
  count int not null default 0,
  primary key (ip_hash, window_start)
);

alter table public.rag_chunks enable row level security;
alter table public.chat_conversations enable row level security;
alter table public.chat_turns enable row level security;
alter table public.answer_cache enable row level security;
alter table public.rate_limits enable row level security;

revoke execute on function public.match_rag_chunks from public, anon, authenticated;
