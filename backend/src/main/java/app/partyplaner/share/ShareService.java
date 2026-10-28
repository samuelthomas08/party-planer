package app.partyplaner.share;

import app.partyplaner.audit.Actor;
import app.partyplaner.audit.AuditService;
import app.partyplaner.audit.Change;
import app.partyplaner.auth.JwtService;
import app.partyplaner.common.ApiException;
import app.partyplaner.place.Place;
import app.partyplaner.place.PlaceRepository;
import app.partyplaner.place.PlaceService;
import app.partyplaner.share.ShareDtos.ShareResponse;
import app.partyplaner.user.UserRepository;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Share-link use cases and guest sessions. A guest token names exactly one place; every guest request
 * re-checks that the link is still active, so revoking a link ends guest sessions at once.
 */
@Service
public class ShareService {

    private static final Logger log = LoggerFactory.getLogger(ShareService.class);
    static final Duration GUEST_SESSION_MAX = Duration.ofHours(8);

    private final ShareLinkRepository links;
    private final PlaceService placeService;
    private final PlaceRepository places;
    private final UserRepository users;
    private final JwtService jwt;
    private final AuditService audit;
    private final SecureRandom random = new SecureRandom();

    public ShareService(ShareLinkRepository links, PlaceService placeService, PlaceRepository places, UserRepository users,
                        JwtService jwt, AuditService audit) {
        this.links = links;
        this.placeService = placeService;
        this.places = places;
        this.users = users;
        this.jwt = jwt;
        this.audit = audit;
    }

    /** Result of joining as a guest. */
    public record Joined(String guestToken, Instant expiresAt, String name, UUID placeId) {
    }

    /** All links of a place. */
    @Transactional(readOnly = true)
    public List<ShareResponse> list(UUID ownerId, UUID placeId) {
        placeService.requireOwned(ownerId, placeId);
        return links.findByPlaceIdOrderByCreatedAtDesc(placeId).stream().map(ShareResponse::of).toList();
    }

    /** Creates a link, optionally expiring. */
    @Transactional
    public ShareResponse create(UUID ownerId, UUID placeId, Integer expiresInHours) {
        Place place = placeService.requireOwned(ownerId, placeId);
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        Instant expires = expiresInHours == null ? null : Instant.now().plus(Duration.ofHours(expiresInHours));
        ShareLink link = links.save(new ShareLink(placeId, ownerId, token, expires));
        // The token itself is a credential and is never written to the log.
        log.info("SHARE_CREATED owner={} place={} share={} expires={}", ownerId, placeId, link.getId(), expires);
        audit.record("SHARE_CREATED", "SHARE", link.getId(), place.getName(), placeId, place.getName(),
                List.of(Change.of("EXPIRES", null, expires == null ? null : expires.toString())));
        return ShareResponse.of(link);
    }

    /** Revokes a link. */
    @Transactional
    public void revoke(UUID ownerId, UUID placeId, UUID shareId) {
        Place place = placeService.requireOwned(ownerId, placeId);
        ShareLink link = links.findByIdAndPlaceId(shareId, placeId).orElseThrow(() -> ApiException.notFound("Share link"));
        if (link.getRevokedAt() == null) {
            link.revoke();
            log.info("SHARE_REVOKED owner={} place={} share={}", ownerId, placeId, shareId);
            audit.record("SHARE_REVOKED", "SHARE", shareId, place.getName(), placeId, place.getName(), List.of());
        }
    }

    /** Public: what a visitor sees before choosing to join as a guest. */
    @Transactional(readOnly = true)
    public ShareDtos.SharePreview preview(String token) {
        ShareLink link = activeLink(token);
        Place place = places.findById(link.getPlaceId()).orElseThrow(() -> ApiException.notFound("Share link"));
        String by = users.findById(link.getCreatedBy()).map(u -> u.getDisplayName()).orElse("");
        log.info("SHARE_PREVIEW share={} place={}", link.getId(), place.getId());
        return new ShareDtos.SharePreview(place.getName(), by, link.getExpiresAt());
    }

    /** Starts a guest session and records it in the place's history. */
    @Transactional
    public Joined joinAsGuest(String token, String name) {
        ShareLink link = activeLink(token);
        Place place = places.findById(link.getPlaceId()).orElseThrow(() -> ApiException.notFound("Share link"));
        UUID guestId = UUID.randomUUID();
        String cleanName = name.replaceAll("[\\p{Cntrl}]", " ").trim();
        Instant expires = Instant.now().plus(GUEST_SESSION_MAX);
        if (link.getExpiresAt() != null && link.getExpiresAt().isBefore(expires)) {
            expires = link.getExpiresAt();
        }
        log.info("GUEST_JOINED share={} place={} guest={}", link.getId(), place.getId(), guestId);
        audit.record(new Actor(guestId, cleanName, "GUEST"), "GUEST_JOINED", "SHARE", link.getId(), place.getName(),
                place.getId(), place.getName(), List.of());
        return new Joined(jwt.issueGuestToken(guestId, cleanName, link.getId(), place.getId(), expires), expires, cleanName, place.getId());
    }

    /** Used by every guest request, so revoking a link cuts off guests immediately. */
    @Transactional(readOnly = true)
    public ShareLink requireActiveById(UUID shareId, UUID placeId) {
        ShareLink link = links.findById(shareId).filter(l -> l.getPlaceId().equals(placeId) && l.isActive(Instant.now()))
                .orElseThrow(() -> {
                    log.info("GUEST_REJECTED share={} reason=revoked-or-expired", shareId);
                    return new ApiException(org.springframework.http.HttpStatus.UNAUTHORIZED, "SHARE_INVALID", "This link is no longer valid");
                });
        return link;
    }

    private ShareLink activeLink(String token) {
        return links.findByToken(token).filter(l -> l.isActive(Instant.now())).orElseThrow(() -> {
            log.info("SHARE_REJECTED reason=unknown-revoked-or-expired");
            return new ApiException(org.springframework.http.HttpStatus.NOT_FOUND, "SHARE_INVALID", "This link is not valid");
        });
    }
}
