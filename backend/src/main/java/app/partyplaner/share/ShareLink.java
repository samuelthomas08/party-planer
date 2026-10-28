package app.partyplaner.share;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/** A revocable, optionally expiring link that gives guests read-only access to one place. */
@Entity
@Table(name = "share_links")
public class ShareLink {

    @Id
    private UUID id = UUID.randomUUID();

    @Column(name = "place_id", nullable = false, updatable = false)
    private UUID placeId;

    @Column(name = "created_by", nullable = false, updatable = false)
    private UUID createdBy;

    @Column(nullable = false, unique = true, updatable = false)
    private String token;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "expires_at")
    private Instant expiresAt;

    @Column(name = "revoked_at")
    private Instant revokedAt;

    protected ShareLink() {
    }

    public ShareLink(UUID placeId, UUID createdBy, String token, Instant expiresAt) {
        this.placeId = placeId;
        this.createdBy = createdBy;
        this.token = token;
        this.expiresAt = expiresAt;
    }

    public boolean isActive(Instant now) {
        return revokedAt == null && (expiresAt == null || expiresAt.isAfter(now));
    }

    public void revoke() {
        this.revokedAt = Instant.now();
    }

    public UUID getId() { return id; }
    public UUID getPlaceId() { return placeId; }
    public UUID getCreatedBy() { return createdBy; }
    public String getToken() { return token; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getExpiresAt() { return expiresAt; }
    public Instant getRevokedAt() { return revokedAt; }
}
