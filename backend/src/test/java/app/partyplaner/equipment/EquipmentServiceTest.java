package app.partyplaner.equipment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import app.partyplaner.audit.AuditService;
import app.partyplaner.audit.Change;
import app.partyplaner.common.ApiException;
import app.partyplaner.equipment.EquipmentDtos.EquipmentRequest;
import app.partyplaner.image.ImageService;
import app.partyplaner.place.Place;
import app.partyplaner.place.PlaceRepository;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class EquipmentServiceTest {

    @Mock EquipmentRepository equipment;
    @Mock PlaceRepository places;
    @Mock ImageService images;
    @Mock AuditService audit;

    EquipmentService service;
    UUID owner = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        service = new EquipmentService(equipment, places, images, audit);
        when(equipment.saveAndFlush(any(Equipment.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    private static EquipmentRequest request(String title, EquipmentCategory category, Map<EquipmentSlot, UUID> imgs) {
        return new EquipmentRequest(title, "desc", category, imgs);
    }

    private Equipment existing(String title, Map<EquipmentSlot, UUID> imgs) {
        Equipment e = new Equipment(owner);
        e.update(title, "desc", EquipmentCategory.STAND, imgs);
        when(equipment.findByIdAndOwnerId(e.getId(), owner)).thenReturn(Optional.of(e));
        return e;
    }

    @SuppressWarnings("unchecked")
    private List<Change> auditedChanges(String action) {
        ArgumentCaptor<List<Change>> captor = ArgumentCaptor.forClass(List.class);
        verify(audit).record(eq(action), any(), any(), any(), any(), any(), captor.capture());
        return captor.getValue();
    }

    @Test
    void createTrimsAndStoresTheItemAndAuditsIt() {
        UUID image = UUID.randomUUID();

        var response = service.create(owner, request("  Truss  ", EquipmentCategory.STAND, Map.of(EquipmentSlot.FOOT, image)));

        assertThat(response.title()).isEqualTo("Truss");
        assertThat(response.images()).containsEntry(EquipmentSlot.FOOT, image);
        verify(images).requireOwned(eq(owner), any(Collection.class));
        verify(audit).record(eq("EQUIPMENT_CREATED"), eq("EQUIPMENT"), any(), eq("Truss"), any(), any(), anyList());
    }

    @Test
    void aStandMayNotUseThePhotoSlotAndOtherEquipmentMayNotUsePartSlots() {
        UUID image = UUID.randomUUID();

        assertThatThrownBy(() -> service.create(owner, request("x", EquipmentCategory.STAND, Map.of(EquipmentSlot.PHOTO, image))))
                .satisfies(t -> assertThat(((ApiException) t).code()).isEqualTo("SLOT_INVALID"));
        assertThatThrownBy(() -> service.create(owner, request("x", EquipmentCategory.OTHER, Map.of(EquipmentSlot.FOOT, image))))
                .satisfies(t -> assertThat(((ApiException) t).code()).isEqualTo("SLOT_INVALID"));
        verify(equipment, never()).saveAndFlush(any());
    }

    @Test
    void otherEquipmentNeedsItsPhoto() {
        assertThatThrownBy(() -> service.create(owner, request("x", EquipmentCategory.OTHER, Map.of())))
                .satisfies(t -> assertThat(((ApiException) t).code()).isEqualTo("PHOTO_REQUIRED"));
    }

    @Test
    void imagesOfOtherUsersAreRejectedByTheOwnershipCheck() {
        org.mockito.Mockito.doThrow(ApiException.badRequest("IMAGE_INVALID", "Unknown image")).when(images).requireOwned(eq(owner), any(Collection.class));

        assertThatThrownBy(() -> service.create(owner, request("x", EquipmentCategory.STAND, Map.of(EquipmentSlot.FOOT, UUID.randomUUID()))))
                .satisfies(t -> assertThat(((ApiException) t).code()).isEqualTo("IMAGE_INVALID"));
        verify(equipment, never()).saveAndFlush(any());
    }

    @Test
    void updateReportsExactlyWhatChangedAndCleansUpReplacedImages() {
        UUID footOld = UUID.randomUUID();
        UUID lightOld = UUID.randomUUID();
        UUID topNew = UUID.randomUUID();
        UUID footNew = UUID.randomUUID();
        Equipment item = existing("Truss", Map.of(EquipmentSlot.FOOT, footOld, EquipmentSlot.LIGHT_1, lightOld));

        service.update(owner, item.getId(), new EquipmentRequest("Truss XL", "other text", EquipmentCategory.STAND,
                Map.of(EquipmentSlot.FOOT, footNew, EquipmentSlot.TOP_BAR, topNew)));

        List<Change> changes = auditedChanges("EQUIPMENT_UPDATED");
        assertThat(changes).contains(
                Change.of("TITLE", "Truss", "Truss XL"),
                Change.of("DESCRIPTION"),
                Change.ofRef("IMAGE_REPLACED", "FOOT", null, null),
                Change.ofRef("IMAGE_ADDED", "TOP_BAR", null, null),
                Change.ofRef("IMAGE_REMOVED", "LIGHT_1", null, null));
        ArgumentCaptor<Collection<UUID>> removed = ArgumentCaptor.forClass(Collection.class);
        verify(images).deleteUnreferenced(eq(owner), removed.capture());
        assertThat(removed.getValue()).containsExactlyInAnyOrder(footOld, lightOld);
    }

    @Test
    void anUpdateWithoutChangesWritesNoAuditEntry() {
        UUID image = UUID.randomUUID();
        Equipment item = existing("Truss", Map.of(EquipmentSlot.FOOT, image));

        service.update(owner, item.getId(), new EquipmentRequest("Truss", "desc", EquipmentCategory.STAND, Map.of(EquipmentSlot.FOOT, image)));

        verify(audit, never()).record(eq("EQUIPMENT_UPDATED"), any(), any(), any(), any(), any(), anyList());
    }

    @Test
    void anotherUsersEquipmentIsNotFound() {
        assertThatThrownBy(() -> service.get(owner, UUID.randomUUID())).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> service.delete(owner, UUID.randomUUID())).isInstanceOf(ApiException.class);
    }

    @Test
    void deleteTellsThePlaceHistoryWhichMarkerLostItsEquipmentAndRemovesImages() {
        UUID image = UUID.randomUUID();
        Equipment item = existing("Truss", Map.of(EquipmentSlot.FOOT, image));
        Place place = new Place(owner);
        place.update("Main", UUID.randomUUID(), UUID.randomUUID(), List.of(
                new Place.MarkerData(null, null, 0.1, 0.1, "#000000"),
                new Place.MarkerData(null, item.getId(), 0.2, 0.2, "#000000")));
        when(places.findUsingEquipment(item.getId())).thenReturn(List.of(place));

        service.delete(owner, item.getId());

        verify(equipment).delete(item);
        verify(images).deleteUnreferenced(owner, Set.of(image));
        ArgumentCaptor<List<Change>> placeChanges = ArgumentCaptor.forClass(List.class);
        verify(audit).record(eq("PLACE_UPDATED"), eq("PLACE"), eq(place.getId()), eq("Main"), eq(place.getId()), eq("Main"), placeChanges.capture());
        assertThat(placeChanges.getValue()).containsExactly(Change.ofRef("MARKER_EQUIPMENT", "2", "Truss", null));
        verify(audit).record(eq("EQUIPMENT_DELETED"), eq("EQUIPMENT"), eq(item.getId()), eq("Truss"), any(), any(), anyList());
    }

    @Test
    void requireOwnedChecksTheCountAndSkipsEmptySets() {
        UUID a = UUID.randomUUID();
        when(equipment.countByIdInAndOwnerId(Set.of(a), owner)).thenReturn(0L);

        service.requireOwned(owner, Set.of());
        verify(equipment, never()).countByIdInAndOwnerId(any(), any());

        assertThatThrownBy(() -> service.requireOwned(owner, Set.of(a)))
                .satisfies(t -> assertThat(((ApiException) t).code()).isEqualTo("EQUIPMENT_INVALID"));
    }
}
