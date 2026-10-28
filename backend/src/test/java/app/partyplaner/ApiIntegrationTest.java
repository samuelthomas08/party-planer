package app.partyplaner;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import jakarta.servlet.http.Cookie;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest(properties = {
        "app.security.jwt-secret=test-secret-test-secret-test-secret-1234",
        "app.security.cookie-secure=false",
        "app.security.auth-rate-limit-per-minute=1000",
        "app.storage.image-dir=${java.io.tmpdir}/partyplaner-test-images"})
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class ApiIntegrationTest {

    private static final String PASSWORD = "correct horse battery";
    // 1x1 transparent PNG
    private static final byte[] PNG = java.util.Base64.getDecoder().decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==");

    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired app.partyplaner.image.ImageStorage storage;
    @Autowired app.partyplaner.image.LegacyImageMigrator migrator;

    /** A logged-in browser: holds the cookies the server set. */
    private final class Client {
        String access, refresh, csrf;

        Client(String email) throws Exception {
            csrf = mvc.perform(get("/api/auth/csrf")).andReturn().getResponse().getCookie("XSRF-TOKEN").getValue();
            MvcResult r = mvc.perform(post("/api/auth/register").with(this::csrfOnly).contentType(MediaType.APPLICATION_JSON)
                            .content("{\"email\":\"" + email + "\",\"password\":\"" + PASSWORD + "\",\"displayName\":\"Test\"}"))
                    .andExpect(status().isCreated()).andReturn();
            store(r);
        }

        String userId() {
            return access.split("\\.").length == 3
                    ? new String(java.util.Base64.getUrlDecoder().decode(access.split("\\.")[1])).replaceAll(".*\"sub\":\"([^\"]+)\".*", "$1")
                    : null;
        }

        Client withRole(String email, String role) throws Exception {
            jdbc.update("update users set role = ? where email = ?", role, email);
            MvcResult r = mvc.perform(post("/api/auth/login").with(this::csrfOnly).contentType(MediaType.APPLICATION_JSON)
                    .content("{\"email\":\"" + email + "\",\"password\":\"" + PASSWORD + "\"}")).andExpect(status().isOk()).andReturn();
            store(r);
            return this;
        }

        /** Promotes the account in the database and logs in again so the token carries the new role. */
        Client promoteToAdmin(String email) throws Exception {
            return withRole(email, "ADMIN");
        }

        void store(MvcResult r) {
            access = r.getResponse().getCookie("pp_access").getValue();
            refresh = r.getResponse().getCookie("pp_refresh").getValue();
        }

        org.springframework.mock.web.MockHttpServletRequest csrfOnly(org.springframework.mock.web.MockHttpServletRequest req) {
            Cookie[] existing = req.getCookies() == null ? new Cookie[0] : req.getCookies();
            Cookie[] all = java.util.Arrays.copyOf(existing, existing.length + 1);
            all[existing.length] = new Cookie("XSRF-TOKEN", csrf);
            req.setCookies(all);
            req.addHeader("X-XSRF-TOKEN", csrf);
            return req;
        }

        <T extends org.springframework.test.web.servlet.request.AbstractMockHttpServletRequestBuilder<T>> T auth(T b) {
            return b.cookie(new Cookie("pp_access", access), new Cookie("XSRF-TOKEN", csrf)).header("X-XSRF-TOKEN", csrf);
        }
    }

    private String email() {
        return UUID.randomUUID() + "@example.com";
    }

    @Test
    void unauthenticatedRequestsAreRejected() throws Exception {
        mvc.perform(get("/api/folders")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/equipment")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/images/" + UUID.randomUUID())).andExpect(status().isUnauthorized());
    }

    @Test
    void stateChangingRequestsNeedCsrfToken() throws Exception {
        Client c = new Client(email());
        mvc.perform(post("/api/folders").cookie(new Cookie("pp_access", c.access))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"x\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void forgedTokenIsRejected() throws Exception {
        mvc.perform(get("/api/folders").cookie(new Cookie("pp_access", "eyJhbGciOiJIUzI1NiJ9.e30.abc")))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void meReturnsCurrentUserAndNeverLeaksHash() throws Exception {
        String email = email();
        Client c = new Client(email);
        mvc.perform(c.auth(get("/api/auth/me"))).andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value(email))
                .andExpect(jsonPath("$.passwordHash").doesNotExist());
    }

    @Test
    void weakPasswordAndDuplicateEmailAreRejected() throws Exception {
        Client c = new Client(email());
        String dup = email();
        new Client(dup);
        mvc.perform(post("/api/auth/register").with(c::csrfOnly).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + dup + "\",\"password\":\"" + PASSWORD + "\",\"displayName\":\"x\"}"))
                .andExpect(status().isConflict());
        mvc.perform(post("/api/auth/register").with(c::csrfOnly).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email() + "\",\"password\":\"short\",\"displayName\":\"x\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void accountLocksAfterRepeatedFailures() throws Exception {
        String email = email();
        Client c = new Client(email);
        for (int i = 0; i < 5; i++) {
            mvc.perform(post("/api/auth/login").with(c::csrfOnly).contentType(MediaType.APPLICATION_JSON)
                            .content("{\"email\":\"" + email + "\",\"password\":\"wrong-password-1\"}"))
                    .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"));
        }
        // Even the right password is refused while locked, with the same generic error.
        mvc.perform(post("/api/auth/login").with(c::csrfOnly).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"" + PASSWORD + "\"}"))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"));
    }

    @Test
    void refreshRotatesAndReuseRevokesTheFamily() throws Exception {
        Client c = new Client(email());
        String first = c.refresh;

        MvcResult rotated = mvc.perform(post("/api/auth/refresh").with(c::csrfOnly)
                .cookie(new Cookie("pp_refresh", first))).andExpect(status().isOk()).andReturn();
        String second = rotated.getResponse().getCookie("pp_refresh").getValue();
        assertThat(second).isNotEqualTo(first);

        // Immediate replay of the old token is treated as a race: rejected, but the new token survives.
        mvc.perform(post("/api/auth/refresh").with(c::csrfOnly).cookie(new Cookie("pp_refresh", first)))
                .andExpect(status().isUnauthorized());

        // Age the revocation so the replay now looks like theft.
        jdbc.update("update refresh_tokens set revoked_at = now() - interval '1 hour' where revoked_at is not null");
        mvc.perform(post("/api/auth/refresh").with(c::csrfOnly).cookie(new Cookie("pp_refresh", first)))
                .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/auth/refresh").with(c::csrfOnly).cookie(new Cookie("pp_refresh", second)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void logoutRevokesRefreshToken() throws Exception {
        Client c = new Client(email());
        mvc.perform(post("/api/auth/logout").with(c::csrfOnly).cookie(new Cookie("pp_refresh", c.refresh)))
                .andExpect(status().isNoContent());
        mvc.perform(post("/api/auth/refresh").with(c::csrfOnly).cookie(new Cookie("pp_refresh", c.refresh)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void fullPlaceFlowAndOwnershipIsolation() throws Exception {
        Client alice = new Client(email());
        Client bob = new Client(email());

        String imageId = upload(alice);
        String floorId = upload(alice);

        // equipment with an image
        MvcResult eq = mvc.perform(alice.auth(post("/api/equipment")).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Stand\",\"description\":\"d\",\"category\":\"STAND\",\"images\":{\"TOP_BAR\":\"" + imageId + "\"}}"))
                .andExpect(status().isCreated()).andReturn();
        String equipmentId = field(eq, "id");

        // photo slot is not valid for stands
        mvc.perform(alice.auth(post("/api/equipment")).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Bad\",\"category\":\"STAND\",\"images\":{\"PHOTO\":\"" + imageId + "\"}}"))
                .andExpect(status().isBadRequest());

        String folderId = field(mvc.perform(alice.auth(post("/api/folders")).contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Hall\"}")).andExpect(status().isCreated()).andReturn(), "id");

        String placeJson = "{\"name\":\"Main hall\",\"folderId\":\"" + folderId + "\",\"floorPlanImageId\":\"" + floorId
                + "\",\"placements\":[{\"x\":0.5,\"y\":0.25,\"equipmentId\":\"" + equipmentId + "\",\"color\":\"#5672E4\"}]}";
        String placeId = field(mvc.perform(alice.auth(post("/api/places")).contentType(MediaType.APPLICATION_JSON)
                .content(placeJson)).andExpect(status().isCreated()).andReturn(), "id");

        // out-of-range coordinates are refused
        mvc.perform(alice.auth(post("/api/places")).contentType(MediaType.APPLICATION_JSON)
                        .content(placeJson.replace("0.5", "1.5")))
                .andExpect(status().isBadRequest());

        mvc.perform(alice.auth(get("/api/folders"))).andExpect(status().isOk())
                .andExpect(jsonPath("$[0].places[0].name").value("Main hall"));

        // Bob can neither see nor touch Alice's data, including her images.
        mvc.perform(bob.auth(get("/api/places/" + placeId))).andExpect(status().isNotFound());
        mvc.perform(bob.auth(put("/api/places/" + placeId)).contentType(MediaType.APPLICATION_JSON).content(placeJson))
                .andExpect(status().isNotFound());
        mvc.perform(bob.auth(delete("/api/equipment/" + equipmentId))).andExpect(status().isNotFound());
        mvc.perform(bob.auth(get("/api/images/" + imageId))).andExpect(status().isNotFound());
        mvc.perform(bob.auth(get("/api/folders"))).andExpect(status().isOk()).andExpect(jsonPath("$").isEmpty());
        // ...and cannot reference Alice's equipment or images in his own place.
        String bobFolder = field(mvc.perform(bob.auth(post("/api/folders")).contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Mine\"}")).andReturn(), "id");
        mvc.perform(bob.auth(post("/api/places")).contentType(MediaType.APPLICATION_JSON)
                        .content(placeJson.replace(folderId, bobFolder)))
                .andExpect(status().isBadRequest());

        // Alice sees her own image
        mvc.perform(alice.auth(get("/api/images/" + imageId))).andExpect(status().isOk())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.header()
                        .string(HttpHeaders.CONTENT_TYPE, "image/png"));

        // Deleting the folder cascades to places and removes the now-unreferenced floor plan image.
        mvc.perform(alice.auth(delete("/api/folders/" + folderId))).andExpect(status().isNoContent());
        mvc.perform(alice.auth(get("/api/places/" + placeId))).andExpect(status().isNotFound());
        mvc.perform(alice.auth(get("/api/images/" + floorId))).andExpect(status().isNotFound());

        // Deleting equipment removes its images as well.
        mvc.perform(alice.auth(delete("/api/equipment/" + equipmentId))).andExpect(status().isNoContent());
        mvc.perform(alice.auth(get("/api/images/" + imageId))).andExpect(status().isNotFound());
    }


    // ------------------------------------------------------------------ admin, audit, sharing, live log

    @Test
    void adminEndpointsAreForbiddenForNormalUsers() throws Exception {
        String email = email();
        Client user = new Client(email).withRole(email, "USER");
        mvc.perform(user.auth(get("/api/admin/users"))).andExpect(status().isForbidden());
        mvc.perform(user.auth(get("/api/admin/audit"))).andExpect(status().isForbidden());
        mvc.perform(user.auth(get("/api/admin/logs"))).andExpect(status().isForbidden());
        mvc.perform(user.auth(get("/api/admin/logs/stream"))).andExpect(status().isForbidden());
    }

    @Test
    void adminManagesUsersAndGuardsRemainInPlace() throws Exception {
        String adminEmail = email();
        Client admin = new Client(adminEmail).promoteToAdmin(adminEmail);
        String victimEmail = email();
        Client victim = new Client(victimEmail);

        mvc.perform(admin.auth(get("/api/admin/users"))).andExpect(status().isOk());

        // Cannot disable or demote yourself
        mvc.perform(admin.auth(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch("/api/admin/users/" + admin.userId()))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"enabled\":false}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("CANNOT_MODIFY_SELF"));

        // Disabling a user cuts off their existing access token immediately
        mvc.perform(victim.auth(get("/api/folders"))).andExpect(status().isOk());
        mvc.perform(admin.auth(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch("/api/admin/users/" + victim.userId()))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"enabled\":false}"))
                .andExpect(status().isOk());
        mvc.perform(victim.auth(get("/api/folders"))).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/auth/refresh").with(victim::csrfOnly).cookie(new Cookie("pp_refresh", victim.refresh)))
                .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/auth/login").with(victim::csrfOnly).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + victimEmail + "\",\"password\":\"" + PASSWORD + "\"}"))
                .andExpect(status().isUnauthorized());

        // Deleting removes the account and its data
        mvc.perform(admin.auth(delete("/api/admin/users/" + victim.userId()))).andExpect(status().isNoContent());
        assertThat(jdbc.queryForObject("select count(*) from users where email = ?", Integer.class, victimEmail)).isZero();
    }

    @Test
    void auditTrailRecordsWhoChangedWhatOnAPlace() throws Exception {
        String ownerEmail = email();
        Client owner = new Client(ownerEmail);
        String floor = upload(owner);
        String equipmentId = field(mvc.perform(owner.auth(post("/api/equipment")).contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"Truss\",\"category\":\"STAND\",\"images\":{}}")).andExpect(status().isCreated()).andReturn(), "id");
        String folderId = field(mvc.perform(owner.auth(post("/api/folders")).contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Hall\"}")).andReturn(), "id");
        MvcResult created = mvc.perform(owner.auth(post("/api/places")).contentType(MediaType.APPLICATION_JSON).content(
                "{\"name\":\"Main\",\"folderId\":\"" + folderId + "\",\"floorPlanImageId\":\"" + floor + "\",\"placements\":"
                        + "[{\"x\":0.2,\"y\":0.2,\"color\":\"#112233\"}]}")).andExpect(status().isCreated()).andReturn();
        String placeId = field(created, "id");
        String markerId = field(created, "id", 1);

        // Edit: rename, move marker, assign equipment, add second marker
        mvc.perform(owner.auth(put("/api/places/" + placeId)).contentType(MediaType.APPLICATION_JSON).content(
                "{\"name\":\"Main hall\",\"folderId\":\"" + folderId + "\",\"floorPlanImageId\":\"" + floor + "\",\"placements\":["
                        + "{\"id\":\"" + markerId + "\",\"x\":0.6,\"y\":0.2,\"equipmentId\":\"" + equipmentId + "\",\"color\":\"#112233\"},"
                        + "{\"x\":0.5,\"y\":0.5,\"color\":\"#445566\"}]}")).andExpect(status().isOk());

        String adminEmail = email();
        Client admin = new Client(adminEmail).promoteToAdmin(adminEmail);

        // Owner and admin see the same story; marker ids stayed stable so the diff is precise.
        for (Client viewer : List.of(owner, admin)) {
            String body = mvc.perform(viewer.auth(get("/api/places/" + placeId + "/activity"))).andExpect(status().isOk())
                    .andReturn().getResponse().getContentAsString();
            assertThat(body).contains("PLACE_CREATED", "PLACE_UPDATED", "\"NAME\"", "MARKER_MOVED", "MARKER_EQUIPMENT", "MARKER_ADDED", "Truss");
        }
        // Only admins get the IP address; other users get 404 for places they do not own.
        String ownerView = mvc.perform(owner.auth(get("/api/places/" + placeId + "/activity"))).andReturn().getResponse().getContentAsString();
        assertThat(ownerView).doesNotContain("\"ip\"");
        Client stranger = new Client(email());
        mvc.perform(stranger.auth(get("/api/places/" + placeId + "/activity"))).andExpect(status().isNotFound());

        // History survives deleting the place
        mvc.perform(owner.auth(delete("/api/places/" + placeId))).andExpect(status().isNoContent());
        mvc.perform(admin.auth(get("/api/admin/audit?placeId=" + placeId))).andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].action").value("PLACE_DELETED"));
    }

    @Test
    void guestCanReadASharedPlaceUntilTheLinkIsRevoked() throws Exception {
        Client owner = new Client(email());
        String floor = upload(owner);
        String equipImage = upload(owner);
        String equipmentId = field(mvc.perform(owner.auth(post("/api/equipment")).contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"Spot\",\"category\":\"STAND\",\"images\":{\"FOOT\":\"" + equipImage + "\"}}")).andReturn(), "id");
        String secretImage = upload(owner); // not part of the place
        String folderId = field(mvc.perform(owner.auth(post("/api/folders")).contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"F\"}")).andReturn(), "id");
        String placeId = field(mvc.perform(owner.auth(post("/api/places")).contentType(MediaType.APPLICATION_JSON).content(
                "{\"name\":\"Shared\",\"folderId\":\"" + folderId + "\",\"floorPlanImageId\":\"" + floor + "\",\"placements\":"
                        + "[{\"x\":0.2,\"y\":0.2,\"equipmentId\":\"" + equipmentId + "\",\"color\":\"#112233\"}]}")).andReturn(), "id");

        MvcResult share = mvc.perform(owner.auth(post("/api/places/" + placeId + "/shares")).contentType(MediaType.APPLICATION_JSON)
                .content("{\"expiresInHours\":24}")).andExpect(status().isCreated()).andReturn();
        String token = field(share, "token");
        String shareId = field(share, "id");

        // Preview needs no login
        mvc.perform(get("/api/share/" + token)).andExpect(status().isOk()).andExpect(jsonPath("$.placeName").value("Shared"));
        mvc.perform(get("/api/share/not-a-real-token")).andExpect(status().isNotFound());

        // Join as guest
        String csrf = mvc.perform(get("/api/auth/csrf")).andReturn().getResponse().getCookie("XSRF-TOKEN").getValue();
        MvcResult joined = mvc.perform(post("/api/share/" + token + "/guest").cookie(new Cookie("XSRF-TOKEN", csrf)).header("X-XSRF-TOKEN", csrf)
                .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Gina Guest\"}")).andExpect(status().isOk()).andReturn();
        Cookie guest = joined.getResponse().getCookie("pp_guest");
        assertThat(guest).isNotNull();
        assertThat(guest.isHttpOnly()).isTrue();

        mvc.perform(get("/api/guest/place").cookie(guest)).andExpect(status().isOk())
                .andExpect(jsonPath("$.place.name").value("Shared")).andExpect(jsonPath("$.equipment[0].title").value("Spot"));
        mvc.perform(get("/api/guest/images/" + floor).cookie(guest)).andExpect(status().isOk());
        mvc.perform(get("/api/guest/images/" + equipImage).cookie(guest)).andExpect(status().isOk());
        mvc.perform(get("/api/guest/images/" + secretImage).cookie(guest)).andExpect(status().isNotFound());

        // A guest is no user: the normal API stays closed, and a user token does not work in the guest area
        mvc.perform(get("/api/folders").cookie(new Cookie("pp_access", guest.getValue()))).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/folders").cookie(guest)).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/guest/place").cookie(new Cookie("pp_guest", owner.access))).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/guest/place")).andExpect(status().isUnauthorized());

        // The owner's history shows the guest
        String activity = mvc.perform(owner.auth(get("/api/places/" + placeId + "/activity"))).andReturn().getResponse().getContentAsString();
        assertThat(activity).contains("GUEST_JOINED", "Gina Guest", "SHARE_CREATED");
        assertThat(activity).doesNotContain(token);

        // Revoking cuts the guest off at once and kills the link
        mvc.perform(owner.auth(delete("/api/places/" + placeId + "/shares/" + shareId))).andExpect(status().isNoContent());
        mvc.perform(get("/api/guest/place").cookie(guest)).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/share/" + token)).andExpect(status().isNotFound());

        // Other users cannot manage someone else's links
        Client stranger = new Client(email());
        mvc.perform(stranger.auth(post("/api/places/" + placeId + "/shares")).contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void liveLogSnapshotShowsRequestsAndNeverSecrets() throws Exception {
        String adminEmail = email();
        Client admin = new Client(adminEmail).promoteToAdmin(adminEmail);
        // client-side log entries are accepted, sanitised and appear in the log
        mvc.perform(admin.auth(post("/api/client-logs")).contentType(MediaType.APPLICATION_JSON)
                .content("{\"entries\":[{\"level\":\"error\",\"event\":\"TEST_EVENT\",\"message\":\"boom\\nFAKE LINE\",\"url\":\"/x\"}]}"))
                .andExpect(status().isNoContent());
        String log = mvc.perform(admin.auth(get("/api/admin/logs?limit=3000"))).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        assertThat(log).contains("AUTH_REGISTER_OK", "AUTH_LOGIN_OK", "CLIENT", "TEST_EVENT", "requestId");
        assertThat(log).doesNotContain(PASSWORD);
        assertThat(log).doesNotContain("\\nFAKE LINE");
        mvc.perform(admin.auth(get("/api/admin/logs/level"))).andExpect(jsonPath("$.level").exists());
    }

    @Test
    void firstRegisteredUserBecomesAdminAndRegistrationCanBeClosed() throws Exception {
        String adminEmail = email();
        Client admin = new Client(adminEmail).promoteToAdmin(adminEmail);
        mvc.perform(admin.auth(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put("/api/admin/settings"))
                .contentType(MediaType.APPLICATION_JSON).content("{\"registrationEnabled\":false}")).andExpect(status().isOk());
        String csrf = mvc.perform(get("/api/auth/csrf")).andReturn().getResponse().getCookie("XSRF-TOKEN").getValue();
        mvc.perform(post("/api/auth/register").cookie(new Cookie("XSRF-TOKEN", csrf)).header("X-XSRF-TOKEN", csrf)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email() + "\",\"password\":\"" + PASSWORD + "\",\"displayName\":\"x\"}"))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("REGISTRATION_DISABLED"));
        mvc.perform(admin.auth(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put("/api/admin/settings"))
                .contentType(MediaType.APPLICATION_JSON).content("{\"registrationEnabled\":true}")).andExpect(status().isOk());
    }

    @Test
    void passwordChangeSignsOutOtherSessions() throws Exception {
        String email = email();
        Client c = new Client(email);
        String otherDeviceRefresh = c.refresh;
        mvc.perform(c.auth(post("/api/auth/password")).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"currentPassword\":\"wrong-wrong-wrong\",\"newPassword\":\"another long password\"}"))
                .andExpect(status().isForbidden());
        MvcResult changed = mvc.perform(c.auth(post("/api/auth/password")).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"currentPassword\":\"" + PASSWORD + "\",\"newPassword\":\"another long password\"}"))
                .andExpect(status().isOk()).andReturn();
        assertThat(changed.getResponse().getCookie("pp_refresh")).isNotNull();
        mvc.perform(post("/api/auth/refresh").with(c::csrfOnly).cookie(new Cookie("pp_refresh", otherDeviceRefresh)))
                .andExpect(status().isUnauthorized());
    }

    // ------------------------------------------------------------------ images live on disk, not in the database

    @Test
    void imageBytesAreStoredAsFilesAndTheDatabaseOnlyKeepsAReference() throws Exception {
        Client c = new Client(email());
        String imageId = upload(c);

        String key = jdbc.queryForObject("select storage_key from images where id = ?::uuid", String.class, imageId);
        java.nio.file.Path file = storage.root().resolve(key);
        assertThat(file).exists();
        assertThat(java.nio.file.Files.readAllBytes(file)).isEqualTo(PNG);
        assertThat(key).matches("[0-9a-f]{2}/" + imageId + "\\.png");
        assertThat(jdbc.queryForObject("select data is null from images where id = ?::uuid", Boolean.class, imageId)).isTrue();

        // served from the file with correct headers
        MvcResult served = mvc.perform(c.auth(get("/api/images/" + imageId))).andExpect(status().isOk()).andReturn();
        assertThat(served.getResponse().getContentAsByteArray()).isEqualTo(PNG);
        assertThat(served.getResponse().getHeader("Cache-Control")).contains("immutable");

        // deleting the owning equipment removes the row and the file
        String equipmentId = field(mvc.perform(c.auth(post("/api/equipment")).contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"E\",\"category\":\"STAND\",\"images\":{\"FOOT\":\"" + imageId + "\"}}")).andReturn(), "id");
        mvc.perform(c.auth(delete("/api/equipment/" + equipmentId))).andExpect(status().isNoContent());
        assertThat(file).doesNotExist();
        assertThat(jdbc.queryForObject("select count(*) from images where id = ?::uuid", Integer.class, imageId)).isZero();
    }

    @Test
    void deletingAUserRemovesTheirImageFiles() throws Exception {
        String adminEmail = email();
        Client admin = new Client(adminEmail).promoteToAdmin(adminEmail);
        Client victim = new Client(email());
        String imageId = upload(victim);
        java.nio.file.Path file = storage.root().resolve(
                jdbc.queryForObject("select storage_key from images where id = ?::uuid", String.class, imageId));
        assertThat(file).exists();
        mvc.perform(admin.auth(delete("/api/admin/users/" + victim.userId()))).andExpect(status().isNoContent());
        assertThat(file).doesNotExist();
    }

    @Test
    void legacyDatabaseImagesAreMovedToDiskOnStartup() throws Exception {
        Client c = new Client(email());
        UUID id = UUID.randomUUID();
        jdbc.update("insert into images (id, owner_id, content_type, size_bytes, data) values (?, ?::uuid, 'image/png', ?, ?)",
                id, c.userId(), PNG.length, PNG);

        migrator.afterPropertiesSet();

        String key = jdbc.queryForObject("select storage_key from images where id = ?", String.class, id);
        assertThat(java.nio.file.Files.readAllBytes(storage.root().resolve(key))).isEqualTo(PNG);
        assertThat(jdbc.queryForObject("select data is null from images where id = ?", Boolean.class, id)).isTrue();
        mvc.perform(c.auth(get("/api/images/" + id))).andExpect(status().isOk());
        migrator.afterPropertiesSet(); // idempotent
    }

    @Test
    void storageNeverResolvesOutsideItsRoot() {
        org.junit.jupiter.api.Assertions.assertThrows(IllegalArgumentException.class, () -> storage.resolve("../../etc/passwd"));
        org.junit.jupiter.api.Assertions.assertThrows(IllegalArgumentException.class, () -> storage.resolve("/etc/passwd"));
    }

    // ------------------------------------------------------------------ invitations

    @Test
    void invitationLetsSomeoneCreateTheirOwnAccountExactlyOnce() throws Exception {
        String adminEmail = email();
        Client admin = new Client(adminEmail).promoteToAdmin(adminEmail);
        // Even with public registration switched off, an invitation still works.
        mvc.perform(admin.auth(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put("/api/admin/settings"))
                .contentType(MediaType.APPLICATION_JSON).content("{\"registrationEnabled\":false}")).andExpect(status().isOk());

        MvcResult created = mvc.perform(admin.auth(post("/api/admin/invitations")).contentType(MediaType.APPLICATION_JSON)
                .content("{\"role\":\"ADMIN\",\"expiresInHours\":24}")).andExpect(status().isCreated()).andReturn();
        String token = field(created, "token");
        String invitationId = field(created, "id");

        // Only the hash is stored, and the list never shows the token again
        assertThat(jdbc.queryForObject("select count(*) from invitations where token_hash = ?", Integer.class, token)).isZero();
        assertThat(mvc.perform(admin.auth(get("/api/admin/invitations"))).andReturn().getResponse().getContentAsString()).doesNotContain(token);

        mvc.perform(get("/api/invite/" + token)).andExpect(status().isOk()).andExpect(jsonPath("$.invitedBy").exists());
        mvc.perform(get("/api/invite/nonsense-token")).andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("INVITE_INVALID"));

        String newEmail = email();
        String csrf = mvc.perform(get("/api/auth/csrf")).andReturn().getResponse().getCookie("XSRF-TOKEN").getValue();
        String accept = "{\"email\":\"" + newEmail + "\",\"displayName\":\"Nina New\",\"password\":\"" + PASSWORD + "\"}";
        MvcResult done = mvc.perform(post("/api/invite/" + token + "/accept").cookie(new Cookie("XSRF-TOKEN", csrf)).header("X-XSRF-TOKEN", csrf)
                        .contentType(MediaType.APPLICATION_JSON).content(accept))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.role").value("ADMIN")).andReturn();
        assertThat(done.getResponse().getCookie("pp_access")).isNotNull();

        // The new person is signed in and can log in normally later
        mvc.perform(get("/api/auth/me").cookie(done.getResponse().getCookie("pp_access"))).andExpect(status().isOk())
                .andExpect(jsonPath("$.displayName").value("Nina New"));

        // A used link is dead
        mvc.perform(post("/api/invite/" + token + "/accept").cookie(new Cookie("XSRF-TOKEN", csrf)).header("X-XSRF-TOKEN", csrf)
                        .contentType(MediaType.APPLICATION_JSON).content(accept.replace(newEmail, email())))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/invite/" + token)).andExpect(status().isNotFound());

        // History shows who invited and who joined
        String audit = mvc.perform(admin.auth(get("/api/admin/audit?size=50"))).andReturn().getResponse().getContentAsString();
        assertThat(audit).contains("INVITATION_CREATED", "INVITATION_ACCEPTED", "Nina New").doesNotContain(token);
        assertThat(invitationId).isNotBlank();

        mvc.perform(admin.auth(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put("/api/admin/settings"))
                .contentType(MediaType.APPLICATION_JSON).content("{\"registrationEnabled\":true}")).andExpect(status().isOk());
    }

    @Test
    void invitationWithPresetEmailIgnoresAnyOtherAddressAndCanBeRevoked() throws Exception {
        String adminEmail = email();
        Client admin = new Client(adminEmail).promoteToAdmin(adminEmail);
        String presetEmail = email();
        MvcResult created = mvc.perform(admin.auth(post("/api/admin/invitations")).contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"" + presetEmail + "\",\"role\":\"USER\",\"expiresInHours\":24}")).andExpect(status().isCreated()).andReturn();
        String token = field(created, "token");

        mvc.perform(get("/api/invite/" + token)).andExpect(jsonPath("$.email").value(presetEmail));

        String csrf = mvc.perform(get("/api/auth/csrf")).andReturn().getResponse().getCookie("XSRF-TOKEN").getValue();
        mvc.perform(post("/api/invite/" + token + "/accept").cookie(new Cookie("XSRF-TOKEN", csrf)).header("X-XSRF-TOKEN", csrf)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email() + "\",\"displayName\":\"X\",\"password\":\"" + PASSWORD + "\"}"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.email").value(presetEmail)).andExpect(jsonPath("$.role").value("USER"));

        // Inviting an address that already has an account is refused; a revoked invitation is dead.
        mvc.perform(admin.auth(post("/api/admin/invitations")).contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"" + presetEmail + "\",\"role\":\"USER\",\"expiresInHours\":24}")).andExpect(status().isConflict());
        MvcResult second = mvc.perform(admin.auth(post("/api/admin/invitations")).contentType(MediaType.APPLICATION_JSON)
                .content("{\"role\":\"USER\",\"expiresInHours\":24}")).andReturn();
        mvc.perform(admin.auth(delete("/api/admin/invitations/" + field(second, "id")))).andExpect(status().isNoContent());
        mvc.perform(get("/api/invite/" + field(second, "token"))).andExpect(status().isNotFound());
    }

    @Test
    void onlyAdminsCanCreateInvitations() throws Exception {
        String email = email();
        Client user = new Client(email).withRole(email, "USER");
        mvc.perform(user.auth(post("/api/admin/invitations")).contentType(MediaType.APPLICATION_JSON)
                .content("{\"role\":\"ADMIN\",\"expiresInHours\":24}")).andExpect(status().isForbidden());
        mvc.perform(user.auth(get("/api/admin/invitations"))).andExpect(status().isForbidden());
    }

    @Test
    void uploadRejectsNonImages() throws Exception {
        Client c = new Client(email());
        MockMultipartFile fake = new MockMultipartFile("file", "x.png", "image/png", "<svg onload=alert(1)>".getBytes());
        mvc.perform(c.auth(multipart("/api/images").file(fake))).andExpect(status().isUnsupportedMediaType());
    }

    private String upload(Client c) throws Exception {
        MockMultipartFile file = new MockMultipartFile("file", "a.png", "image/png", PNG);
        MvcResult r = mvc.perform(c.auth(multipart("/api/images").file(file))).andExpect(status().isCreated()).andReturn();
        return field(r, "id");
    }

    private String field(MvcResult r, String name) throws Exception {
        return field(r, name, 0);
    }

    /** n-th occurrence (0-based) of a string field in the JSON body. */
    private String field(MvcResult r, String name, int n) throws Exception {
        String body = r.getResponse().getContentAsString();
        java.util.regex.Matcher m = java.util.regex.Pattern.compile("\"" + name + "\":\"([^\"]+)\"").matcher(body);
        for (int i = 0; i <= n; i++) {
            assertThat(m.find()).as(body).isTrue();
        }
        return m.group(1);
    }
}
