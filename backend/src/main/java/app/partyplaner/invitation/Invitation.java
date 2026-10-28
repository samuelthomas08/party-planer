package app.partyplaner.invitation;

import app.partyplaner.user.Role;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/** A one-time invitation to create an account. Only the token's SHA-256 hash is stored. */
@Entity
@Table(name = "invitations")
public class Invitation {

    @Id
    private UUID id = UUID.randomUUID();

    @Column(name = "token_hash", nullable = false, unique = true, updatable = false)
    private String tokenHash;

    @Column(updatable = false)
    private String email;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, updatable = false)
    private Role role;

    @Column(name = "created_by", nullable = false, updatable = false)
    private UUID createdBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "expires_at", nullable = false, updatable = false)
    private Instant expiresAt;

    @Column(name = "used_at")
    private Instant usedAt;

    @Column(name = "used_by")
    private UUID usedBy;

    @Column(name = "revoked_at")
    private Instant revokedAt;

    protected Invitation() {
    }

    public Invitation(String tokenHash, String email, Role role, UUID createdBy, Instant expiresAt) {
        this.tokenHash = tokenHash;
        this.email = email;
        this.role = role;
        this.createdBy = createdBy;
        this.expiresAt = expiresAt;
    }

    public enum Status { PENDING, USED, REVOKED, EXPIRED }

    public Status status(Instant now) {
        if (usedAt != null) return Status.USED;
        if (revokedAt != null) return Status.REVOKED;
        return expiresAt.isAfter(now) ? Status.PENDING : Status.EXPIRED;
    }

    public void markUsed(UUID userId) {
        this.usedAt = Instant.now();
        this.usedBy = userId;
    }

    public void revoke() {
        this.revokedAt = Instant.now();
    }

    public UUID getId() { return id; }
    public String getEmail() { return email; }
    public Role getRole() { return role; }
    public UUID getCreatedBy() { return createdBy; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getExpiresAt() { return expiresAt; }
    public Instant getUsedAt() { return usedAt; }
}
