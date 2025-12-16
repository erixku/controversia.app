-- Gameplay schema for Controversia (Supabase Postgres)
-- Apply in Supabase SQL editor.

-- Helper: map auth.uid() -> profiles.id
create or replace function public.current_profile_id()
returns uuid
language sql
stable
as $$
  select p.id from public.profiles p where p.auth_id = auth.uid() limit 1;
$$;

-- Rounds
create table if not exists public.game_rounds (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  round_number int not null,
  status text not null check (status in ('picking','judging','completed')),
  black_card_id uuid not null references public.cards(id) on delete restrict,
  pick_count int not null check (pick_count between 1 and 3),
  czar_player_id uuid not null references public.profiles(id) on delete restrict,
  winner_submission_id uuid null,
  created_at timestamptz not null default now(),
  unique (game_id, round_number)
);

-- One submission per player per round
create table if not exists public.game_submissions (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  round_id uuid not null references public.game_rounds(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (round_id, player_id)
);

-- Cards inside a submission (1..3)
create table if not exists public.game_submission_cards (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  round_id uuid not null references public.game_rounds(id) on delete cascade,
  submission_id uuid not null references public.game_submissions(id) on delete cascade,
  card_id uuid not null references public.cards(id) on delete restrict,
  seq int not null check (seq between 1 and 3),
  created_at timestamptz not null default now(),
  unique (submission_id, seq)
);

-- Hands (white cards a player currently holds)
create table if not exists public.game_hands (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  card_id uuid not null references public.cards(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (game_id, player_id, card_id)
);

create index if not exists idx_game_rounds_game_status on public.game_rounds(game_id, status);
create index if not exists idx_game_submissions_round on public.game_submissions(round_id);
create index if not exists idx_game_submission_cards_submission on public.game_submission_cards(submission_id);
create index if not exists idx_game_submission_cards_game_round on public.game_submission_cards(game_id, round_id);
create index if not exists idx_game_hands_game_player on public.game_hands(game_id, player_id);

-- RLS
alter table public.game_rounds enable row level security;
alter table public.game_submissions enable row level security;
alter table public.game_submission_cards enable row level security;
alter table public.game_hands enable row level security;

-- Players in a game can read
create policy if not exists "game_rounds_select_players" on public.game_rounds
for select using (
  exists(select 1 from public.game_players gp where gp.game_id = game_id and gp.player_id = public.current_profile_id())
);

create policy if not exists "game_submissions_select_players" on public.game_submissions
for select using (
  -- Always allow the submitter to see their own submission
  player_id = public.current_profile_id()
  -- Reveal identities only after the round is completed
  or exists(
    select 1
    from public.game_rounds r
    where r.id = round_id and r.status = 'completed'
  )
);

create policy if not exists "game_submission_cards_select_players" on public.game_submission_cards
for select using (
  exists(
    select 1
    from public.game_players gp
    where gp.game_id = game_id and gp.player_id = public.current_profile_id()
  )
);

create policy if not exists "game_hands_select_own" on public.game_hands
for select using (player_id = public.current_profile_id());

-- Inserts/updates via RPC only (security definer). No direct inserts from client.

-- Utility: compute pick_count from black card text (___ blanks)
create or replace function public.pick_count_from_text(p_text text)
returns int
language plpgsql
immutable
as $$
declare
  blanks int;
begin
  blanks := coalesce((select count(*) from regexp_matches(p_text, '(_{3,})', 'g')), 0);
  if blanks < 1 then
    return 1;
  end if;
  if blanks > 3 then
    return 3;
  end if;
  return blanks;
end;
$$;

-- Start a new round (host only). Also rotates czar and fills hands.
create or replace function public.start_round(p_game_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_host_id uuid;
  v_round_no int;
  v_black_id uuid;
  v_black_text text;
  v_pick int;
  v_czar uuid;
  v_next_czar uuid;
  v_round_id uuid;
  v_hand_size int := 7;
  v_player record;
  v_needed int;
begin
  v_profile_id := public.current_profile_id();
  select host_id into v_host_id from public.games where id = p_game_id;
  if v_host_id is null then
    raise exception 'game not found';
  end if;
  if v_profile_id is null or v_profile_id <> v_host_id then
    raise exception 'only host can start round';
  end if;

  -- Determine next round number
  select coalesce(max(round_number), 0) + 1 into v_round_no from public.game_rounds where game_id = p_game_id;

  -- Rotate czar
  select gp.player_id into v_czar from public.game_players gp where gp.game_id = p_game_id and gp.is_czar = true limit 1;
  if v_czar is null then
    select gp.player_id into v_next_czar
    from public.game_players gp
    where gp.game_id = p_game_id
    order by gp.created_at asc
    limit 1;
  else
    select gp2.player_id into v_next_czar
    from public.game_players gp2
    where gp2.game_id = p_game_id
      and gp2.created_at > (select created_at from public.game_players gp3 where gp3.game_id=p_game_id and gp3.player_id=v_czar limit 1)
    order by gp2.created_at asc
    limit 1;

    if v_next_czar is null then
      select gp.player_id into v_next_czar
      from public.game_players gp
      where gp.game_id = p_game_id
      order by gp.created_at asc
      limit 1;
    end if;
  end if;

  update public.game_players set is_czar = false where game_id = p_game_id;
  update public.game_players set is_czar = true where game_id = p_game_id and player_id = v_next_czar;

  -- Pick a black card (avoid repeats if possible)
  select c.id, c.text into v_black_id, v_black_text
  from public.cards c
  where c.game_id = p_game_id and c.type = 'black' and c.status = 'approved'
    and c.id not in (select black_card_id from public.game_rounds where game_id = p_game_id)
  order by random()
  limit 1;

  if v_black_id is null then
    select c.id, c.text into v_black_id, v_black_text
    from public.cards c
    where c.game_id = p_game_id and c.type = 'black' and c.status = 'approved'
    order by random()
    limit 1;
  end if;

  if v_black_id is null then
    raise exception 'no black cards available';
  end if;

  v_pick := public.pick_count_from_text(v_black_text);

  insert into public.game_rounds(game_id, round_number, status, black_card_id, pick_count, czar_player_id)
  values (p_game_id, v_round_no, 'picking', v_black_id, v_pick, v_next_czar)
  returning id into v_round_id;

  -- Mark game in progress
  update public.games set status = 'in_progress', current_round = v_round_no where id = p_game_id;

  -- Fill hands for all non-czar players
  for v_player in
    select gp.player_id from public.game_players gp where gp.game_id = p_game_id and gp.player_id <> v_next_czar
  loop
    select greatest(0, v_hand_size - coalesce((select count(*) from public.game_hands gh where gh.game_id=p_game_id and gh.player_id=v_player.player_id), 0)) into v_needed;
    if v_needed > 0 then
      insert into public.game_hands(game_id, player_id, card_id)
      select p_game_id, v_player.player_id, c.id
      from public.cards c
      where c.game_id=p_game_id and c.type='white' and c.status='approved'
        and c.id not in (
          select card_id from public.game_hands where game_id=p_game_id
          union
          select gsc.card_id from public.game_submission_cards gsc where gsc.game_id = p_game_id
        )
      order by random()
      limit v_needed;
    end if;
  end loop;

  return v_round_id;
end;
$$;

-- Submit a single card (supports pick 1..3). Server assigns seq in submission.
create or replace function public.submit_card(p_game_id uuid, p_round_id uuid, p_card_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_round public.game_rounds%rowtype;
  v_submission_id uuid;
  v_seq int;
  v_is_czar boolean;
begin
  v_profile_id := public.current_profile_id();
  if v_profile_id is null then raise exception 'not authenticated'; end if;

  select * into v_round from public.game_rounds where id = p_round_id and game_id = p_game_id;
  if v_round.id is null then raise exception 'round not found'; end if;
  if v_round.status <> 'picking' then raise exception 'round not accepting cards'; end if;

  select gp.is_czar into v_is_czar from public.game_players gp where gp.game_id=p_game_id and gp.player_id=v_profile_id limit 1;
  if coalesce(v_is_czar,false) then raise exception 'czar cannot submit'; end if;

  -- Card must be in player's hand
  if not exists(select 1 from public.game_hands gh where gh.game_id=p_game_id and gh.player_id=v_profile_id and gh.card_id=p_card_id) then
    raise exception 'card not in hand';
  end if;

  insert into public.game_submissions(game_id, round_id, player_id)
  values (p_game_id, p_round_id, v_profile_id)
  on conflict (round_id, player_id) do update set game_id = excluded.game_id
  returning id into v_submission_id;

  select coalesce(max(seq),0)+1 into v_seq from public.game_submission_cards where submission_id=v_submission_id;
  if v_seq > v_round.pick_count then
    raise exception 'too many cards for this round';
  end if;

  insert into public.game_submission_cards(game_id, round_id, submission_id, card_id, seq)
  values (p_game_id, p_round_id, v_submission_id, p_card_id, v_seq);

  delete from public.game_hands where game_id=p_game_id and player_id=v_profile_id and card_id=p_card_id;

  -- If all non-czar players submitted required number of cards, move to judging
  if not exists(
    select 1
    from public.game_players gp
    where gp.game_id=p_game_id
      and gp.player_id <> v_round.czar_player_id
      and (
        select count(*)
        from public.game_submission_cards gsc
        join public.game_submissions gs on gs.id=gsc.submission_id
        where gs.round_id=p_round_id and gs.player_id=gp.player_id
      ) < v_round.pick_count
  ) then
    update public.game_rounds set status='judging' where id=p_round_id;
  end if;

  return v_submission_id;
end;
$$;

-- Choose winning submission (czar only) + score + complete round + refill hands
create or replace function public.choose_winner(p_round_id uuid, p_submission_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_round public.game_rounds%rowtype;
  v_winner uuid;
  v_game_id uuid;
  v_hand_size int := 7;
  v_player record;
  v_needed int;
begin
  v_profile_id := public.current_profile_id();
  select * into v_round from public.game_rounds where id=p_round_id;
  if v_round.id is null then raise exception 'round not found'; end if;
  if v_round.status <> 'judging' then raise exception 'round not in judging'; end if;
  if v_profile_id <> v_round.czar_player_id then raise exception 'only czar can choose winner'; end if;

  v_game_id := v_round.game_id;
  select player_id into v_winner from public.game_submissions where id=p_submission_id and round_id=p_round_id;
  if v_winner is null then raise exception 'submission not found'; end if;

  update public.game_rounds set status='completed', winner_submission_id=p_submission_id where id=p_round_id;
  update public.game_players set score = score + 1 where game_id=v_game_id and player_id=v_winner;

  -- Refill hands for all non-czar players
  for v_player in
    select gp.player_id from public.game_players gp where gp.game_id = v_game_id and gp.player_id <> v_round.czar_player_id
  loop
    select greatest(0, v_hand_size - coalesce((select count(*) from public.game_hands gh where gh.game_id=v_game_id and gh.player_id=v_player.player_id), 0)) into v_needed;
    if v_needed > 0 then
      insert into public.game_hands(game_id, player_id, card_id)
      select v_game_id, v_player.player_id, c.id
      from public.cards c
      where c.game_id=v_game_id and c.type='white' and c.status='approved'
        and c.id not in (
          select card_id from public.game_hands where game_id=v_game_id
          union
          select gsc.card_id from public.game_submission_cards gsc where gsc.game_id = v_game_id
        )
      order by random()
      limit v_needed;
    end if;
  end loop;
end;
$$;
