package app.partyplaner.equipment;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.MapKeyColumn;
import jakarta.persistence.MapKeyEnumerated;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.EnumMap;
import java.util.Map;
import java.util.UUID;
import org.hibernate.annotations.BatchSize;

/**
 * A piece of equipment (a lighting stand made of part images, or any other item with one photo).
 * Images are stored as references (slot to image id).
 */
@Entity
@Table(name = "equipment")
public class Equipment {

    @Id
    private UUID id = UUID.randomUUID();

    @Column(name = "owner_id", nullable = false, updatable = false)
    private UUID ownerId;

    @Column(nullable = false)
    private String title;

    @Column(nullable = false)
    private String description = "";

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private EquipmentCategory category;

    @ElementCollection
    @CollectionTable(name = "equipment_images", joinColumns = @JoinColumn(name = "equipment_id"))
    @MapKeyColumn(name = "slot")
    @MapKeyEnumerated(EnumType.STRING)
    @Column(name = "image_id", nullable = false)
    @BatchSize(size = 100)
    private Map<EquipmentSlot, UUID> images = new EnumMap<>(EquipmentSlot.class);

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    protected Equipment() {
    }

    public Equipment(UUID ownerId) {
        this.ownerId = ownerId;
    }

    public void update(String title, String description, EquipmentCategory category, Map<EquipmentSlot, UUID> newImages) {
        this.title = title;
        this.description = description;
        this.category = category;
        this.images.keySet().retainAll(newImages.keySet());
        this.images.putAll(newImages);
        this.updatedAt = Instant.now();
    }

    public UUID getId() { return id; }
    public String getTitle() { return title; }
    public String getDescription() { return description; }
    public EquipmentCategory getCategory() { return category; }
    public Map<EquipmentSlot, UUID> getImages() { return images; }
}
