package app.partyplaner.share;

import app.partyplaner.auth.AuthCookies;
import app.partyplaner.common.CurrentUser;
import app.partyplaner.share.ShareDtos.CreateShareRequest;
import app.partyplaner.share.ShareDtos.GuestJoinRequest;
import app.partyplaner.share.ShareDtos.GuestSession;
import app.partyplaner.share.ShareDtos.ShareResponse;
import app.partyplaner.share.ShareDtos.SharePreview;
import jakarta.validation.Valid;
import java.time.Duration;
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
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Owner endpoints to manage a place's share links, the public endpoints to preview a link and join as guest. */
@RestController
public class ShareController {

    private final ShareService shares;
    private final AuthCookies cookies;

    public ShareController(ShareService shares, AuthCookies cookies) {
        this.shares = shares;
        this.cookies = cookies;
    }

    // ---- owner: manage links of a place ---------------------------------------------------------------------

    /** The share links of a place (owner only). */
    @GetMapping("/api/places/{placeId}/shares")
    List<ShareResponse> list(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID placeId) {
        return shares.list(CurrentUser.id(jwt), placeId);
    }

    /** Creates a link. */
    @PostMapping("/api/places/{placeId}/shares")
    @ResponseStatus(HttpStatus.CREATED)
    ShareResponse create(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID placeId, @Valid @RequestBody CreateShareRequest body) {
        return shares.create(CurrentUser.id(jwt), placeId, body.expiresInHours());
    }

    /** Revokes a link; guests using it lose access immediately. */
    @DeleteMapping("/api/places/{placeId}/shares/{shareId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void revoke(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID placeId, @PathVariable UUID shareId) {
        shares.revoke(CurrentUser.id(jwt), placeId, shareId);
    }

    // ---- public: the link itself ----------------------------------------------------------------------------

    /** Public: name of the shared place and who shared it. */
    @GetMapping("/api/share/{token}")
    SharePreview preview(@PathVariable String token) {
        return shares.preview(token);
    }

    /** Public: starts a guest session (cookie) for the linked place. */
    @PostMapping("/api/share/{token}/guest")
    ResponseEntity<GuestSession> join(@PathVariable String token, @Valid @RequestBody GuestJoinRequest body) {
        ShareService.Joined joined = shares.joinAsGuest(token, body.name());
        Duration ttl = Duration.between(Instant.now(), joined.expiresAt());
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, cookies.guest(joined.guestToken(), ttl).toString())
                .body(new GuestSession(joined.name(), joined.placeId()));
    }

    // ---- guest: leave -----------------------------------------------------------------------------------------

    /** Ends the guest session. */
    @PostMapping("/api/guest/logout")
    ResponseEntity<Void> leave() {
        return ResponseEntity.noContent().header(HttpHeaders.SET_COOKIE, cookies.clearGuest().toString()).build();
    }
}
