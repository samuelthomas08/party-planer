package app.partyplaner.folder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import app.partyplaner.audit.AuditService;
import app.partyplaner.audit.Change;
import app.partyplaner.common.ApiException;
import app.partyplaner.folder.FolderDtos.FolderResponse;
import app.partyplaner.place.Place;
import app.partyplaner.place.PlaceRepository;
import app.partyplaner.place.PlaceService;
import java.util.List;
import java.util.Optional;
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
class FolderServiceTest {

    @Mock FolderRepository folders;
    @Mock PlaceRepository places;
    @Mock PlaceService placeService;
    @Mock AuditService audit;

    FolderService service;
    UUID owner = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        service = new FolderService(folders, places, placeService, audit);
        when(folders.save(any(Folder.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    private Place placeIn(Folder f, String name) {
        Place p = new Place(owner);
        p.update(name, f.getId(), UUID.randomUUID(), List.of());
        return p;
    }

    @Test
    void createTrimsTheNameAndAudits() {
        FolderResponse created = service.create(owner, "  Hall ");

        assertThat(created.name()).isEqualTo("Hall");
        assertThat(created.places()).isEmpty();
        verify(audit).record(eq("FOLDER_CREATED"), eq("FOLDER"), any(), eq("Hall"), any(), any(), anyList());
    }

    @Test
    void listGroupsPlacesByFolderAndKeepsEmptyFolders() {
        Folder hall = new Folder(owner, "Hall");
        Folder garden = new Folder(owner, "Garden");
        when(folders.findByOwnerIdOrderByNameAsc(owner)).thenReturn(List.of(garden, hall));
        when(places.findByOwnerIdOrderByNameAsc(owner)).thenReturn(List.of(placeIn(hall, "A"), placeIn(hall, "B")));

        List<FolderResponse> result = service.list(owner);

        assertThat(result).extracting(FolderResponse::name).containsExactly("Garden", "Hall");
        assertThat(result.get(0).places()).isEmpty();
        assertThat(result.get(1).places()).extracting(p -> p.name()).containsExactly("A", "B");
    }

    @Test
    void renameRecordsOldAndNewName() {
        Folder hall = new Folder(owner, "Hall");
        when(folders.findByIdAndOwnerId(hall.getId(), owner)).thenReturn(Optional.of(hall));
        when(places.findByFolderIdAndOwnerId(hall.getId(), owner)).thenReturn(List.of());

        service.rename(owner, hall.getId(), " Big hall ");

        assertThat(hall.getName()).isEqualTo("Big hall");
        ArgumentCaptor<List<Change>> changes = ArgumentCaptor.forClass(List.class);
        verify(audit).record(eq("FOLDER_RENAMED"), any(), any(), any(), any(), any(), changes.capture());
        assertThat(changes.getValue()).containsExactly(Change.of("NAME", "Hall", "Big hall"));
    }

    @Test
    void deleteRemovesThePlacesFirstThenTheFolder() {
        Folder hall = new Folder(owner, "Hall");
        when(folders.findByIdAndOwnerId(hall.getId(), owner)).thenReturn(Optional.of(hall));

        service.delete(owner, hall.getId());

        var order = inOrder(placeService, folders, audit);
        order.verify(placeService).deleteAllInFolder(owner, hall.getId(), "Hall");
        order.verify(folders).delete(hall);
        order.verify(audit).record(eq("FOLDER_DELETED"), any(), any(), any(), any(), any(), anyList());
    }

    @Test
    void foldersOfOtherUsersAreNotFound() {
        UUID id = UUID.randomUUID();
        when(folders.findByIdAndOwnerId(id, owner)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.rename(owner, id, "x")).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> service.delete(owner, id)).isInstanceOf(ApiException.class);
    }
}
