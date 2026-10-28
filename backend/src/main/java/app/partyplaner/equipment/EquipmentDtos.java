package app.partyplaner.equipment;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.Map;
import java.util.UUID;

/** Request / response bodies for equipment. */
public final class EquipmentDtos {

    private EquipmentDtos() {
    }

    public record EquipmentRequest(
            @NotBlank @Size(max = 120) String title,
            @Size(max = 4000) String description,
            @NotNull EquipmentCategory category,
            @NotNull Map<EquipmentSlot, UUID> images) {
    }

    public record EquipmentResponse(
            UUID id, String title, String description, EquipmentCategory category, Map<EquipmentSlot, UUID> images) {

        public static EquipmentResponse of(Equipment e) {
            return new EquipmentResponse(e.getId(), e.getTitle(), e.getDescription(), e.getCategory(), Map.copyOf(e.getImages()));
        }
    }
}
