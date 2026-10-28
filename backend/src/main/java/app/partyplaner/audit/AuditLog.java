package app.partyplaner.audit;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/**
 * One permanent history entry: who ({@code actor}) did what ({@code action}) to which entity, when, where
 * ({@code place}) and how ({@code changes}).
 * <p>There are intentionally no foreign keys, so the history survives the deletion of users, places and equipment.
 */
@Entity
@Table(name = "audit_log")
public class AuditLog {

    @Id
    private UUID id = UUID.randomUUID();

    @Column(nullable = false)
    private Instant at = Instant.now();

    @Column(name = "actor_id")
    private UUID actorId;

    @Column(name = "actor_name", nullable = false)
    private String actorName;

    @Column(name = "actor_type", nullable = false)
    private String actorType;

    @Column(nullable = false)
    private String action;

    @Column(name = "entity_type", nullable = false)
    private String entityType;

    @Column(name = "entity_id")
    private UUID entityId;

    @Column(name = "entity_name")
    private String entityName;

    @Column(name = "place_id")
    private UUID placeId;

    @Column(name = "place_name")
    private String placeName;

    @Column(nullable = false)
    private String changes;

    private String ip;

    protected AuditLog() {
    }

    public AuditLog(Actor actor, String action, String entityType, UUID entityId, String entityName,
                    UUID placeId, String placeName, String changesJson, String ip) {
        this.actorId = actor.id();
        this.actorName = actor.name();
        this.actorType = actor.type();
        this.action = action;
        this.entityType = entityType;
        this.entityId = entityId;
        this.entityName = entityName;
        this.placeId = placeId;
        this.placeName = placeName;
        this.changes = changesJson;
        this.ip = ip;
    }

    public UUID getId() { return id; }
    public Instant getAt() { return at; }
    public UUID getActorId() { return actorId; }
    public String getActorName() { return actorName; }
    public String getActorType() { return actorType; }
    public String getAction() { return action; }
    public String getEntityType() { return entityType; }
    public UUID getEntityId() { return entityId; }
    public String getEntityName() { return entityName; }
    public UUID getPlaceId() { return placeId; }
    public String getPlaceName() { return placeName; }
    public String getChanges() { return changes; }
    public String getIp() { return ip; }
}
