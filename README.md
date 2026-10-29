# Party Planer

Veranstaltungsorte auf einem Grundriss planen und das Equipment darauf platzieren.

| | |
|---|---|
| `frontend/` | Next.js 16 (App Router), TypeScript, Tailwind CSS 4, next-intl (de/en), TanStack Query |
| `backend/`  | Spring Boot 4, Java 21, Spring Security, JPA + Flyway, PostgreSQL 17 |

Vollständige Code-Dokumentation mit Diagrammen (Architektur, Datenmodell, Sicherheit, API-Referenz, Frontend): [docs/DOCUMENTATION.md](docs/DOCUMENTATION.md).

## Alles mit Docker starten

```sh
cp .env.example .env      # POSTGRES_PASSWORD und JWT_SECRET setzen (openssl rand -base64 48)
docker compose up --build # http://localhost:3000   (mit FRONTEND_PORT in der .env ändert sich der Port)
```

Drei Services: `db` (PostgreSQL 17), `backend` (Spring Boot) und `frontend` (Next.js). Nur das Frontend ist veröffentlicht; die API
wird über dessen `/api`-Proxy erreicht, der Backend-Port ist also nie von außen erreichbar (das Backend vertraut `X-Forwarded-For`
für das Rate-Limiting, daher muss das so bleiben). Alle Container laufen als unprivilegierte Benutzer mit `no-new-privileges`, haben
Health-Checks, und die Web-App startet erst, wenn die API gesund ist. Die Daten liegen in zwei benannten Volumes: `pgdata` (Datenbank)
und `imagedata` (hochgeladene Bilder).

Hinter HTTPS gilt `COOKIE_SECURE=true` (Standard; die `.env.example` setzt `false` für lokale Tests über reines http).

> **Wichtig:** Mit `COOKIE_SECURE=true` über **http** verwirft der Browser die Login-Cookies. Registrieren und Anmelden scheinen zu klappen,
> danach erscheint aber immer wieder „bitte anmelden“. Lösung: HTTPS davorschalten oder zum reinen Testen `COOKIE_SECURE=false` setzen.

### Images aus der GHCR

Der Workflow [Publish images](.github/workflows/docker.yml) veröffentlicht beide Images bei jedem Push auf `release` und bei Versions-Tags:

```
ghcr.io/samuelthomas08/party-planer-backend:latest      (auch :sha-<commit>, :1.2.3 für Tags v1.2.3)
ghcr.io/samuelthomas08/party-planer-frontend:latest
```

```sh
docker compose pull && docker compose up -d      # nutzt die veröffentlichten Images statt zu bauen
```

Der erste Push legt private Pakete an: unter *Packages → Package settings* öffentlich machen oder `docker login ghcr.io` verwenden.
Die Images sind Multi-Arch (amd64 + arm64) und enthalten Provenance- und SBOM-Attestierungen. Pull Requests bauen nur, sie pushen nie.

### Fertige Compose-Datei für einen Server

Kein Checkout nötig: Auf dem Server ein leeres Verzeichnis anlegen (z. B. `/opt/party-planer`), diese zwei Dateien hineinlegen – die
veröffentlichten Images werden automatisch gezogen.

`.env`: Die Geheimnisse mit `openssl rand -base64 24` (Datenbank) und `openssl rand -base64 48` (JWT) erzeugen:

```sh
POSTGRES_PASSWORD=<generiert>
JWT_SECRET=<generiert>
COOKIE_SECURE=true          # hinter HTTPS true lassen; false nur für einen Test über reines http
REGISTRATION_ENABLED=true   # auf false setzen, sobald das eigene Konto existiert
FRONTEND_PORT=3000
# IMAGE_TAG=latest          # oder eine Version festnageln, z. B. 1.2.3
```

`docker-compose.yml`:

```yaml
name: party-planer

x-hardening: &hardening
  restart: unless-stopped
  security_opt:
    - no-new-privileges:true

services:
  db:
    <<: *hardening
    image: postgres:17-alpine
    environment:
      POSTGRES_DB: partyplaner
      POSTGRES_USER: partyplaner
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?set POSTGRES_PASSWORD in .env}
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U partyplaner -d partyplaner"]
      interval: 5s
      timeout: 3s
      retries: 10

  backend:
    <<: *hardening
    image: ghcr.io/samuelthomas08/party-planer-backend:${IMAGE_TAG:-latest}
    cap_drop: [ALL]
    depends_on:
      db:
        condition: service_healthy
    environment:
      DB_URL: jdbc:postgresql://db:5432/partyplaner
      DB_USER: partyplaner
      DB_PASSWORD: ${POSTGRES_PASSWORD}
      JWT_SECRET: ${JWT_SECRET:?set JWT_SECRET in .env (openssl rand -base64 48)}
      COOKIE_SECURE: ${COOKIE_SECURE:-true}
      REGISTRATION_ENABLED: ${REGISTRATION_ENABLED:-true}
      IMAGE_DIR: /data/images
    volumes:
      - imagedata:/data/images
    # Bewusst nicht veröffentlicht: Die API ist nur über den /api-Proxy des Frontends erreichbar.
    expose:
      - "8080"

  frontend:
    <<: *hardening
    image: ghcr.io/samuelthomas08/party-planer-frontend:${IMAGE_TAG:-latest}
    cap_drop: [ALL]
    depends_on:
      backend:
        condition: service_healthy
    ports:
      - "${FRONTEND_PORT:-3000}:3000"

volumes:
  pgdata:
  imagedata:
```

```sh
docker compose up -d       # http://<server>:3000, das erste registrierte Konto wird Admin
docker compose pull && docker compose up -d   # später aktualisieren
```

Hinweise:

- Einen Reverse-Proxy mit HTTPS (Caddy, Traefik, nginx) vor Port 3000 schalten und `COOKIE_SECURE=true` lassen; über reines http werden die Login-Cookies nicht gesendet. Damit nur der Proxy erreichbar ist, den Port an localhost binden: `"127.0.0.1:${FRONTEND_PORT:-3000}:3000"`.
- Das Frontend-Image ist für `BACKEND_URL=http://backend:8080` gebaut, der Service muss also `backend` heißen.
- Die Datenbank ist nicht veröffentlicht. Falls du früher andere Datenbanknamen als `partyplaner` genutzt hast, passe sie in den Services `db` und `backend` entsprechend an.
- Die Volumes `pgdata` und `imagedata` immer gemeinsam sichern (siehe *Bildspeicher*). Sind die GHCR-Pakete privat, vorher `docker login ghcr.io` ausführen.

## Lokale Entwicklung

```sh
docker compose up -d db                                   # Postgres auf 127.0.0.1:5432
cd backend  && ./mvnw spring-boot:run -Dspring-boot.run.profiles=dev
cd frontend && npm install && npm run dev                 # http://localhost:3000
```

Das Profil `dev` liest dieselbe `.env` wie Docker Compose, daher stimmen Datenbankname, Benutzer und Passwort immer überein.

> **Lokales Setup aktualisieren:** Datenbankname und -benutzer heißen jetzt standardmäßig `partyplaner` (früher `partyplanner`). Ein früher
> angelegtes Datenbank-Volume behält die alten Namen: entweder `POSTGRES_DB=partyplanner` und `POSTGRES_USER=partyplanner` in die `.env`
> eintragen oder mit `docker compose down -v` neu beginnen.

## Tests und Qualitätssicherung

| | Befehl | Was abgedeckt wird |
|---|---|---|
| Backend | `cd backend && ./mvnw verify` | ~240 Tests: Unit-Tests (Services mit Mockito, Filter, Storage, Diff-Logik, Entities) plus Integrationstests gegen eine echte PostgreSQL über Testcontainers (Docker nötig). JaCoCo-Bericht in `target/site/jacoco`. |
| Frontend | `cd frontend && npm test` | ~275 Vitest- + Testing-Library-Tests (API-Client inkl. CSRF und Refresh, Logger, Formulare, Editor, Admin-Oberflächen, Übersetzungen). `npm run test:coverage` für einen Bericht. |
| Statisch | `npm run lint && npm run typecheck` | ESLint, `tsc --noEmit` |

Kompiliert eine IDE im Hintergrund nach `target/` und Maven meldet danach *„Unresolved compilation problem“*, hilft `./mvnw clean verify`.

### CI

[`ci.yml`](.github/workflows/ci.yml) läuft bei jedem Push und Pull Request: Backend-Tests, Frontend-Lint / -Typen / -Tests / -Build und ein
Smoke-Test, der die Images baut, den gesamten Stack mit `docker compose` startet, einen Benutzer registriert, ein Bild hochlädt und prüft,
dass es im Bild-Volume gelandet ist. [`docker.yml`](.github/workflows/docker.yml) nutzt ihn wieder und veröffentlicht nur bei grünem Ergebnis.
Dependabot hält Maven, npm, Docker und die Actions aktuell.

## Bildspeicher

Hochgeladene Bilder sind **Dateien**, keine Datenbankzeilen. Sie liegen in `IMAGE_DIR` (Standard `backend/data/images` in der Entwicklung, das Docker-Volume `imagedata` unter `/data/images` in Produktion), aufgeteilt als `ab/ab12….png`. Die Datenbank speichert nur die Metadaten und den `storage_key`, der auf die Datei zeigt; die API liefert die Datei mit langlebigen Cache-Headern aus.

- **Datenbank und Bildverzeichnis immer gemeinsam sichern.** Das eine ohne das andere hinterlässt ins Leere zeigende Verweise.
- Dateien werden atomar geschrieben, bei einem Rollback der umgebenden Transaktion wieder entfernt und erst gelöscht, nachdem das Löschen committed wurde. Ein nächtlicher Job entfernt Uploads, die nie zugeordnet wurden, sowie Dateien ohne Datenbankzeile.
- Umstieg von der Version mit Bildern in der Datenbank: Beim ersten Start verschiebt das Backend alle vorhandenen Bilder automatisch auf die Platte (`IMAGE_MIGRATION_*` im Log). Danach ist `images.data` leer; nach einer Kontrolle des Ergebnisses lässt sich der Platz mit `alter table images drop column data;` und anschließend `vacuum full images;` freigeben.

## Authentifizierung

Selbst gehostet, ohne Drittanbieter.

- Passwörter werden mit Argon2id gehasht. Konten sperren sich nach 5 Fehlversuchen für 15 Min. (gleiche allgemeine Fehlermeldung, damit keine Konten erraten werden können). Login und Registrierung sind pro IP ratenbegrenzt.
- 15 Minuten gültiges JWT als Access-Token plus ein undurchsichtiges, rotierendes 14-Tage-Refresh-Token (nur als SHA-256-Hash gespeichert). Wird ein bereits rotiertes Token erneut vorgelegt, wird die gesamte Sitzungsfamilie widerrufen.
- Beide Token sind `httpOnly`-Cookies mit `SameSite=Strict` und für JavaScript nie lesbar.
- CSRF: Double-Submit aus Cookie `XSRF-TOKEN` und Header `X-XSRF-TOKEN` bei jeder zustandsändernden Anfrage.
- Jede Zeile gehört ihrem Besitzer; Daten anderer Benutzer antworten mit 404. Uploads werden anhand der Magic Bytes geprüft (nur PNG/JPEG/WebP).

## Rollen, Freigaben und Verlauf

- **Admins** (das erste registrierte Konto wird automatisch Admin) erhalten *Einstellungen → Benutzer* (Rollen, deaktivieren/aktivieren, entsperren, Passwort zurücksetzen, löschen, anlegen), *Audit-Log*, *Live-Log* und *System* (Registrierung öffnen/schließen). Der letzte aktive Admin kann nie entfernt werden, und niemand kann sich selbst aussperren. Wird ein Benutzer deaktiviert oder herabgestuft, werden seine offenen Sitzungen sofort beendet.
- **Einladungen**: *Einstellungen → Benutzer → Einladen* erstellt einen Einmal-Link (`/invite/<token>`, gültig 24 Std. / 7 Tage / 30 Tage, Rolle vorgegeben, E-Mail optional festgelegt). Die eingeladene Person wählt Namen und Passwort selbst und ist sofort angemeldet. Funktioniert auch bei geschlossener öffentlicher Registrierung. Es wird nur ein Hash des Tokens gespeichert, der Link wird deshalb nur einmal bei der Erstellung angezeigt und kann bis zur Nutzung widerrufen werden.
- **Share-Links**: Bei einem Ort erstellt *Teilen* einen zufälligen Link (24 Std. / 7 Tage / 30 Tage / unbegrenzt, jederzeit widerrufbar). Besucher geben einen Namen ein und machen als **Gast** weiter: reiner Lesezugriff auf genau diesen einen Ort, ohne Konto. Ein Gast-Token kann die normale API nicht nutzen, und mit dem Widerruf des Links enden Gast-Sitzungen sofort.
- **Verlauf**: Jede Änderung wird dauerhaft protokolliert – wer (Benutzer, Gast oder System), was, wann, bei welchem Ort und genau wie (Umbenennungen, Marker hinzugefügt/verschoben/umgefärbt/neu zugewiesen, Grundriss ausgetauscht, ...). Besitzer sehen ihn pro Ort (*Verlauf*), Admins sehen alles inkl. IP-Adressen und den Verlauf gelöschter Orte unter *Einstellungen → Audit-Log*.
- **Logging**: Jedes Backend-Ereignis wird als `EVENT_CODE key=value` mit einer Request-ID (auch als `X-Request-Id` gesendet) und dem handelnden Benutzer protokolliert. Der Browser schickt seine eigenen Ereignisse und unbehandelte Fehler in dasselbe Log. *Einstellungen → Live-Log* zeigt es live (Pause, Suche, Level-Filter, Download) und lässt Admins das Server-Log-Level zur Laufzeit ändern. Passwörter, Token und Share-Link-Geheimnisse werden nie protokolliert.

## Theme

Alle Farben, Radien und Schatten sind Tokens in `frontend/src/app/globals.css` (Markenfarbskala ausgehend vom ursprünglichen `#5672E4`, ein konfettipinker Akzent, heller und dunkler Modus). Komponenten verwenden ausschließlich die semantischen Tokens.

## Umstieg von der Firebase-Version

Daten werden nicht migriert: Die alte App speicherte alles in einem gemeinsamen Firestore mit einem einzigen Passwort. Orte und Equipment neu erfassen oder ein Import-Skript anfragen.
