package app.partyplaner.place;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * A venue: a floor-plan image plus the markers placed on it. Markers keep stable ids across edits so the
 * history can describe exactly what happened to each one.
 */
@Entity
@Table(name = "places")
public class Place {

    @Id
    private UUID id = UUID.randomUUID();

    @Column(name = "owner_id", nullable = false, updatable = false)
    private UUID ownerId;

    @Column(name = "folder_id", nullable = false)
    private UUID folderId;

    @Column(nullable = false)
    private String name;

    @Column(name = "floor_plan_image_id")
    private UUID floorPlanImageId;

    @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderColumn(name = "position")
    @JoinColumn(name = "place_id", nullable = false)
    private List<Placement> placements = new ArrayList<>();

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    protected Place() {
    }

    public Place(UUID ownerId) {
        this.ownerId = ownerId;
    }

    /** Desired state of one marker. A known {@code id} keeps the marker's identity (so history can follow it). */
    public record MarkerData(UUID id, UUID equipmentId, double x, double y, String color) {
    }

    public void update(String name, UUID folderId, UUID floorPlanImageId, List<MarkerData> markers) {
        this.name = name;
        this.folderId = folderId;
        this.floorPlanImageId = floorPlanImageId;
        java.util.Map<UUID, Placement> existing = new java.util.HashMap<>();
        placements.forEach(p -> existing.put(p.getId(), p));
        java.util.Set<UUID> reused = new java.util.HashSet<>();
        List<Placement> result = new ArrayList<>();
        for (MarkerData m : markers) {
            Placement current = m.id() != null && existing.containsKey(m.id()) && reused.add(m.id()) ? existing.get(m.id()) : null;
            if (current == null) {
                result.add(new Placement(null, m.equipmentId(), m.x(), m.y(), m.color()));
            } else {
                current.update(m.equipmentId(), m.x(), m.y(), m.color());
                result.add(current);
            }
        }
        placements.clear();
        placements.addAll(result);
        this.updatedAt = Instant.now();
    }

    public UUID getId() { return id; }
    public UUID getOwnerId() { return ownerId; }
    public UUID getFolderId() { return folderId; }
    public String getName() { return name; }
    public UUID getFloorPlanImageId() { return floorPlanImageId; }
    public List<Placement> getPlacements() { return placements; }
}
