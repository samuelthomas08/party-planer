package app.partyplaner.image;

import app.partyplaner.common.AppProperties;
import jakarta.annotation.PostConstruct;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Collection;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * The only code that touches image files. Keys look like "ab/ab12….png" (sharded by the first two characters of the
 * id) and are built from a UUID and a fixed extension, never from user input; every resolved path is also checked to
 * stay inside the storage root.
 */
@Component
public class ImageStorage {

    private static final Logger log = LoggerFactory.getLogger(ImageStorage.class);

    private final Path root;

    public ImageStorage(AppProperties props) {
        this.root = props.storage().imageDir().toAbsolutePath().normalize();
    }

    /** Creates the storage directory and fails fast if it is not writable. */
    @PostConstruct
    void init() throws IOException {
        Files.createDirectories(root);
        if (!Files.isWritable(root)) {
            throw new IllegalStateException("Image directory is not writable: " + root);
        }
        log.info("IMAGE_STORAGE_READY dir={}", root);
    }

    /** The absolute storage root. */
    public Path root() {
        return root;
    }

    /**
     * Writes the file now. If the surrounding database transaction rolls back, the file is removed again,
     * so a failed upload does not leave an orphan behind.
     */
    public String store(UUID id, String extension, byte[] bytes) {
        String key = id.toString().substring(0, 2) + "/" + id + "." + extension;
        Path target = resolve(key);
        try {
            Files.createDirectories(target.getParent());
            Path tmp = Files.createTempFile(target.getParent(), ".upload-", ".tmp");
            try {
                Files.write(tmp, bytes);
                try {
                    Files.move(tmp, target, StandardCopyOption.ATOMIC_MOVE);
                } catch (AtomicMoveNotSupportedException e) {
                    Files.move(tmp, target, StandardCopyOption.REPLACE_EXISTING);
                }
            } finally {
                Files.deleteIfExists(tmp);
            }
        } catch (IOException e) {
            log.error("IMAGE_FILE_WRITE_FAILED key={}", key, e);
            throw new UncheckedIOException(e);
        }
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
    /** Removes the file again if the transaction rolled back. */
                @Override
                public void afterCompletion(int status) {
                    if (status == STATUS_ROLLED_BACK) {
                        log.warn("IMAGE_FILE_ROLLBACK key={}", key);
    /** Best-effort file removal. */
                        deleteNow(key);
                    }
                }
            });
        }
        return key;
    }

    /** Opens a stored file for streaming, or {@code null} if it is missing on disk. */
    public Resource open(String key) {
        Path path = resolve(key);
        if (!Files.isRegularFile(path)) {
            log.error("IMAGE_FILE_MISSING key={}", key);
            return null;
        }
        return new FileSystemResource(path);
    }

    /** Reads a whole file (used by tests and tooling). */
    public byte[] read(String key) throws IOException {
        return Files.readAllBytes(resolve(key));
    }

    /** Deletes after the surrounding transaction commits, so a rollback never loses files that are still referenced. */
    public void deleteAfterCommit(Collection<String> keys) {
        if (keys.isEmpty()) {
            return;
        }
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
    /** Deletes only once the delete is durable. */
                @Override
                public void afterCommit() {
                    keys.forEach(ImageStorage.this::deleteNow);
                }
            });
        } else {
            keys.forEach(this::deleteNow);
        }
    }

    void deleteNow(String key) {
        try {
            if (Files.deleteIfExists(resolve(key))) {
                log.info("IMAGE_FILE_DELETED key={}", key);
            }
        } catch (IOException e) {
            log.warn("IMAGE_FILE_DELETE_FAILED key={} reason={}", key, e.getMessage());
        }
    }

    /** Maps a storage key to a path and refuses anything that would leave the storage root. */
    public Path resolve(String key) {
        Path path = root.resolve(key).normalize();
        if (!path.startsWith(root)) {
            throw new IllegalArgumentException("Storage key escapes the image directory");
        }
        return path;
    }
}
