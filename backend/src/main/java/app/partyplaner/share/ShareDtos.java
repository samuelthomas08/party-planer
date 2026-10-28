package app.partyplaner.share;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.UUID;

/** Request / response bodies for sharing. */
public final class ShareDtos {

    private ShareDtos() {
    }

    /** {@code expiresInHours == null} means the link never expires (until revoked). */
    public record CreateShareRequest(@Min(1) @Max(24 * 365) Integer expiresInHours) {
    }

    public record ShareResponse(UUID id, String token, Instant createdAt, Instant expiresAt, Instant revokedAt, boolean active) {
        static ShareResponse of(ShareLink l) {
            return new ShareResponse(l.getId(), l.getToken(), l.getCreatedAt(), l.getExpiresAt(), l.getRevokedAt(),
                    l.isActive(Instant.now()));
        }
    }

    public record SharePreview(String placeName, String sharedBy, Instant expiresAt) {
    }

    public record GuestJoinRequest(@NotBlank @Size(max = 60) String name) {
    }

    public record GuestSession(String name, UUID placeId) {
    }
}
