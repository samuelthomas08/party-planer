alter table users add column role varchar(10) not null default 'USER' check (role in ('USER', 'ADMIN'));
alter table users add column enabled boolean not null default true;

-- Existing installations: the oldest account becomes the first administrator.
update users set role = 'ADMIN'
where id = (select id from users order by created_at asc limit 1)
  and not exists (select 1 from users where role = 'ADMIN');

create table app_settings (
    key   varchar(60) primary key,
    value varchar(500) not null
);

create table share_links (
    id         uuid primary key,
    place_id   uuid         not null references places (id) on delete cascade,
    created_by uuid         not null references users (id) on delete cascade,
    token      varchar(64)  not null unique,
    created_at timestamptz  not null default now(),
    expires_at timestamptz,
    revoked_at timestamptz
);
create index share_links_place_idx on share_links (place_id);

-- Deliberately no foreign keys: history must survive the deletion of users, places and equipment.
create table audit_log (
    id          uuid primary key,
    at          timestamptz  not null default now(),
    actor_id    uuid,
    actor_name  varchar(120) not null,
    actor_type  varchar(10)  not null,
    action      varchar(40)  not null,
    entity_type varchar(20)  not null,
    entity_id   uuid,
    entity_name varchar(200),
    place_id    uuid,
    place_name  varchar(120),
    changes     text         not null default '[]',
    ip          varchar(64)
);
create index audit_log_at_idx on audit_log (at desc);
create index audit_log_place_idx on audit_log (place_id, at desc);

-- Markers keep their numbers: order is now stored.
alter table placements add column position integer not null default 0;
