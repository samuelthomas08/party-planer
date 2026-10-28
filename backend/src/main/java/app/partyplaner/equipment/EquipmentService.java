package app.partyplaner.equipment;

import app.partyplaner.audit.AuditService;
import app.partyplaner.audit.Change;
import app.partyplaner.common.ApiException;
import app.partyplaner.equipment.EquipmentDtos.EquipmentRequest;
import app.partyplaner.equipment.EquipmentDtos.EquipmentResponse;
import app.partyplaner.image.ImageService;
import app.partyplaner.place.Place;
import app.partyplaner.place.PlaceRepository;
import app.partyplaner.place.Placement;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Equipment use cases. Validates slots against the category, checks image ownership, cleans up images that
 * are no longer referenced and writes the audit trail (including the effect on places that used the equipment).
 */
@Service
public class EquipmentService {

    private static final Logger log = LoggerFactory.getLogger(EquipmentService.class);

    private final EquipmentRepository equipment;
    private final PlaceRepository places;
    private final ImageService images;
    private final AuditService audit;

    public EquipmentService(EquipmentRepository equipment, PlaceRepository places, ImageService images, AuditService audit) {
        this.equipment = equipment;
        this.places = places;
        this.images = images;
        this.audit = audit;
    }

    /** All equipment of the owner, by title. */
    @Transactional(readOnly = true)
    public List<EquipmentResponse> list(UUID ownerId) {
        log.debug("EQUIPMENT_LIST owner={}", ownerId);
        return equipment.findByOwnerIdOrderByTitleAsc(ownerId).stream().map(EquipmentResponse::of).toList();
    }

    /** One item; 404 if it is not the owner's. */
    @Transactional(readOnly = true)
    public EquipmentResponse get(UUID ownerId, UUID id) {
        return EquipmentResponse.of(find(ownerId, id));
    }

    /** Validates and creates an item. */
    @Transactional
    public EquipmentResponse create(UUID ownerId, EquipmentRequest request) {
        Equipment item = new Equipment(ownerId);
        apply(ownerId, item, request);
        equipment.saveAndFlush(item);
        log.info("EQUIPMENT_CREATED owner={} equipment={} category={}", ownerId, item.getId(), item.getCategory());
        audit.record("EQUIPMENT_CREATED", "EQUIPMENT", item.getId(), item.getTitle(), null, null,
                List.of(Change.of("CATEGORY", null, item.getCategory().name())));
        return EquipmentResponse.of(item);
    }

    /** Updates an item, removes images that are no longer used and records what changed. */
    @Transactional
    public EquipmentResponse update(UUID ownerId, UUID id, EquipmentRequest request) {
        Equipment item = find(ownerId, id);
        String oldTitle = item.getTitle();
        String oldDescription = item.getDescription();
        EquipmentCategory oldCategory = item.getCategory();
        Map<EquipmentSlot, UUID> oldImages = Map.copyOf(item.getImages());
        Set<UUID> before = new HashSet<>(oldImages.values());

        apply(ownerId, item, request);
        equipment.flush();
        before.removeAll(item.getImages().values());
        images.deleteUnreferenced(ownerId, before);

        List<Change> changes = new ArrayList<>();
        if (!Objects.equals(oldTitle, item.getTitle())) {
            changes.add(Change.of("TITLE", oldTitle, item.getTitle()));
        }
        if (!Objects.equals(oldDescription, item.getDescription())) {
            changes.add(Change.of("DESCRIPTION"));
        }
        if (oldCategory != item.getCategory()) {
            changes.add(Change.of("CATEGORY", oldCategory.name(), item.getCategory().name()));
        }
        for (EquipmentSlot slot : EquipmentSlot.values()) {
            UUID was = oldImages.get(slot);
            UUID now = item.getImages().get(slot);
            if (Objects.equals(was, now)) {
                continue;
            }
            changes.add(Change.ofRef(was == null ? "IMAGE_ADDED" : now == null ? "IMAGE_REMOVED" : "IMAGE_REPLACED",
                    slot.name(), null, null));
        }
        log.info("EQUIPMENT_UPDATED owner={} equipment={} changes={}", ownerId, id, changes.size());
        if (!changes.isEmpty()) {
            audit.record("EQUIPMENT_UPDATED", "EQUIPMENT", id, item.getTitle(), null, null, changes);
        }
        return EquipmentResponse.of(item);
    }

    /** Deletes an item and tells the history of every place whose markers used it. */
    @Transactional
    public void delete(UUID ownerId, UUID id) {
        Equipment item = find(ownerId, id);
        Set<UUID> imageIds = new HashSet<>(item.getImages().values());

        // Markers that used this equipment lose their assignment (DB: on delete set null). Tell those places' histories.
        List<Place> affected = places.findUsingEquipment(id);
        for (Place place : affected) {
            List<Placement> markers = place.getPlacements();
            for (int i = 0; i < markers.size(); i++) {
                if (id.equals(markers.get(i).getEquipmentId())) {
                    audit.record("PLACE_UPDATED", "PLACE", place.getId(), place.getName(), place.getId(), place.getName(),
                            List.of(Change.ofRef("MARKER_EQUIPMENT", Integer.toString(i + 1), item.getTitle(), null)));
                }
            }
        }

        String title = item.getTitle();
        equipment.delete(item);
        equipment.flush();
        images.deleteUnreferenced(ownerId, imageIds);
        log.info("EQUIPMENT_DELETED owner={} equipment={} affectedPlaces={}", ownerId, id, affected.size());
        audit.record("EQUIPMENT_DELETED", "EQUIPMENT", id, title, null, null, List.of());
    }

    /** Throws unless all ids exist and belong to the user. */
    @Transactional(readOnly = true)
    public void requireOwned(UUID ownerId, Set<UUID> ids) {
        if (!ids.isEmpty() && equipment.countByIdInAndOwnerId(ids, ownerId) != ids.size()) {
            log.warn("EQUIPMENT_REJECTED owner={} reason=not-owned ids={}", ownerId, ids.size());
            throw ApiException.badRequest("EQUIPMENT_INVALID", "Unknown equipment");
        }
    }

    private void apply(UUID ownerId, Equipment item, EquipmentRequest request) {
        for (EquipmentSlot slot : request.images().keySet()) {
            if (!slot.allowedFor(request.category())) {
                log.warn("EQUIPMENT_REJECTED owner={} reason=slot-category slot={} category={}", ownerId, slot, request.category());
                throw ApiException.badRequest("SLOT_INVALID", "Slot " + slot + " is not valid for " + request.category());
            }
        }
        if (request.category() == EquipmentCategory.OTHER && !request.images().containsKey(EquipmentSlot.PHOTO)) {
            throw ApiException.badRequest("PHOTO_REQUIRED", "A photo is required");
        }
        images.requireOwned(ownerId, request.images().values());
        item.update(request.title().trim(), request.description() == null ? "" : request.description().trim(),
                request.category(), request.images());
    }

    private Equipment find(UUID ownerId, UUID id) {
        return equipment.findByIdAndOwnerId(id, ownerId).orElseThrow(() -> {
            log.warn("EQUIPMENT_NOT_FOUND owner={} equipment={}", ownerId, id);
            return ApiException.notFound("Equipment");
        });
    }
}
