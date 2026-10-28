package app.partyplaner.folder;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** Repository for {@link Folder}; every query is scoped to the owner. */
public interface FolderRepository extends JpaRepository<Folder, UUID> {

    List<Folder> findByOwnerIdOrderByNameAsc(UUID ownerId);

    Optional<Folder> findByIdAndOwnerId(UUID id, UUID ownerId);
}
