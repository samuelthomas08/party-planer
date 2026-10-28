package app.partyplaner.guest;

import app.partyplaner.equipment.Equipment;
import app.partyplaner.equipment.EquipmentDtos.EquipmentResponse;
import app.partyplaner.equipment.EquipmentRepository;
import app.partyplaner.common.ApiException;
import app.partyplaner.image.Image;
import app.partyplaner.image.ImageRepository;
import app.partyplaner.image.ImageService;
import app.partyplaner.place.Place;
import app.partyplaner.place.PlaceDtos.PlaceResponse;
import app.partyplaner.place.PlaceRepository;
import app.partyplaner.place.Placement;
import app.partyplaner.share.ShareService;
import java.time.Duration;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Read-only access for share-link guests. A guest token names exactly one place; every request re-checks that
 * the link is still active and only ever returns data belonging to that place.
 */
@RestController
@RequestMapping("/api/guest")
public class GuestController {

    private static final Logger log = LoggerFactory.getLogger(GuestController.class);

    /** The place plus exactly the equipment its markers use. */
    public record GuestPlaceResponse(String guestName, PlaceResponse place, List<EquipmentResponse> equipment) {
    }

    private final ShareService shares;
    private final PlaceRepository places;
    private final EquipmentRepository equipmentRepo;
    private final ImageRepository imageRepo;
    private final ImageService images;

    public GuestController(ShareService shares, PlaceRepository places, EquipmentRepository equipmentRepo, ImageRepository imageRepo, ImageService images) {
        this.images = images;
        this.shares = shares;
        this.places = places;
        this.equipmentRepo = equipmentRepo;
        this.imageRepo = imageRepo;
    }

    /** The shared place, if the guest's link is still active. */
    @GetMapping("/place")
    @Transactional(readOnly = true)
    public GuestPlaceResponse place(@AuthenticationPrincipal Jwt jwt) {
        Place place = placeOf(jwt);
        List<EquipmentResponse> equipment = equipmentFor(place).stream().map(EquipmentResponse::of).toList();
        log.info("GUEST_VIEW_PLACE guest={} place={}", jwt.getSubject(), place.getId());
        return new GuestPlaceResponse(jwt.getClaimAsString("name"), PlaceResponse.of(place), equipment);
    }

    /** An image of the shared place or of equipment used on it; anything else is a 404. */
    @GetMapping("/images/{id}")
    @Transactional(readOnly = true)
    public ResponseEntity<Resource> image(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        Place place = placeOf(jwt);
        Set<UUID> allowed = new HashSet<>();
        allowed.add(place.getFloorPlanImageId());
        equipmentFor(place).forEach(e -> allowed.addAll(e.getImages().values()));
        if (!allowed.contains(id)) {
            log.warn("GUEST_IMAGE_DENIED guest={} image={}", jwt.getSubject(), id);
            throw ApiException.notFound("Image");
        }
        Image image = imageRepo.findById(id).orElseThrow(() -> ApiException.notFound("Image"));
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(image.getContentType()))
                .cacheControl(CacheControl.maxAge(Duration.ofHours(1)).cachePrivate())
                .header("X-Content-Type-Options", "nosniff")
                .contentLength(image.getSizeBytes())
                .body(images.content(image));
    }

    private Place placeOf(Jwt jwt) {
        UUID placeId = UUID.fromString(jwt.getClaimAsString("place"));
        shares.requireActiveById(UUID.fromString(jwt.getClaimAsString("share")), placeId);
        return places.findById(placeId).orElseThrow(() -> ApiException.notFound("Place"));
    }

    private List<Equipment> equipmentFor(Place place) {
        Set<UUID> ids = new HashSet<>();
        for (Placement p : place.getPlacements()) {
            if (p.getEquipmentId() != null) {
                ids.add(p.getEquipmentId());
            }
        }
        ids.removeIf(Objects::isNull);
        return equipmentRepo.findAllById(ids);
    }
}
