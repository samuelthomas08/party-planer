package app.partyplaner.image;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

/** Repository for {@link Image}, including the queries that find images nothing references any more. */
public interface ImageRepository extends JpaRepository<Image, UUID> {

    Optional<Image> findByIdAndOwnerId(UUID id, UUID ownerId);

    boolean existsByIdAndOwnerId(UUID id, UUID ownerId);

    long countByIdInAndOwnerId(Collection<UUID> ids, UUID ownerId);

    @Query(value = """
            select i.storage_key from images i
            where i.id in (:ids) and i.owner_id = :ownerId and i.storage_key is not null
              and not exists (select 1 from equipment_images e where e.image_id = i.id)
              and not exists (select 1 from places p where p.floor_plan_image_id = i.id)
            """, nativeQuery = true)
    List<String> findUnreferencedKeys(Collection<UUID> ids, UUID ownerId);

    @Query(value = """
            select i.storage_key from images i
            where i.created_at < :cutoff and i.storage_key is not null
              and not exists (select 1 from equipment_images e where e.image_id = i.id)
              and not exists (select 1 from places p where p.floor_plan_image_id = i.id)
            """, nativeQuery = true)
    List<String> findOrphanKeysOlderThan(Instant cutoff);

    @Query("select i.storageKey from Image i where i.ownerId = :ownerId and i.storageKey is not null")
    List<String> findKeysByOwnerId(UUID ownerId);

    /** Deletes the given images unless something still references them. */
    @Modifying
    @Query(value = """
            delete from images i
            where i.id in (:ids) and i.owner_id = :ownerId
              and not exists (select 1 from equipment_images e where e.image_id = i.id)
              and not exists (select 1 from places p where p.floor_plan_image_id = i.id)
            """, nativeQuery = true)
    int deleteUnreferenced(Collection<UUID> ids, UUID ownerId);

    /** Uploads that were never attached to anything. */
    @Modifying
    @Query(value = """
            delete from images i
            where i.created_at < :cutoff
              and not exists (select 1 from equipment_images e where e.image_id = i.id)
              and not exists (select 1 from places p where p.floor_plan_image_id = i.id)
            """, nativeQuery = true)
    int deleteOrphansOlderThan(Instant cutoff);
}
