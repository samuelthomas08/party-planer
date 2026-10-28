package app.partyplaner.image;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/**
 * Metadata of an uploaded image. The bytes live on disk (see {@link ImageStorage}); this row only references them
 * through {@code storageKey}.
 */
@Entity
@Table(name = "images")
public class Image {

    @Id
    private UUID id = UUID.randomUUID();

    @Column(name = "owner_id", nullable = false, updatable = false)
    private UUID ownerId;

    @Column(name = "content_type", nullable = false, updatable = false)
    private String contentType;

    @Column(name = "size_bytes", nullable = false, updatable = false)
    private int sizeBytes;

    /** Path of the file below the storage root, e.g. "ab/ab12….png". Never derived from user input. */
    @Column(name = "storage_key", updatable = false)
    private String storageKey;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    protected Image() {
    }

    public Image(UUID id, UUID ownerId, String contentType, int sizeBytes, String storageKey) {
        this.id = id;
        this.ownerId = ownerId;
        this.contentType = contentType;
        this.sizeBytes = sizeBytes;
        this.storageKey = storageKey;
    }

    public UUID getId() { return id; }
    public String getContentType() { return contentType; }
    public int getSizeBytes() { return sizeBytes; }
    public String getStorageKey() { return storageKey; }
}
