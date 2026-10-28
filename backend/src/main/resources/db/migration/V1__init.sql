create table users (
    id                    uuid primary key,
    email                 varchar(254) not null unique,
    password_hash         varchar(255) not null,
    display_name          varchar(80)  not null,
    failed_login_attempts integer      not null default 0,
    locked_until          timestamptz,
    created_at            timestamptz  not null default now()
);

create table refresh_tokens (
    id         uuid primary key,
    user_id    uuid        not null references users (id) on delete cascade,
    family_id  uuid        not null,
    token_hash varchar(64) not null unique,
    expires_at timestamptz not null,
    revoked_at timestamptz,
    created_at timestamptz not null default now()
);
create index refresh_tokens_family_idx on refresh_tokens (family_id);
create index refresh_tokens_user_idx on refresh_tokens (user_id);

create table images (
    id           uuid primary key,
    owner_id     uuid         not null references users (id) on delete cascade,
    content_type varchar(50)  not null,
    size_bytes   integer      not null,
    data         bytea        not null,
    created_at   timestamptz  not null default now()
);
create index images_owner_idx on images (owner_id);

create table folders (
    id         uuid primary key,
    owner_id   uuid         not null references users (id) on delete cascade,
    name       varchar(100) not null,
    created_at timestamptz  not null default now()
);
create index folders_owner_idx on folders (owner_id);

create table equipment (
    id          uuid primary key,
    owner_id    uuid         not null references users (id) on delete cascade,
    title       varchar(120) not null,
    description text         not null default '',
    category    varchar(20)  not null check (category in ('STAND', 'OTHER')),
    created_at  timestamptz  not null default now(),
    updated_at  timestamptz  not null default now()
);
create index equipment_owner_idx on equipment (owner_id);

create table equipment_images (
    equipment_id uuid        not null references equipment (id) on delete cascade,
    slot         varchar(30) not null,
    image_id     uuid        not null references images (id),
    primary key (equipment_id, slot)
);
create index equipment_images_image_idx on equipment_images (image_id);

create table places (
    id                  uuid primary key,
    owner_id            uuid         not null references users (id) on delete cascade,
    folder_id           uuid         not null references folders (id) on delete cascade,
    name                varchar(120) not null,
    floor_plan_image_id uuid         references images (id),
    created_at          timestamptz  not null default now(),
    updated_at          timestamptz  not null default now()
);
create index places_owner_idx on places (owner_id);
create index places_folder_idx on places (folder_id);
create index places_image_idx on places (floor_plan_image_id);

create table placements (
    id           uuid primary key,
    place_id     uuid             not null references places (id) on delete cascade,
    equipment_id uuid             references equipment (id) on delete set null,
    x            double precision not null check (x >= 0 and x <= 1),
    y            double precision not null check (y >= 0 and y <= 1),
    color        varchar(7)       not null
);
create index placements_place_idx on placements (place_id);
create index placements_equipment_idx on placements (equipment_id);
