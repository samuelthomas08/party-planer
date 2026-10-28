package app.partyplaner.equipment;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** Repository for {@link Equipment}; every query is scoped to the owner. */
public interface EquipmentRepository extends JpaRepository<Equipment, UUID> {

    List<Equipment> findByOwnerIdOrderByTitleAsc(UUID ownerId);

    Optional<Equipment> findByIdAndOwnerId(UUID id, UUID ownerId);

    long countByOwnerId(UUID ownerId);

    long countByIdInAndOwnerId(Collection<UUID> ids, UUID ownerId);
}
