-- 로그인 없이 누구나 화장실에 별점과 후기를 남기고 읽을 수 있다.
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  toilet_id text not null,
  rating smallint not null check (rating between 1 and 5),
  comment text check (comment is null or char_length(comment) <= 500),
  created_at timestamptz not null default now()
);

create index reviews_toilet_id_created_at_idx
  on public.reviews (toilet_id, created_at desc);

alter table public.reviews enable row level security;

-- 새 테이블은 Data API에 자동 노출되지 않을 수 있으므로 필요한 권한만 직접 준다.
-- 수정과 삭제 권한은 주지 않는다.
grant select, insert on table public.reviews to anon;

create policy "reviews are readable by anon"
  on public.reviews for select
  to anon
  using (true);

create policy "reviews can be created by anon"
  on public.reviews for insert
  to anon
  with check (true);
