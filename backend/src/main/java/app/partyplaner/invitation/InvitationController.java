package app.partyplaner.invitation;

import app.partyplaner.auth.AuthCookies;
import app.partyplaner.auth.AuthDtos.UserResponse;
import app.partyplaner.common.CurrentUser;
import app.partyplaner.user.Role;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Admin endpoints to create, list and revoke invitations, and the public endpoints to preview and accept one. */
@RestController
public class InvitationController {

    /** Body for creating an invitation. */
    public record CreateRequest(@Email @Size(max = 254) String email, @NotNull Role role, @Min(1) @Max(24 * 30) int expiresInHours) {
    }

    /** {@code token} is only filled in the response to creation: it cannot be retrieved afterwards. */
    public record InvitationResponse(UUID id, String token, String email, Role role, String status, Instant createdAt, Instant expiresAt) {
    /** Maps an invitation; {@code token} is only set right after creation. */
        static InvitationResponse of(Invitation i, String token) {
            return new InvitationResponse(i.getId(), token, i.getEmail(), i.getRole(), i.status(Instant.now()).name(), i.getCreatedAt(), i.getExpiresAt());
        }
    }

    /** Body of the form the invited person fills in. */
    public record AcceptRequest(@Email @Size(max = 254) String email, @NotBlank @Size(max = 80) String displayName,
                                @NotBlank @Size(min = 10, max = 128, message = "PASSWORD_LENGTH") String password) {
    }

    private final InvitationService invitations;
    private final AuthCookies cookies;

    public InvitationController(InvitationService invitations, AuthCookies cookies) {
        this.invitations = invitations;
        this.cookies = cookies;
    }

    // ---- admin ----------------------------------------------------------------------------------------------

    /** Creates an invitation and returns its link token (once). */
    @PostMapping("/api/admin/invitations")
    @ResponseStatus(HttpStatus.CREATED)
    InvitationResponse create(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody CreateRequest body) {
        InvitationService.Created created = invitations.create(CurrentUser.id(jwt), body.email(), body.role(), body.expiresInHours());
        return InvitationResponse.of(created.invitation(), created.token());
    }

    /** The latest invitations with their status. */
    @GetMapping("/api/admin/invitations")
    List<InvitationResponse> list() {
        return invitations.list().stream().map(i -> InvitationResponse.of(i, null)).toList();
    }

    /** Revokes a pending invitation. */
    @DeleteMapping("/api/admin/invitations/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void revoke(@PathVariable UUID id) {
        invitations.revoke(id);
    }

    // ---- public: the link itself ----------------------------------------------------------------------------

    /** Public: who invited you, and whether the e-mail is fixed. */
    @GetMapping("/api/invite/{token}")
    InvitationService.Preview preview(@PathVariable String token) {
        return invitations.preview(token);
    }

    /** Public: creates the account, signs the person in and burns the invitation. */
    @PostMapping("/api/invite/{token}/accept")
    ResponseEntity<UserResponse> accept(@PathVariable String token, @Valid @RequestBody AcceptRequest body) {
        var session = invitations.accept(token, body.email(), body.displayName(), body.password());
        var user = session.user();
        return ResponseEntity.status(HttpStatus.CREATED)
                .header(HttpHeaders.SET_COOKIE, cookies.access(session.accessToken()).toString())
                .header(HttpHeaders.SET_COOKIE, cookies.refresh(session.refreshToken()).toString())
                .body(new UserResponse(user.getId(), user.getEmail(), user.getDisplayName(), user.getRole().name()));
    }
}
