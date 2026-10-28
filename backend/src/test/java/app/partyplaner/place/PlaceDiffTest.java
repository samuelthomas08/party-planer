package app.partyplaner.place;

import static org.assertj.core.api.Assertions.assertThat;

import app.partyplaner.audit.Change;
import app.partyplaner.place.PlaceDiff.Marker;
import app.partyplaner.place.PlaceDiff.Snapshot;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class PlaceDiffTest {

    static final UUID FOLDER_A = UUID.randomUUID();
    static final UUID FOLDER_B = UUID.randomUUID();
    static final UUID IMG = UUID.randomUUID();
    static final UUID EQ1 = UUID.randomUUID();
    static final UUID EQ2 = UUID.randomUUID();
    static final Map<UUID, String> FOLDERS = Map.of(FOLDER_A, "Hall", FOLDER_B, "Garden");
    static final Map<UUID, String> TITLES = Map.of(EQ1, "Truss", EQ2, "Spot");

    static Marker marker(UUID id, UUID eq, double x, double y, String color) {
        return new Marker(id, eq, x, y, color);
    }

    static Snapshot snap(String name, UUID folder, UUID image, Marker... markers) {
        return new Snapshot(name, folder, image, List.of(markers));
    }

    static List<Change> diff(Snapshot before, Snapshot after) {
        return PlaceDiff.between(before, after, FOLDERS::get, id -> id == null ? null : TITLES.get(id));
    }

    @Test
    void reportsNothingWhenNothingChanged() {
        UUID m = UUID.randomUUID();
        Snapshot s = snap("Main", FOLDER_A, IMG, marker(m, EQ1, 0.1, 0.2, "#112233"));
        assertThat(diff(s, s)).isEmpty();
    }

    @Test
    void reportsRenameFolderMoveAndNewFloorPlan() {
        Snapshot before = snap("Main", FOLDER_A, IMG);
        Snapshot after = snap("Main hall", FOLDER_B, UUID.randomUUID());

        assertThat(diff(before, after)).containsExactly(
                Change.of("NAME", "Main", "Main hall"),
                Change.of("FOLDER", "Hall", "Garden"),
                Change.of("FLOOR_PLAN_REPLACED"));
    }

    @Test
    void reportsAnAddedMarkerWithItsEquipmentAndNumber() {
        Snapshot before = snap("P", FOLDER_A, IMG);
        Snapshot after = snap("P", FOLDER_A, IMG, marker(UUID.randomUUID(), EQ1, 0.5, 0.5, "#000000"));

        assertThat(diff(before, after)).containsExactly(Change.ofRef("MARKER_ADDED", "1", null, "Truss"));
    }

    @Test
    void reportsARemovedMarkerWithItsOldNumberAndEquipment() {
        UUID first = UUID.randomUUID();
        UUID second = UUID.randomUUID();
        Snapshot before = snap("P", FOLDER_A, IMG, marker(first, EQ1, 0.1, 0.1, "#000000"), marker(second, EQ2, 0.9, 0.9, "#000000"));
        Snapshot after = snap("P", FOLDER_A, IMG, marker(first, EQ1, 0.1, 0.1, "#000000"));

        assertThat(diff(before, after)).containsExactly(Change.ofRef("MARKER_REMOVED", "2", "Spot", null));
    }

    @Test
    void reportsEquipmentColourAndMoveOfTheSameMarkerSeparately() {
        UUID m = UUID.randomUUID();
        Snapshot before = snap("P", FOLDER_A, IMG, marker(m, EQ1, 0.1, 0.1, "#112233"));
        Snapshot after = snap("P", FOLDER_A, IMG, marker(m, EQ2, 0.6, 0.1, "#445566"));

        assertThat(diff(before, after)).containsExactly(
                Change.ofRef("MARKER_EQUIPMENT", "1", "Truss", "Spot"),
                Change.ofRef("MARKER_COLOR", "1", "#112233", "#445566"),
                Change.ofRef("MARKER_MOVED", "1", null, null));
    }

    @Test
    void reportsClearedEquipmentAsNull() {
        UUID m = UUID.randomUUID();
        Snapshot before = snap("P", FOLDER_A, IMG, marker(m, EQ1, 0.1, 0.1, "#112233"));
        Snapshot after = snap("P", FOLDER_A, IMG, marker(m, null, 0.1, 0.1, "#112233"));

        assertThat(diff(before, after)).containsExactly(Change.ofRef("MARKER_EQUIPMENT", "1", "Truss", null));
    }

    @Test
    void ignoresTinyJitterAndColourCaseChanges() {
        UUID m = UUID.randomUUID();
        Snapshot before = snap("P", FOLDER_A, IMG, marker(m, EQ1, 0.100, 0.100, "#aabbcc"));
        Snapshot after = snap("P", FOLDER_A, IMG, marker(m, EQ1, 0.103, 0.104, "#AABBCC"));

        assertThat(diff(before, after)).isEmpty();
    }

    @Test
    void numbersMarkersByTheirPositionInTheNewList() {
        UUID a = UUID.randomUUID();
        UUID b = UUID.randomUUID();
        Snapshot before = snap("P", FOLDER_A, IMG, marker(a, EQ1, 0.1, 0.1, "#000000"), marker(b, EQ1, 0.2, 0.2, "#000000"));
        Snapshot after = snap("P", FOLDER_A, IMG, marker(b, EQ1, 0.2, 0.2, "#111111"));

        assertThat(diff(before, after)).containsExactly(
                Change.ofRef("MARKER_COLOR", "1", "#000000", "#111111"),
                Change.ofRef("MARKER_REMOVED", "1", "Truss", null));
    }
}
