package app.partyplaner.place;

import app.partyplaner.audit.Change;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Function;

/** Works out, marker by marker, what an edit of a place actually changed. */
final class PlaceDiff {

    /** Frozen copy of a place, taken before it is modified. */
    record Snapshot(String name, UUID folderId, UUID floorPlanImageId, List<Marker> markers) {
        static Snapshot of(Place p) {
            return new Snapshot(p.getName(), p.getFolderId(), p.getFloorPlanImageId(),
                    p.getPlacements().stream().map(m -> new Marker(m.getId(), m.getEquipmentId(), m.getX(), m.getY(), m.getColor())).toList());
        }
    }

    record Marker(UUID id, UUID equipmentId, double x, double y, String color) {
    }

    private static final double MOVED_THRESHOLD = 0.005;

    private PlaceDiff() {
    }

    static List<Change> between(Snapshot before, Snapshot after, Function<UUID, String> folderName,
                                Function<UUID, String> equipmentTitle) {
        List<Change> changes = new ArrayList<>();
        if (!Objects.equals(before.name(), after.name())) {
            changes.add(Change.of("NAME", before.name(), after.name()));
        }
        if (!Objects.equals(before.folderId(), after.folderId())) {
            changes.add(Change.of("FOLDER", folderName.apply(before.folderId()), folderName.apply(after.folderId())));
        }
        if (!Objects.equals(before.floorPlanImageId(), after.floorPlanImageId())) {
            changes.add(Change.of("FLOOR_PLAN_REPLACED"));
        }

        Map<UUID, Marker> oldById = new HashMap<>();
        before.markers().forEach(m -> oldById.put(m.id(), m));
        Map<UUID, Marker> newById = new HashMap<>();
        after.markers().forEach(m -> newById.put(m.id(), m));

        for (int i = 0; i < after.markers().size(); i++) {
            Marker now = after.markers().get(i);
            String ref = Integer.toString(i + 1);
            Marker was = oldById.get(now.id());
            if (was == null) {
                changes.add(Change.ofRef("MARKER_ADDED", ref, null, equipmentTitle.apply(now.equipmentId())));
                continue;
            }
            if (!Objects.equals(was.equipmentId(), now.equipmentId())) {
                changes.add(Change.ofRef("MARKER_EQUIPMENT", ref, equipmentTitle.apply(was.equipmentId()), equipmentTitle.apply(now.equipmentId())));
            }
            if (!was.color().equalsIgnoreCase(now.color())) {
                changes.add(Change.ofRef("MARKER_COLOR", ref, was.color(), now.color()));
            }
            if (Math.abs(was.x() - now.x()) > MOVED_THRESHOLD || Math.abs(was.y() - now.y()) > MOVED_THRESHOLD) {
                changes.add(Change.ofRef("MARKER_MOVED", ref, null, null));
            }
        }
        for (int i = 0; i < before.markers().size(); i++) {
            Marker was = before.markers().get(i);
            if (!newById.containsKey(was.id())) {
                changes.add(Change.ofRef("MARKER_REMOVED", Integer.toString(i + 1), equipmentTitle.apply(was.equipmentId()), null));
            }
        }
        return changes;
    }
}
