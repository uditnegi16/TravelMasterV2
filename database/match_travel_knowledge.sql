-- pgvector similarity function
--
-- Corrected 2026-08-03 (Issue 11) -- the previous version of this file
-- had a two-parameter signature that omitted `id` from its return shape
-- and invented a third `match_category` parameter that was never
-- actually part of the deployed function. Signature and return shape
-- below match the real production RPC exactly, confirmed by testing
-- against it directly (2026-07-31): rpc("match_travel_knowledge",
-- {"query_embedding": embedding, "match_count": top_k}) -- the real
-- caller in retrieval/vector_store_service.py never passes a third
-- argument.

create or replace function public.match_travel_knowledge(
  query_embedding vector,
  match_count integer default 5
)
returns table (
  id            uuid,
  chunk_id      text,
  title         text,
  category      text,
  source_file   text,
  chunk_index   integer,
  version       integer,
  content       text,
  similarity    float
)
language sql
stable
as $$
  select
    tk.id,
    tk.chunk_id,
    tk.title,
    tk.category,
    tk.source_file,
    tk.chunk_index,
    tk.version,
    tk.content,
    1 - (tk.embedding <=> query_embedding) as similarity
  from public.travel_knowledge tk
  order by tk.embedding <=> query_embedding
  limit match_count;
$$;
