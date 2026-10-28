package app.partyplaner.place;

import static org.assertj.core.api.Assertions.assertThat;

import app.partyplaner.place.Place.MarkerData;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** The marker reconciliation inside {@link Place#update}: identity must survive edits. */
class PlaceMarkersTest {

    private static final UUID OWNER = UUID.randomUUID();
    private static final UUID FOLDER = UUID.randomUUID();
    private static final UUID IMAGE = UUID.randomUUID();

    private Place placeWith(MarkerData... markers) {
        Place place = new Place(OWNER);
        place.update("P", FOLDER, IMAGE, List.of(markers));
        return place;
    }

    private static MarkerData fresh(double x) {
        return new MarkerData(null, null, x, 0.5, "#000000");
    }

    @Test
    void newMarkersGetFreshIds() {
        Place place = placeWith(fresh(0.1), fresh(0.2));

        assertThat(place.getPlacements()).hasSize(2);
        assertThat(place.getPlacements().get(0).getId()).isNotEqualTo(place.getPlacements().get(1).getId());
    }

    @Test
    void knownIdsKeepTheirIdentityAndTakeTheNewValues() {
        Place place = placeWith(fresh(0.1));
        Placement original = place.getPlacements().get(0);
        UUID equipment = UUID.randomUUID();

        place.update("P", FOLDER, IMAGE, List.of(new MarkerData(original.getId(), equipment, 0.9, 0.8, "#ffffff")));

        assertThat(place.getPlacements()).hasSize(1);
        Placement kept = place.getPlacements().get(0);
        assertThat(kept).isSameAs(original);
        assertThat(kept.getX()).isEqualTo(0.9);
        assertThat(kept.getY()).isEqualTo(0.8);
        assertThat(kept.getColor()).isEqualTo("#ffffff");
        assertThat(kept.getEquipmentId()).isEqualTo(equipment);
    }

    @Test
    void markersMissingFromTheRequestAreRemoved() {
        Place place = placeWith(fresh(0.1), fresh(0.2));
        Placement keep = place.getPlacements().get(0);

        place.update("P", FOLDER, IMAGE, List.of(new MarkerData(keep.getId(), null, 0.1, 0.5, "#000000")));

        assertThat(place.getPlacements()).containsExactly(keep);
    }

    @Test
    void unknownIdsAreTreatedAsNewMarkersInsteadOfTrustingTheClient() {
        Place place = placeWith(fresh(0.1));
        UUID invented = UUID.randomUUID();

        place.update("P", FOLDER, IMAGE, List.of(new MarkerData(invented, null, 0.3, 0.3, "#000000")));

        assertThat(place.getPlacements()).hasSize(1);
        assertThat(place.getPlacements().get(0).getId()).isNotEqualTo(invented);
    }

    @Test
    void aDuplicatedIdIsOnlyReusedOnce() {
        Place place = placeWith(fresh(0.1));
        UUID id = place.getPlacements().get(0).getId();

        place.update("P", FOLDER, IMAGE, List.of(new MarkerData(id, null, 0.1, 0.1, "#000000"), new MarkerData(id, null, 0.7, 0.7, "#000000")));

        assertThat(place.getPlacements()).hasSize(2);
        assertThat(place.getPlacements()).extracting(Placement::getId).doesNotHaveDuplicates();
    }

    @Test
    void theOrderOfTheRequestIsTheOrderOfTheMarkers() {
        Place place = placeWith(fresh(0.1), fresh(0.2));
        Placement first = place.getPlacements().get(0);
        Placement second = place.getPlacements().get(1);

        place.update("P", FOLDER, IMAGE, List.of(
                new MarkerData(second.getId(), null, 0.2, 0.5, "#000000"),
                new MarkerData(first.getId(), null, 0.1, 0.5, "#000000")));

        assertThat(place.getPlacements()).containsExactly(second, first);
    }

    @Test
    void updatesNameFolderAndImage() {
        Place place = placeWith();
        UUID newFolder = UUID.randomUUID();
        UUID newImage = UUID.randomUUID();

        place.update("Renamed", newFolder, newImage, List.of());

        assertThat(place.getName()).isEqualTo("Renamed");
        assertThat(place.getFolderId()).isEqualTo(newFolder);
        assertThat(place.getFloorPlanImageId()).isEqualTo(newImage);
    }
}
