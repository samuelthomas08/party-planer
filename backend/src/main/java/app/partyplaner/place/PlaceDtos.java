package app.partyplaner.place;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;

/** Request / response bodies for places and their markers. */
public final class PlaceDtos {

    private PlaceDtos() {
    }

    public record PlacementRequest(
            UUID id,
            @NotNull @DecimalMin("0.0") @DecimalMax("1.0") Double x,
            @NotNull @DecimalMin("0.0") @DecimalMax("1.0") Double y,
            UUID equipmentId,
            @NotNull @Pattern(regexp = "^#[0-9a-fA-F]{6}$", message = "COLOR_INVALID") String color) {
    }

    public record PlaceRequest(
            @NotBlank @Size(max = 120) String name,
            @NotNull UUID folderId,
            @NotNull UUID floorPlanImageId,
            @NotNull @Size(max = 200) List<@Valid PlacementRequest> placements) {
    }

    public record PlacementResponse(UUID id, double x, double y, UUID equipmentId, String color) {

        public static PlacementResponse of(Placement p) {
            return new PlacementResponse(p.getId(), p.getX(), p.getY(), p.getEquipmentId(), p.getColor());
        }
    }

    public record PlaceResponse(UUID id, String name, UUID folderId, UUID floorPlanImageId, List<PlacementResponse> placements) {

        public static PlaceResponse of(Place p) {
            return new PlaceResponse(p.getId(), p.getName(), p.getFolderId(), p.getFloorPlanImageId(),
                    p.getPlacements().stream().map(PlacementResponse::of).toList());
        }
    }

    public record PlaceSummary(UUID id, String name, UUID folderId, UUID floorPlanImageId) {

        public static PlaceSummary of(Place p) {
            return new PlaceSummary(p.getId(), p.getName(), p.getFolderId(), p.getFloorPlanImageId());
        }
    }
}
