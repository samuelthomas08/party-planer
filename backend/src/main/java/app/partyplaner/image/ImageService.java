package app.partyplaner.image;

import app.partyplaner.common.ApiException;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Stream;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

/**
 * Image use cases: validate and store uploads, hand out files, delete unreferenced images and run the nightly
 * clean-up. Content type is determined by sniffing the bytes, never from client-supplied metadata.
 */
@Service
public class ImageService {

    private static final Logger log = LoggerFactory.getLogger(ImageService.class);
    private static final int MAX_BYTES = 5 * 1024 * 1024;

    private final ImageRepository images;
    private final ImageStorage storage;

    public ImageService(ImageRepository images, ImageStorage storage) {
        this.images = images;
        this.storage = storage;
    }

    /** Validates an upload (size, magic bytes), writes the file and records its metadata. */
    @Transactional
    public UUID store(UUID ownerId, MultipartFile file) {
        if (file.isEmpty()) {
            log.warn("IMAGE_REJECTED owner={} reason=empty", ownerId);
            throw ApiException.badRequest("IMAGE_EMPTY", "The file is empty");
        }
        if (file.getSize() > MAX_BYTES) {
            log.warn("IMAGE_REJECTED owner={} reason=too-large size={}", ownerId, file.getSize());
            throw new ApiException(HttpStatus.CONTENT_TOO_LARGE, "IMAGE_TOO_LARGE", "The file is too large");
        }
        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException e) {
            throw ApiException.badRequest("IMAGE_UNREADABLE", "The file could not be read");
        }
        // Never trust the client-supplied content type or file name; sniff the magic bytes instead.
        String type = sniff(bytes);
        if (type == null) {
            log.warn("IMAGE_REJECTED owner={} reason=unsupported-type claimed={}", ownerId, file.getContentType());
            throw new ApiException(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "IMAGE_UNSUPPORTED", "Only PNG, JPEG and WebP images are supported");
        }
        UUID id = UUID.randomUUID();
        String key = storage.store(id, extensionFor(type), bytes);
        images.save(new Image(id, ownerId, type, bytes.length, key));
        log.info("IMAGE_STORED owner={} image={} type={} bytes={} key={}", ownerId, id, type, bytes.length, key);
        return id;
    }

    /** Metadata of an image the user owns. */
    @Transactional(readOnly = true)
    public Image load(UUID ownerId, UUID id) {
        return images.findByIdAndOwnerId(id, ownerId).orElseThrow(() -> ApiException.notFound("Image"));
    }

    /** The file content for streaming; 404 if the file has vanished from disk. */
    public Resource content(Image image) {
        Resource resource = image.getStorageKey() == null ? null : storage.open(image.getStorageKey());
        if (resource == null) {
            throw ApiException.notFound("Image");
        }
        return resource;
    }

    /** Verifies that every id exists and belongs to the user. */
    @Transactional(readOnly = true)
    public void requireOwned(UUID ownerId, Collection<UUID> ids) {
        Set<UUID> distinct = Set.copyOf(ids);
        if (!distinct.isEmpty() && images.countByIdInAndOwnerId(distinct, ownerId) != distinct.size()) {
            throw ApiException.badRequest("IMAGE_INVALID", "Unknown image");
        }
    }

    /** Removes the given images (rows and files) unless something still references them. */
    @Transactional
    public void deleteUnreferenced(UUID ownerId, Collection<UUID> ids) {
        if (ids.isEmpty()) {
            return;
        }
        Set<UUID> distinct = Set.copyOf(ids);
        List<String> keys = images.findUnreferencedKeys(distinct, ownerId);
        int removed = images.deleteUnreferenced(distinct, ownerId);
        storage.deleteAfterCommit(keys);
        log.info("IMAGE_DELETED owner={} removed={}", ownerId, removed);
    }

    /** Keys of everything a user owns; call before deleting the user, then pass to {@link #deleteFilesAfterCommit}. */
    @Transactional(readOnly = true)
    public List<String> keysOwnedBy(UUID ownerId) {
        return images.findKeysByOwnerId(ownerId);
    }

    /** Schedules file removal for after the surrounding transaction commits. */
    public void deleteFilesAfterCommit(Collection<String> keys) {
        storage.deleteAfterCommit(keys);
    }

    /** Nightly clean-up of unreferenced uploads and stray files. */
    @Scheduled(cron = "0 43 3 * * *")
    @Transactional
    void purgeOrphans() {
        Instant cutoff = Instant.now().minus(Duration.ofHours(24));
        List<String> keys = images.findOrphanKeysOlderThan(cutoff);
        int removed = images.deleteOrphansOlderThan(cutoff);
        storage.deleteAfterCommit(keys);
        log.info("JOB_PURGE_ORPHAN_IMAGES removed={}", removed);
        sweepStrayFiles(cutoff);
    }

    /** Files on disk that no database row knows about (e.g. a crash between write and commit). */
    private void sweepStrayFiles(Instant cutoff) {
        int removed = 0;
        try (Stream<Path> files = Files.walk(storage.root())) {
            for (Path file : (Iterable<Path>) files.filter(Files::isRegularFile)::iterator) {
                String name = file.getFileName().toString();
                int dot = name.lastIndexOf('.');
                if (dot < 0 || Files.getLastModifiedTime(file).toInstant().isAfter(cutoff)) {
                    continue;
                }
                try {
                    if (!images.existsById(UUID.fromString(name.substring(0, dot)))) {
                        Files.delete(file);
                        removed++;
                        log.info("IMAGE_STRAY_FILE_DELETED file={}", name);
                    }
                } catch (IllegalArgumentException ignored) {
                    // not one of our files (e.g. a temp upload) – leave it alone
                }
            }
        } catch (IOException e) {
            log.warn("JOB_SWEEP_STRAY_FILES_FAILED reason={}", e.getMessage());
        }
        log.info("JOB_SWEEP_STRAY_FILES removed={}", removed);
    }

    private static String extensionFor(String type) {
        return switch (type) {
            case "image/png" -> "png";
            case "image/jpeg" -> "jpg";
            default -> "webp";
        };
    }

    /** Detects PNG / JPEG / WebP from the first bytes; {@code null} for anything else. */
    static String sniff(byte[] b) {
        if (b.length >= 8 && (b[0] & 0xFF) == 0x89 && b[1] == 'P' && b[2] == 'N' && b[3] == 'G') {
            return "image/png";
        }
        if (b.length >= 3 && (b[0] & 0xFF) == 0xFF && (b[1] & 0xFF) == 0xD8 && (b[2] & 0xFF) == 0xFF) {
            return "image/jpeg";
        }
        if (b.length >= 12 && b[0] == 'R' && b[1] == 'I' && b[2] == 'F' && b[3] == 'F'
                && b[8] == 'W' && b[9] == 'E' && b[10] == 'B' && b[11] == 'P') {
            return "image/webp";
        }
        return null;
    }
}
