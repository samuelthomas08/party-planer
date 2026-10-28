package app.partyplaner.place;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** Repository for {@link Place}; user-facing queries are scoped to the owner. */
public interface PlaceRepository extends JpaRepository<Place, UUID> {

    List<Place> findByOwnerIdOrderByNameAsc(UUID ownerId);

    List<Place> findByFolderIdAndOwnerId(UUID folderId, UUID ownerId);

    @org.springframework.data.jpa.repository.Query("select distinct p from Place p join p.placements m where m.equipmentId = :equipmentId")
    List<Place> findUsingEquipment(UUID equipmentId);

    long countByOwnerId(UUID ownerId);

    List<Place> findAllByOrderByNameAsc();

    Optional<Place> findByIdAndOwnerId(UUID id, UUID ownerId);
}
