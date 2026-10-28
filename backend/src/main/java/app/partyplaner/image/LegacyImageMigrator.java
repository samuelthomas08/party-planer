package app.partyplaner.image;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.context.annotation.DependsOn;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * One-time move of images that were stored in the database (before this change) to files on disk.
 * Runs at startup, after the schema migrations and before the web server accepts requests. Idempotent:
 * once a row has a storage_key and an empty "data" column it is never touched again.
 */
@Component
@DependsOn("entityManagerFactory")
public class LegacyImageMigrator implements InitializingBean {

    private static final Logger log = LoggerFactory.getLogger(LegacyImageMigrator.class);

    private final JdbcTemplate jdbc;
    private final ImageStorage storage;

    public LegacyImageMigrator(JdbcTemplate jdbc, ImageStorage storage) {
        this.jdbc = jdbc;
        this.storage = storage;
    }

    /** Moves every image still stored in the database to disk. */
    @Override
    public void afterPropertiesSet() {
        List<UUID> ids = jdbc.queryForList("select id from images where data is not null", UUID.class);
        if (ids.isEmpty()) {
            return;
        }
        log.info("IMAGE_MIGRATION_START count={}", ids.size());
        int moved = 0;
        for (UUID id : ids) {
            Map<String, Object> row = jdbc.queryForMap("select content_type, data from images where id = ?", id);
            byte[] data = (byte[]) row.get("data");
            String type = (String) row.get("content_type");
            String ext = type.endsWith("png") ? "png" : type.endsWith("webp") ? "webp" : "jpg";
            String key = storage.store(id, ext, data);
            // The file is on disk before the row stops holding the bytes, so a crash can never lose an image.
            jdbc.update("update images set storage_key = ?, data = null where id = ?", key, id);
            moved++;
        }
        log.info("IMAGE_MIGRATION_DONE moved={}", moved);
    }
}
