package app.partyplaner.user;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** Repository for {@link User}. */
public interface UserRepository extends JpaRepository<User, UUID> {

    Optional<User> findByEmail(String email);

    boolean existsByEmail(String email);

    long countByRoleAndEnabled(Role role, boolean enabled);

    java.util.List<User> findAllByOrderByCreatedAtAsc();
}
