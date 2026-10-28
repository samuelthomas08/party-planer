-- Only the SHA-256 of the invitation token is stored: a database leak cannot be turned into working invite links.
create table invitations (
    id         uuid primary key,
    token_hash varchar(64)  not null unique,
    email      varchar(254),
    role       varchar(10)  not null check (role in ('USER', 'ADMIN')),
    created_by uuid         not null references users (id) on delete cascade,
    created_at timestamptz  not null default now(),
    expires_at timestamptz  not null,
    used_at    timestamptz,
    used_by    uuid,
    revoked_at timestamptz
);
create index invitations_created_idx on invitations (created_at desc);
