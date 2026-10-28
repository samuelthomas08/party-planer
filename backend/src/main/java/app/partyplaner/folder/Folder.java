package app.partyplaner.folder;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/** A folder that groups places. */
@Entity
@Table(name = "folders")
public class Folder {

    @Id
    private UUID id = UUID.randomUUID();

    @Column(name = "owner_id", nullable = false, updatable = false)
    private UUID ownerId;

    @Column(nullable = false)
    private String name;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    protected Folder() {
    }

    public Folder(UUID ownerId, String name) {
        this.ownerId = ownerId;
        this.name = name;
    }

    public UUID getId() { return id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
}
