# Party Planer – Hinweise für KI-Agenten und Entwickler

Kompakte Arbeitsanleitung für dieses Repo. Die ausführliche Erklärung steht in [DOCUMENTATION.md](docs/DOCUMENTATION.md), die Bedienung in der [README](README.md).
Diese Datei beschreibt nur, **wie man hier Änderungen macht** und **welche Fallen es gibt**.

## Projekt in drei Sätzen

Monorepo mit `backend/` (Spring Boot 4, Java 21, PostgreSQL, Flyway) und `frontend/` (Next.js 16, React 19, TypeScript, Tailwind 4, next-intl, TanStack Query).
Der Browser spricht nur mit Next.js; `/api/*` wird per Rewrite an das Backend weitergereicht (same-origin, Cookies statt Bearer-Token).
Alle Daten gehören einem Besitzer; Orte (Places) mit Markern auf einem Grundriss, Equipment, Ordner, Share-Links für Gäste, Einladungen, Audit-Log.

## Befehle

```sh
# Datenbank für die Entwicklung
docker compose up -d db

# Backend (Profil dev liest ../.env)
cd backend && ./mvnw spring-boot:run -Dspring-boot.run.profiles=dev
cd backend && ./mvnw verify            # alle Tests (Docker nötig: Testcontainers)
cd backend && ./mvnw clean verify      # bei "Unresolved compilation problem"

# Frontend
cd frontend && npm install && npm run dev
cd frontend && npm test                # Vitest
cd frontend && npm run lint && npm run typecheck && npm run build

# Gesamter Stack
cp .env.example .env && docker compose up --build
```

Vor einem Commit müssen laufen: `./mvnw verify` (bei Backend-Änderungen) bzw. `npm run lint && npm run typecheck && npm test` (bei Frontend-Änderungen).
Das CI führt genau das aus, plus einen Docker-Smoke-Test.

## Frontend-Warnung

`frontend/AGENTS.md` (von `next dev` erzeugt) gilt: Diese Next.js-Version hat Breaking Changes. **Vor dem Schreiben von Next.js-Code** die passende Anleitung in
`frontend/node_modules/next/dist/docs/` lesen und Deprecation-Hinweise beachten.

## Wo liegt was?

| Aufgabe | Ort |
|---|---|
| Neuer REST-Endpunkt | `backend/src/main/java/app/partyplaner/<paket>/…Controller` + `…Service` |
| Neue Tabelle/Spalte | **neue** Flyway-Migration `backend/src/main/resources/db/migration/V<n>__name.sql` |
| Konfiguration | `backend/src/main/resources/application.yml`, typisiert in `common/AppProperties` |
| Neue Seite | `frontend/src/app/<gruppe>/…/page.tsx` (dünn!) + Komponente in `frontend/src/components/<bereich>/` |
| Neuer API-Aufruf | Hook in `frontend/src/lib/queries.ts`, Typ in `frontend/src/lib/types.ts` |
| Texte | `frontend/src/messages/de.json` **und** `en.json` |
| Farben/Radien | Tokens in `frontend/src/app/globals.css` |

## Backend-Regeln

* **Schichten:** Controller dünn (HTTP ↔ DTO, `@Valid`), Logik im `@Service` mit `@Transactional`, Zugriff über Spring-Data-Repositories.
* **Besitz prüfen:** Jede Abfrage nutzerbezogener Daten ist auf den Besitzer eingeschränkt (`findByIdAndOwnerId`, `…AndOwnerId`). Fremde Daten antworten mit `404` (`ApiException.notFound`), nie mit `403`. Fremde IDs aus Requests (Bilder, Equipment, Ordner) immer gegen den Besitzer validieren.
* **Schema gehört Flyway.** `ddl-auto` ist `validate`. Bestehende Migrationen **nie ändern**, immer eine neue anlegen. Entity und Migration müssen zusammenpassen, sonst startet das Backend nicht.
* **Fehler:** Erwartete Fehler als `ApiException(status, CODE, message)`. `CODE` ist stabil und maschinenlesbar; das Frontend übersetzt ihn unter `errors.<CODE>`. Neuer Code ⇒ Übersetzung in **beiden** Sprachdateien ergänzen.
* **Audit:** Jede fachliche Änderung ruft `AuditService.record(...)` **in derselben Transaktion** auf. Neue Änderungscodes (`Change`) brauchen Übersetzungen unter `audit.change.<CODE>` bzw. `audit.action.<ACTION>` in `de.json`/`en.json`, sonst zeigt die UI den rohen Code.
* **Logging:** Format `EVENT_CODE key=value`, Großbuchstaben mit Unterstrichen (`PLACE_CREATED owner=… place=…`). **Nie** Passwörter, Tokens, Share-/Einladungs-Secrets oder Roh-Bilddaten loggen.
* **Bilder:** Dateizugriff **nur** über `ImageStorage`. Schlüssel kommen aus UUID + fester Endung, nie aus Benutzereingaben. Löschen erst nach Commit (`deleteAfterCommit`). Typ per Magic Bytes, nicht per Client-Angabe.
* **Tokens/Secrets:** Refresh- und Einladungs-Tokens nur als SHA-256-Hash speichern. Antworten setzen Tokens ausschließlich als `HttpOnly`-Cookies, nie im Body.
* **Neue öffentliche Endpunkte** müssen in `SecurityConfig` (Autorisierung), ggf. in `CookieJwtAuthenticationFilter.shouldNotFilter` und im `RateLimitFilter` berücksichtigt werden. Standard ist `denyAll`.
* **Kommentare:** Javadoc (`/** … */`) auf Englisch an Klassen und öffentlichen Methoden, wie im bestehenden Code. Nur kommentieren, was nicht offensichtlich ist.
* **Tests:** Neue Logik bekommt Unit-Tests (Mockito) im spiegelbildlichen Paket unter `src/test`; Verhalten über HTTP in `ApiIntegrationTest`. Hilfen: `TestUsers`, `TestProps`, `TestcontainersConfiguration`.

## Frontend-Regeln

* **Route-Dateien sind dünn:** Titel (`generateMetadata`) + eine Komponente. Logik gehört in `components/`.
* **Client-Komponenten** brauchen `"use client"`. Daten kommen über TanStack-Query-Hooks aus `lib/queries.ts`; Mutationen invalidieren die betroffenen Caches.
* **API immer über `lib/api.ts`** (`api.get/post/put/patch/delete`). Er kümmert sich um CSRF-Header, stille Token-Erneuerung bei 401 und `ApiError`. Nie direkt `fetch("/api/…")` für normale Aufrufe (Ausnahmen: Logger, CSRF-Bootstrap).
* **Bild-URLs** nur über `imageUrl(id)`; für Gäste ist die Basis `/api/guest/images` (`setImageBase`).
* **Texte nie hartkodieren:** `useTranslations()` bzw. `getTranslations()`; Schlüssel in `de.json` **und** `en.json` mit denselben Platzhaltern (`messages.test.ts` prüft Schlüssel, leere Texte und Platzhalter).
* **Fehleranzeige:** `t(\`errors.${errorKey(err)}\`)`.
* **Styling:** Nur semantische Tokens/Tailwind-Klassen (`bg-canvas`, `text-ink`, `border-line`, `bg-brand-600`, `text-danger-600` …), **keine Roh-Hex-Werte** in Komponenten. Hell und Dunkel müssen beide funktionieren. Touch-Ziele mind. 44 px; mobile-first (Handy ist der Hauptfall).
* **Barrierefreiheit:** Labels über `Field`/`TextInput` & Co., Icon-Buttons mit `label`, echte `<a>`/`<button>` statt `div`-Klicks.
* **Logging:** `log.info/warn/error("EVENT_CODE", "text", {daten})` aus `lib/logger.ts`; nur IDs und Codes, keine Geheimnisse.
* **Tests:** Neben der Datei als `*.test.ts(x)`; Render-Helfer in `src/test/utils.tsx`, Mocks in `src/test/mocks.ts`.

## Fallen (häufige Fehler)

1. **`COOKIE_SECURE=true` über http:** Browser verwerfen die Cookies, Folge: ständig „bitte anmelden“. Lokal/Test über http `COOKIE_SECURE=false`; sonst HTTPS.
2. **Backend nie direkt veröffentlichen.** Es vertraut `X-Forwarded-For` (Rate-Limit, Audit-IP). Nur über den Frontend-Proxy erreichbar lassen.
3. **Service-Name `backend` nicht ändern:** `BACKEND_URL` wird beim Frontend-**Build** eingebacken (`http://backend:8080`).
4. **`JWT_SECRET` ≥ 32 Zeichen**, sonst startet das Backend nicht.
5. **Marker-IDs:** Das Frontend sendet nur für bereits gespeicherte Marker eine `id`. Sonst verliert der Verlauf die Spur eines Markers (er erscheint als „entfernt + hinzugefügt“).
6. **Datenbank und Bildverzeichnis gehören zusammen** (Backup und Wiederherstellung immer beides).
7. **Datenbanknamen:** Standard ist `partyplaner` (früher `partyplanner`); alte Volumes behalten ihre Namen.
8. **Access-Tokens sind zustandslos:** Sofortiges Sperren läuft über `RevokedSessions` (im Speicher, Einzelinstanz). Bei Rollen-/Statusänderungen von Benutzern dort `revokeAllBefore` aufrufen.
9. **Live-Log/Rate-Limit sind im Speicher** und für genau **eine** Backend-Instanz ausgelegt.

## Git und Release

* Hauptzweig ist `release`. Ein Push dorthin (und Tags `v*.*.*`) startet nach grünem CI die Veröffentlichung der Images nach GHCR.
* Commit-Nachrichten im bisherigen Stil (`feat: …`, `fix: …`); kleine, thematisch getrennte Commits.
* Dependabot-PRs (Maven, npm, Docker, Actions) laufen durch dasselbe CI.
