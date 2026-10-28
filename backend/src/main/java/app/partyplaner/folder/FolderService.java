package app.partyplaner.folder;

import app.partyplaner.audit.AuditService;
import app.partyplaner.audit.Change;
import app.partyplaner.common.ApiException;
import app.partyplaner.folder.FolderDtos.FolderResponse;
import app.partyplaner.place.Place;
import app.partyplaner.place.PlaceDtos.PlaceSummary;
import app.partyplaner.place.PlaceRepository;
import app.partyplaner.place.PlaceService;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Folder use cases. Deleting a folder deletes its places (and their images) and records each deletion. */
@Service
public class FolderService {

    private static final Logger log = LoggerFactory.getLogger(FolderService.class);

    private final FolderRepository folders;
    private final PlaceRepository places;
    private final PlaceService placeService;
    private final AuditService audit;

    public FolderService(FolderRepository folders, PlaceRepository places, PlaceService placeService, AuditService audit) {
        this.audit = audit;
        this.folders = folders;
        this.places = places;
        this.placeService = placeService;
    }

    /** Folders with their places, sorted by name. */
    @Transactional(readOnly = true)
    public List<FolderResponse> list(UUID ownerId) {
        Map<UUID, List<PlaceSummary>> byFolder = places.findByOwnerIdOrderByNameAsc(ownerId).stream()
                .collect(Collectors.groupingBy(Place::getFolderId,
                        Collectors.mapping(p -> new PlaceSummary(p.getId(), p.getName(), p.getFolderId(), p.getFloorPlanImageId()),
                                Collectors.toList())));
        return folders.findByOwnerIdOrderByNameAsc(ownerId).stream()
                .map(f -> new FolderResponse(f.getId(), f.getName(), byFolder.getOrDefault(f.getId(), List.of())))
                .toList();
    }

    /** Creates a folder. */
    @Transactional
    public FolderResponse create(UUID ownerId, String name) {
        Folder folder = folders.save(new Folder(ownerId, name.trim()));
        log.info("FOLDER_CREATED owner={} folder={}", ownerId, folder.getId());
        audit.record("FOLDER_CREATED", "FOLDER", folder.getId(), folder.getName(), null, null, List.of());
        return new FolderResponse(folder.getId(), folder.getName(), List.of());
    }

    /** Renames a folder. */
    @Transactional
    public FolderResponse rename(UUID ownerId, UUID id, String name) {
        Folder folder = find(ownerId, id);
        String old = folder.getName();
        folder.setName(name.trim());
        log.info("FOLDER_RENAMED owner={} folder={}", ownerId, id);
        audit.record("FOLDER_RENAMED", "FOLDER", id, folder.getName(), null, null, List.of(Change.of("NAME", old, folder.getName())));
        return new FolderResponse(folder.getId(), folder.getName(),
                places.findByFolderIdAndOwnerId(id, ownerId).stream()
                        .map(p -> new PlaceSummary(p.getId(), p.getName(), p.getFolderId(), p.getFloorPlanImageId())).toList());
    }

    /** Deletes the folder and, through {@link PlaceService}, its places. */
    @Transactional
    public void delete(UUID ownerId, UUID id) {
        Folder folder = find(ownerId, id);
        placeService.deleteAllInFolder(ownerId, id, folder.getName());
        folders.delete(folder);
        log.info("FOLDER_DELETED owner={} folder={}", ownerId, id);
        audit.record("FOLDER_DELETED", "FOLDER", id, folder.getName(), null, null, List.of());
    }

    private Folder find(UUID ownerId, UUID id) {
        return folders.findByIdAndOwnerId(id, ownerId).orElseThrow(() -> ApiException.notFound("Folder"));
    }
}
