package app.partyplaner.share;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** Repository for {@link ShareLink}. */
public interface ShareLinkRepository extends JpaRepository<ShareLink, UUID> {

    Optional<ShareLink> findByToken(String token);

    List<ShareLink> findByPlaceIdOrderByCreatedAtDesc(UUID placeId);

    Optional<ShareLink> findByIdAndPlaceId(UUID id, UUID placeId);
}
