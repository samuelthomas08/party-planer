package app.partyplaner.folder;

import app.partyplaner.place.PlaceDtos.PlaceSummary;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;

/** Request / response bodies for folders. */
public final class FolderDtos {

    private FolderDtos() {
    }

    public record FolderRequest(@NotBlank @Size(max = 100) String name) {
    }

    public record FolderResponse(UUID id, String name, List<PlaceSummary> places) {
    }
}
