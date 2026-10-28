# Party Planer

Plan party venues on a floor plan and place your equipment on it.

| | |
|---|---|
| `frontend/` | Next.js 16 (App Router), TypeScript, Tailwind CSS 4, next-intl (de/en), TanStack Query |
| `backend/`  | Spring Boot 4, Java 21, Spring Security, JPA + Flyway, PostgreSQL 17 |

## Run everything with Docker

```sh
cp .env.example .env      # set POSTGRES_PASSWORD and JWT_SECRET (openssl rand -base64 48)
docker compose up --build # http://localhost:3000   (FRONTEND_PORT in .env changes the port)
```

Three services: `db` (PostgreSQL 17), `backend` (Spring Boot) and `frontend` (Next.js). Only the frontend is published; the API
is reached through its `/api` proxy, so the backend port is never exposed (it trusts `X-Forwarded-For` for rate limiting, so keep
it that way). All containers run as unprivileged users with `no-new-privileges`, have health checks, and the web app starts only
once the API is healthy. Data lives in two named volumes: `pgdata` (database) and `imagedata` (uploaded images).

Behind HTTPS set `COOKIE_SECURE=true` (the default; `.env.example` sets `false` for plain-http local trials).

### Images from GHCR

The [Publish images](.github/workflows/docker.yml) workflow pushes both images on every push to `release` and on version tags:

```
ghcr.io/samuelthomas08/party-planer-backend:latest      (also :sha-<commit>, :1.2.3 for tags v1.2.3)
ghcr.io/samuelthomas08/party-planer-frontend:latest
```

```sh
docker compose pull && docker compose up -d      # uses the published images instead of building
```

The first push creates private packages: make them public under *Packages → Package settings*, or `docker login ghcr.io`.
Images are multi-arch (amd64 + arm64) and carry provenance and SBOM attestations. Pull requests only build, they never push.

## Local development

```sh
docker compose up -d db                                   # Postgres on 127.0.0.1:5432
cd backend  && ./mvnw spring-boot:run -Dspring-boot.run.profiles=dev
cd frontend && npm install && npm run dev                 # http://localhost:3000
```

The `dev` profile reads the same `.env` as Docker Compose, so database name, user and password always match.

> **Upgrading a local setup:** the default database name and user are now `partyplaner` (they used to be `partyplanner`). A database
> volume created earlier keeps its old names: either add `POSTGRES_DB=partyplanner` and `POSTGRES_USER=partyplanner` to your `.env`,
> or start fresh with `docker compose down -v`.

## Tests and quality gates

| | command | what it covers |
|---|---|---|
| Backend | `cd backend && ./mvnw verify` | ~240 tests: unit tests (services with Mockito, filters, storage, diff logic, entities) plus integration tests against a real PostgreSQL via Testcontainers (needs Docker). JaCoCo report in `target/site/jacoco`. |
| Frontend | `cd frontend && npm test` | ~275 Vitest + Testing Library tests (API client incl. CSRF and refresh, logger, forms, editor, admin screens, translations). `npm run test:coverage` for a report. |
| Static | `npm run lint && npm run typecheck` | ESLint, `tsc --noEmit` |

If an IDE compiles into `target/` in the background and Maven then reports *"Unresolved compilation problem"*, run `./mvnw clean verify`.

### CI

[`ci.yml`](.github/workflows/ci.yml) runs on every push and pull request: backend tests, frontend lint / types / tests / build, and a
smoke test that builds the images, starts the whole stack with `docker compose`, registers a user, uploads an image and checks that it
landed in the image volume. [`docker.yml`](.github/workflows/docker.yml) reuses it and only publishes when it is green. Dependabot keeps
Maven, npm, Docker and the actions up to date.

## Image storage

Uploaded images are **files**, not database rows. They live in `IMAGE_DIR` (default `backend/data/images` in development, the `imagedata` Docker volume at `/data/images` in production), sharded as `ab/ab12….png`. The database only stores the metadata and the `storage_key` pointing at the file; the API streams the file with long-lived cache headers.

- **Back up the database and the image directory together.** One without the other leaves dangling references.
- Files are written atomically, removed again if the surrounding transaction rolls back, and deleted only after a delete has committed. A nightly job removes uploads that were never attached to anything and files without a database row.
- Upgrading from the database-stored version: on first start the backend moves every existing image to disk automatically (`IMAGE_MIGRATION_*` in the log). Afterwards `images.data` is empty; once you have checked the result you can reclaim the space with `alter table images drop column data;` followed by `vacuum full images;`.

## Authentication

Self-hosted, no third-party service.

- Passwords hashed with Argon2id. Accounts lock for 15 min after 5 failed logins (same generic error, so no account enumeration). Login/register are rate limited per IP.
- 15-minute JWT access token plus an opaque, rotating 14-day refresh token (stored only as SHA-256 hash). Replaying an already-rotated token revokes the whole session family.
- Both tokens are `httpOnly`, `SameSite=Strict` cookies, never readable by JavaScript.
- CSRF: double-submit `XSRF-TOKEN` cookie / `X-XSRF-TOKEN` header on every state-changing request.
- Every row is scoped to its owner; other users' data answers 404. Uploads are type-checked by magic bytes (PNG/JPEG/WebP only).

## Roles, sharing and history

- **Admins** (the first account to register is admin automatically) get *Settings → Users* (roles, disable/enable, unlock, password reset, delete, create), *Audit log*, *Live log* and *System* (open/close registration). The last active admin can never be removed, and nobody can lock themselves out. Disabling or demoting a user cuts off their open sessions immediately.
- **Invitations**: *Settings → Users → Invite* creates a one-time link (`/invite/<token>`, valid 24 h / 7 d / 30 d, role preset, e-mail optionally fixed). The invited person picks their own name and password and is signed in right away. Works even while public registration is closed. Only a hash of the token is stored, so the link is shown once at creation and can be revoked until it is used.
- **Share links**: on a place, *Share* creates a random link (24 h / 7 d / 30 d / unlimited, revocable at any time). Visitors enter a name and continue as **guest**: read-only access to that single place, no account. A guest token cannot touch the normal API, and revoking the link ends guest sessions at once.
- **History**: every change is recorded permanently with who (user, guest or system), what, when, which place and exactly how (renames, markers added/moved/recoloured/re-assigned, floor plan replaced, ...). Owners see it per place (*History*), admins see everything incl. IP addresses and history of deleted places in *Settings → Audit log*.
- **Logging**: every backend event is logged as `EVENT_CODE key=value` with a per-request id (also sent as `X-Request-Id`) and the acting user. The browser ships its own events and uncaught errors to the same log. *Settings → Live log* streams it live (pause, search, level filter, download) and lets admins change the server log level at runtime. Passwords, tokens and share-link secrets are never logged.

## Theme

All colours, radii and shadows are tokens in `frontend/src/app/globals.css` (brand ramp from the original `#5672E4`, a confetti-pink accent, light and dark mode). Components use only the semantic tokens.

## Migrating from the Firebase version

Data is not migrated: the old app stored everything in one shared Firestore with a single password. Re-enter places and equipment, or ask for an import script.
