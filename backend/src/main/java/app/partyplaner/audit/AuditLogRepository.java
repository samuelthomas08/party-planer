package app.partyplaner.audit;

import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

/** Repository for {@link AuditLog}, newest entries first. */
public interface AuditLogRepository extends JpaRepository<AuditLog, UUID> {

    Page<AuditLog> findAllByOrderByAtDesc(Pageable pageable);

    Page<AuditLog> findByPlaceIdOrderByAtDesc(UUID placeId, Pageable pageable);
}
