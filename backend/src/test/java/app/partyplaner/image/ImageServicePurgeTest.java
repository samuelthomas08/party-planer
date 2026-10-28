package app.partyplaner.image;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import app.partyplaner.TestProps;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.FileTime;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

/** The nightly clean-up: unreferenced uploads and files that no database row knows about. */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ImageServicePurgeTest {

    @TempDir Path dir;
    @Mock ImageRepository repo;

    ImageStorage storage;
    ImageService service;

    @BeforeEach
    void setUp() throws IOException {
        storage = new ImageStorage(TestProps.props(true, false, dir));
        storage.init();
        service = new ImageService(repo, storage);
    }

    private Path file(UUID id, boolean old) throws IOException {
        String key = storage.store(id, "png", new byte[]{1});
        Path path = dir.resolve(key);
        if (old) Files.setLastModifiedTime(path, FileTime.from(Instant.now().minusSeconds(3 * 24 * 3600)));
        return path;
    }

    @Test
    void removesOrphanedRowsAndTheirFiles() throws IOException {
        UUID orphan = UUID.randomUUID();
        Path orphanFile = file(orphan, true);
        when(repo.findOrphanKeysOlderThan(any(Instant.class))).thenReturn(List.of(dir.relativize(orphanFile).toString()));
        when(repo.existsById(orphan)).thenReturn(false);

        service.purgeOrphans();

        verify(repo).deleteOrphansOlderThan(any(Instant.class));
        assertThat(orphanFile).doesNotExist();
    }

    @Test
    void sweepsOldFilesWithoutARowButKeepsEverythingElse() throws IOException {
        UUID known = UUID.randomUUID();
        UUID stray = UUID.randomUUID();
        UUID freshStray = UUID.randomUUID();
        Path knownFile = file(known, true);
        Path strayFile = file(stray, true);
        Path freshStrayFile = file(freshStray, false); // might still be mid-upload
        Path foreign = dir.resolve("ab/not-a-uuid.txt");
        Files.createDirectories(foreign.getParent());
        Files.write(foreign, new byte[]{9});
        Files.setLastModifiedTime(foreign, FileTime.from(Instant.now().minusSeconds(3 * 24 * 3600)));
        when(repo.findOrphanKeysOlderThan(any(Instant.class))).thenReturn(List.of());
        when(repo.existsById(known)).thenReturn(true);
        when(repo.existsById(stray)).thenReturn(false);
        when(repo.existsById(freshStray)).thenReturn(false);

        service.purgeOrphans();

        assertThat(knownFile).exists();
        assertThat(strayFile).doesNotExist();
        assertThat(freshStrayFile).exists();
        assertThat(foreign).exists();
    }
}
