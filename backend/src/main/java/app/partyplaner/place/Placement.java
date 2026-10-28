package app.partyplaner.place;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.UUID;

/** A marker on a floor plan: relative position (0..1 of image width / height), colour and assigned equipment. */
@Entity
@Table(name = "placements")
public class Placement {

    @Id
    private UUID id = UUID.randomUUID();

    @Column(name = "equipment_id")
    private UUID equipmentId;

    @Column(nullable = false)
    private double x;

    @Column(nullable = false)
    private double y;

    @Column(nullable = false)
    private String color;

    protected Placement() {
    }

    public Placement(UUID id, UUID equipmentId, double x, double y, String color) {
        if (id != null) {
            this.id = id;
        }
        this.equipmentId = equipmentId;
        this.x = x;
        this.y = y;
        this.color = color;
    }

    public void update(UUID equipmentId, double x, double y, String color) {
        this.equipmentId = equipmentId;
        this.x = x;
        this.y = y;
        this.color = color;
    }

    public UUID getId() { return id; }
    public UUID getEquipmentId() { return equipmentId; }
    public double getX() { return x; }
    public double getY() { return y; }
    public String getColor() { return color; }
}
