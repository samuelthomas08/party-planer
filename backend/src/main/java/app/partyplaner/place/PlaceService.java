package app.partyplaner.place;

import app.partyplaner.audit.AuditService;
import app.partyplaner.audit.Change;
import app.partyplaner.common.ApiException;
import app.partyplaner.equipment.Equipment;
import app.partyplaner.equipment.EquipmentRepository;
import app.partyplaner.equipment.EquipmentService;
import app.partyplaner.folder.Folder;
import app.partyplaner.folder.FolderRepository;
import app.partyplaner.image.ImageService;
import app.partyplaner.place.PlaceDtos.PlaceRequest;
import app.partyplaner.place.PlaceDtos.PlaceResponse;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Place use cases. Validates folder, image and equipment ownership, reconciles markers by id and records a
 * precise audit diff for every edit.
 */
@Service
public class PlaceService {

    private static final Logger log = LoggerFactory.getLogger(PlaceService.class);

    private final PlaceRepository places;
    private final FolderRepository folders;
    private final EquipmentRepository equipmentRepo;
    private final EquipmentService equipment;
    private final ImageService images;
    private final AuditService audit;

    public PlaceService(PlaceRepository places, FolderRepository folders, EquipmentRepository equipmentRepo,
                        EquipmentService equipment, ImageService images, AuditService audit) {
        this.places = places;
        this.folders = folders;
        this.equipmentRepo = equipmentRepo;
        this.equipment = equipment;
        this.images = images;
        this.audit = audit;
    }

    /** One place; 404 if it is not the owner's. */
    @Transactional(readOnly = true)
    public PlaceResponse get(UUID ownerId, UUID id) {
        log.debug("PLACE_GET owner={} place={}", ownerId, id);
        return PlaceResponse.of(find(ownerId, id));
    }

    /** Ownership check used by the activity and sharing endpoints. */
    @Transactional(readOnly = true)
    public Place requireOwned(UUID ownerId, UUID id) {
        return find(ownerId, id);
    }

    /** Creates a place and records it in the history. */
    @Transactional
    public PlaceResponse create(UUID ownerId, PlaceRequest request) {
        Place place = new Place(ownerId);
        apply(ownerId, place, request);
        places.saveAndFlush(place);
        log.info("PLACE_CREATED owner={} place={} markers={}", ownerId, place.getId(), place.getPlacements().size());
        audit.record("PLACE_CREATED", "PLACE", place.getId(), place.getName(), place.getId(), place.getName(), List.of(
                Change.of("FOLDER", null, folderName(place.getFolderId())),
                Change.of("MARKERS_COUNT", null, Integer.toString(place.getPlacements().size()))));
        return PlaceResponse.of(place);
    }

    /** Updates a place and records exactly what changed. */
    @Transactional
    public PlaceResponse update(UUID ownerId, UUID id, PlaceRequest request) {
        Place place = find(ownerId, id);
        PlaceDiff.Snapshot before = PlaceDiff.Snapshot.of(place);
        UUID oldImage = place.getFloorPlanImageId();
        apply(ownerId, place, request);
        places.flush();
        if (oldImage != null && !oldImage.equals(place.getFloorPlanImageId())) {
            images.deleteUnreferenced(ownerId, Set.of(oldImage));
        }

        Map<UUID, String> titles = new HashMap<>();
        equipmentRepo.findByOwnerIdOrderByTitleAsc(ownerId).forEach(e -> titles.put(e.getId(), e.getTitle()));
        List<Change> changes = PlaceDiff.between(before, PlaceDiff.Snapshot.of(place), this::folderName,
                eid -> eid == null ? null : titles.get(eid));
        if (changes.isEmpty()) {
            log.info("PLACE_UPDATED_NOOP owner={} place={}", ownerId, id);
        } else {
            log.info("PLACE_UPDATED owner={} place={} changes={}", ownerId, id, changes.size());
            audit.record("PLACE_UPDATED", "PLACE", id, place.getName(), id, place.getName(), changes);
        }
        return PlaceResponse.of(place);
    }

    /** Deletes one place. */
    @Transactional
    public void delete(UUID ownerId, UUID id) {
        Place place = find(ownerId, id);
        remove(ownerId, place, List.of());
    }

    /** Removes every place of a folder (used when the folder itself is deleted). */
    @Transactional
    public void deleteAllInFolder(UUID ownerId, UUID folderId, String folderName) {
        List<Place> inFolder = places.findByFolderIdAndOwnerId(folderId, ownerId);
        log.info("PLACE_DELETE_BY_FOLDER owner={} folder={} count={}", ownerId, folderId, inFolder.size());
        for (Place place : inFolder) {
            remove(ownerId, place, List.of(Change.of("FOLDER_DELETED", folderName, null)));
        }
    }

    private void remove(UUID ownerId, Place place, List<Change> reason) {
        UUID image = place.getFloorPlanImageId();
        UUID id = place.getId();
        String name = place.getName();
        places.delete(place);
        places.flush();
        if (image != null) {
            images.deleteUnreferenced(ownerId, Set.of(image));
        }
        log.info("PLACE_DELETED owner={} place={}", ownerId, id);
        audit.record("PLACE_DELETED", "PLACE", id, name, id, name, reason);
    }

    private void apply(UUID ownerId, Place place, PlaceRequest request) {
        Folder folder = folders.findByIdAndOwnerId(request.folderId(), ownerId).orElseThrow(() -> {
            log.warn("PLACE_REJECTED owner={} reason=unknown-folder folder={}", ownerId, request.folderId());
            return ApiException.notFound("Folder");
        });
        images.requireOwned(ownerId, List.of(request.floorPlanImageId()));
        Set<UUID> equipmentIds = request.placements().stream()
                .map(PlaceDtos.PlacementRequest::equipmentId).filter(Objects::nonNull).collect(Collectors.toSet());
        equipment.requireOwned(ownerId, equipmentIds);
        List<Place.MarkerData> markers = request.placements().stream()
                .map(p -> new Place.MarkerData(p.id(), p.equipmentId(), p.x(), p.y(), p.color().toLowerCase()))
                .toList();
        place.update(request.name().trim(), folder.getId(), request.floorPlanImageId(), markers);
    }

    private String folderName(UUID folderId) {
        return folderId == null ? null : folders.findById(folderId).map(Folder::getName).orElse(null);
    }

    private Place find(UUID ownerId, UUID id) {
        return places.findByIdAndOwnerId(id, ownerId).orElseThrow(() -> {
            log.warn("PLACE_NOT_FOUND owner={} place={}", ownerId, id);
            return ApiException.notFound("Place");
        });
    }
}
