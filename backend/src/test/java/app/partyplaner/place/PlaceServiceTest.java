package app.partyplaner.place;

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
import app.partyplaner.equipment.Equipment;
import app.partyplaner.equipment.EquipmentCategory;
import app.partyplaner.equipment.EquipmentRepository;
import app.partyplaner.equipment.EquipmentService;
import app.partyplaner.folder.Folder;
import app.partyplaner.folder.FolderRepository;
import app.partyplaner.image.ImageService;
import app.partyplaner.place.PlaceDtos.PlaceRequest;
import app.partyplaner.place.PlaceDtos.PlacementRequest;
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
class PlaceServiceTest {

    @Mock PlaceRepository places;
    @Mock FolderRepository folders;
    @Mock EquipmentRepository equipmentRepo;
    @Mock EquipmentService equipment;
    @Mock ImageService images;
    @Mock AuditService audit;

    PlaceService service;
    UUID owner = UUID.randomUUID();
    Folder hall = new Folder(owner, "Hall");
    Folder garden = new Folder(owner, "Garden");
    UUID image = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        service = new PlaceService(places, folders, equipmentRepo, equipment, images, audit);
        when(folders.findByIdAndOwnerId(hall.getId(), owner)).thenReturn(Optional.of(hall));
        when(folders.findByIdAndOwnerId(garden.getId(), owner)).thenReturn(Optional.of(garden));
        when(folders.findById(hall.getId())).thenReturn(Optional.of(hall));
        when(folders.findById(garden.getId())).thenReturn(Optional.of(garden));
        when(places.saveAndFlush(any(Place.class))).thenAnswer(inv -> inv.getArgument(0));
        when(equipmentRepo.findByOwnerIdOrderByTitleAsc(owner)).thenReturn(List.of());
    }

    private PlaceRequest request(String name, Folder folder, UUID img, PlacementRequest... markers) {
        return new PlaceRequest(name, folder.getId(), img, List.of(markers));
    }

    private Place existing(Place.MarkerData... markers) {
        Place p = new Place(owner);
        p.update("Main", hall.getId(), image, List.of(markers));
        when(places.findByIdAndOwnerId(p.getId(), owner)).thenReturn(Optional.of(p));
        return p;
    }

    @SuppressWarnings("unchecked")
    private List<Change> changes(String action) {
        ArgumentCaptor<List<Change>> captor = ArgumentCaptor.forClass(List.class);
        verify(audit).record(eq(action), eq("PLACE"), any(), any(), any(), any(), captor.capture());
        return captor.getValue();
    }

    @Test
    void createStoresMarkersLowercasesColoursAndAudits() {
        var response = service.create(owner, request("  Main  ", hall, image, new PlacementRequest(null, 0.25, 0.75, null, "#AABBCC")));

        assertThat(response.name()).isEqualTo("Main");
        assertThat(response.placements()).hasSize(1);
        assertThat(response.placements().get(0).color()).isEqualTo("#aabbcc");
        List<Change> created = changes("PLACE_CREATED");
        assertThat(created).contains(Change.of("FOLDER", null, "Hall"), Change.of("MARKERS_COUNT", null, "1"));
    }

    @Test
    void createRejectsAnUnknownFolderAndChecksImageAndEquipmentOwnership() {
        UUID eq = UUID.randomUUID();

        service.create(owner, request("P", hall, image, new PlacementRequest(null, 0.1, 0.1, eq, "#000000")));

        verify(images).requireOwned(owner, List.of(image));
        verify(equipment).requireOwned(owner, Set.of(eq));

        PlaceRequest unknownFolder = new PlaceRequest("P", UUID.randomUUID(), image, List.of());
        assertThatThrownBy(() -> service.create(owner, unknownFolder)).isInstanceOf(ApiException.class);
    }

    @Test
    void updateRecordsEveryKindOfChangeAndRemovesAReplacedFloorPlan() {
        Place place = existing(new Place.MarkerData(null, null, 0.1, 0.1, "#000000"));
        UUID markerId = place.getPlacements().get(0).getId();
        UUID newImage = UUID.randomUUID();
        UUID eqId = UUID.randomUUID();
        Equipment eq = new Equipment(owner);
        eq.update("Spot", "", EquipmentCategory.OTHER, Map.of());
        when(equipmentRepo.findByOwnerIdOrderByTitleAsc(owner)).thenReturn(List.of(eq));

        service.update(owner, place.getId(), request("Main hall", garden, newImage,
                new PlacementRequest(markerId, 0.9, 0.1, eq.getId(), "#112233")));

        List<Change> updated = changes("PLACE_UPDATED");
        assertThat(updated).contains(
                Change.of("NAME", "Main", "Main hall"),
                Change.of("FOLDER", "Hall", "Garden"),
                Change.of("FLOOR_PLAN_REPLACED"),
                Change.ofRef("MARKER_EQUIPMENT", "1", null, "Spot"),
                Change.ofRef("MARKER_COLOR", "1", "#000000", "#112233"),
                Change.ofRef("MARKER_MOVED", "1", null, null));
        verify(images).deleteUnreferenced(owner, Set.of(image));
        assertThat(eqId).isNotNull();
    }

    @Test
    void anUpdateThatChangesNothingIsNotRecordedAndKeepsTheFloorPlan() {
        Place place = existing(new Place.MarkerData(null, null, 0.1, 0.1, "#000000"));
        UUID markerId = place.getPlacements().get(0).getId();

        service.update(owner, place.getId(), request("Main", hall, image, new PlacementRequest(markerId, 0.1, 0.1, null, "#000000")));

        verify(audit, never()).record(eq("PLACE_UPDATED"), any(), any(), any(), any(), any(), anyList());
        verify(images, never()).deleteUnreferenced(any(), any());
    }

    @Test
    void deleteRemovesThePlaceItsFloorPlanAndRecordsIt() {
        Place place = existing();

        service.delete(owner, place.getId());

        verify(places).delete(place);
        verify(images).deleteUnreferenced(owner, Set.of(image));
        verify(audit).record(eq("PLACE_DELETED"), eq("PLACE"), eq(place.getId()), eq("Main"), eq(place.getId()), eq("Main"), anyList());
    }

    @Test
    void deletingAFolderRecordsEachPlaceWithTheReason() {
        Place a = existing();
        Place b = existing();
        when(places.findByFolderIdAndOwnerId(hall.getId(), owner)).thenReturn(List.of(a, b));

        service.deleteAllInFolder(owner, hall.getId(), "Hall");

        verify(places).delete(a);
        verify(places).delete(b);
        ArgumentCaptor<List<Change>> reason = ArgumentCaptor.forClass(List.class);
        verify(audit, org.mockito.Mockito.times(2)).record(eq("PLACE_DELETED"), any(), any(), any(), any(), any(), reason.capture());
        assertThat(reason.getValue()).containsExactly(Change.of("FOLDER_DELETED", "Hall", null));
    }

    @Test
    void anotherUsersPlaceIsNotFound() {
        UUID id = UUID.randomUUID();
        when(places.findByIdAndOwnerId(id, owner)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.get(owner, id)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> service.requireOwned(owner, id)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> service.delete(owner, id)).isInstanceOf(ApiException.class);
    }
}
