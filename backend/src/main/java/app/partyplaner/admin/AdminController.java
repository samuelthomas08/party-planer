package app.partyplaner.admin;

import app.partyplaner.admin.AdminUserService.UserAdminResponse;
import app.partyplaner.audit.AuditDtos.AuditEntry;
import app.partyplaner.audit.AuditDtos.PageResponse;
import app.partyplaner.audit.AuditService;
import app.partyplaner.audit.Change;
import app.partyplaner.common.CurrentUser;
import app.partyplaner.folder.Folder;
import app.partyplaner.folder.FolderRepository;
import app.partyplaner.place.Place;
import app.partyplaner.place.PlaceRepository;
import app.partyplaner.user.Role;
import app.partyplaner.user.User;
import app.partyplaner.user.UserRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Everything under /api/admin requires the ADMIN role (enforced in SecurityConfig). */
@RestController
@RequestMapping("/api/admin")
public class AdminController {

    /** Body for creating a user directly (as opposed to inviting them). */
    public record CreateUserRequest(@NotBlank @Email @Size(max = 254) String email, @NotBlank @Size(max = 80) String displayName,
                                    @NotBlank @Size(min = 10, max = 128, message = "PASSWORD_LENGTH") String password,
                                    @NotNull Role role) {
    }

    /** Partial update: only non-null fields are applied. */
    public record UpdateUserRequest(Role role, Boolean enabled, @Size(max = 80) String displayName) {
    }

    /** Body for an admin password reset. */
    public record PasswordRequest(@NotBlank @Size(min = 10, max = 128, message = "PASSWORD_LENGTH") String password) {
    }

    /** Runtime system settings. */
    public record SettingsResponse(boolean registrationEnabled) {
    }

    /** A place with its owner, for the admin place filter. */
    public record AdminPlace(UUID id, String name, String folderName, String ownerName) {
    }

    private final AdminUserService userService;
    private final SettingsService settings;
    private final AuditService audit;
    private final PlaceRepository places;
    private final FolderRepository folders;
    private final UserRepository users;

    public AdminController(AdminUserService userService, SettingsService settings, AuditService audit,
                           PlaceRepository places, FolderRepository folders, UserRepository users) {
        this.userService = userService;
        this.settings = settings;
        this.audit = audit;
        this.places = places;
        this.folders = folders;
        this.users = users;
    }

    /** Lists all accounts with their usage counts. */
    @GetMapping("/users")
    List<UserAdminResponse> users() {
        return userService.list();
    }

    /** Creates an account with a given password and role. */
    @PostMapping("/users")
    @ResponseStatus(HttpStatus.CREATED)
    UserAdminResponse createUser(@Valid @RequestBody CreateUserRequest body) {
        return userService.create(body.email(), body.displayName(), body.password(), body.role());
    }

    /** Changes role, enabled state or display name of a user. */
    @PatchMapping("/users/{id}")
    UserAdminResponse updateUser(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id, @Valid @RequestBody UpdateUserRequest body) {
        return userService.update(CurrentUser.id(jwt), id, body.role(), body.enabled(), body.displayName());
    }

    /** Sets a new password and ends all of the user's sessions. */
    @PostMapping("/users/{id}/password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void resetPassword(@PathVariable UUID id, @Valid @RequestBody PasswordRequest body) {
        userService.resetPassword(id, body.password());
    }

    /** Clears a lockout caused by failed logins. */
    @PostMapping("/users/{id}/unlock")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void unlock(@PathVariable UUID id) {
        userService.unlock(id);
    }

    /** Deletes a user together with all their data. */
    @DeleteMapping("/users/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void deleteUser(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        userService.delete(CurrentUser.id(jwt), id);
    }

    /** Reads the runtime settings. */
    @GetMapping("/settings")
    SettingsResponse settings() {
        return new SettingsResponse(settings.registrationEnabled());
    }

    /** Changes the runtime settings and records the change in the audit log. */
    @PutMapping("/settings")
    SettingsResponse updateSettings(@RequestBody SettingsResponse body) {
        boolean old = settings.registrationEnabled();
        settings.setRegistrationEnabled(body.registrationEnabled());
        if (old != body.registrationEnabled()) {
            audit.record("SETTINGS_CHANGED", "SYSTEM", null, "registration", null, null,
                    List.of(Change.of("REGISTRATION", Boolean.toString(old), Boolean.toString(body.registrationEnabled()))));
        }
        return new SettingsResponse(settings.registrationEnabled());
    }

    /** The complete change history across all places and users; optionally narrowed to one place. */
    @GetMapping("/audit")
    PageResponse<AuditEntry> audit(@RequestParam(required = false) UUID placeId, @RequestParam(defaultValue = "0") int page,
                                   @RequestParam(defaultValue = "30") int size) {
        return audit.page(placeId, page, size, true);
    }

    /** Lists every place of every user (for filtering the audit log). */
    @GetMapping("/places")
    List<AdminPlace> allPlaces() {
        Map<UUID, String> userNames = new HashMap<>();
        users.findAll().forEach((User u) -> userNames.put(u.getId(), u.getDisplayName()));
        Map<UUID, String> folderNames = new HashMap<>();
        folders.findAll().forEach((Folder f) -> folderNames.put(f.getId(), f.getName()));
        return places.findAllByOrderByNameAsc().stream()
                .map((Place p) -> new AdminPlace(p.getId(), p.getName(), folderNames.get(p.getFolderId()), userNames.get(p.getOwnerId())))
                .toList();
    }
}
