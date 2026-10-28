package app.partyplaner.image;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import app.partyplaner.TestProps;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.core.io.Resource;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

class ImageStorageTest {

    @TempDir
    Path dir;

    ImageStorage storage;

    @BeforeEach
    void setUp() throws IOException {
        storage = new ImageStorage(TestProps.props(true, false, dir));
        storage.init();
    }

    @AfterEach
    void clearSynchronization() {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }

    @Test
    void storesTheFileUnderAShardedKeyDerivedOnlyFromTheId() throws IOException {
        UUID id = UUID.fromString("ab123456-0000-4000-8000-000000000000");

        String key = storage.store(id, "png", new byte[]{1, 2, 3});

        assertThat(key).isEqualTo("ab/ab123456-0000-4000-8000-000000000000.png");
        assertThat(Files.readAllBytes(dir.resolve(key))).containsExactly(1, 2, 3);
        assertThat(storage.read(key)).containsExactly(1, 2, 3);
    }

    @Test
    void leavesNoTemporaryFilesBehind() throws IOException {
        storage.store(UUID.randomUUID(), "png", new byte[]{9});
        try (var files = Files.walk(dir)) {
            assertThat(files.filter(Files::isRegularFile).map(p -> p.getFileName().toString())).noneMatch(n -> n.endsWith(".tmp"));
        }
    }

    @Test
    void opensStoredFilesAndReturnsNullForMissingOnes() {
        String key = storage.store(UUID.randomUUID(), "jpg", new byte[]{7});

        Resource resource = storage.open(key);

        assertThat(resource).isNotNull();
        assertThat(resource.exists()).isTrue();
        assertThat(storage.open("zz/missing.png")).isNull();
    }

    @Test
    void refusesKeysThatEscapeTheRoot() {
        assertThatThrownBy(() -> storage.resolve("../outside.png")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> storage.resolve("ab/../../outside.png")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> storage.resolve("/etc/passwd")).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void deletesImmediatelyWhenThereIsNoTransaction() {
        String key = storage.store(UUID.randomUUID(), "png", new byte[]{1});

        storage.deleteAfterCommit(List.of(key));

        assertThat(dir.resolve(key)).doesNotExist();
    }

    @Test
    void deletesOnlyAfterCommitInsideATransaction() {
        String key = storage.store(UUID.randomUUID(), "png", new byte[]{1});
        TransactionSynchronizationManager.initSynchronization();

        storage.deleteAfterCommit(List.of(key));
        assertThat(dir.resolve(key)).exists();

        TransactionSynchronizationManager.getSynchronizations().forEach(TransactionSynchronization::afterCommit);
        assertThat(dir.resolve(key)).doesNotExist();
    }

    @Test
    void neverDeletesWhenTheTransactionRollsBack() {
        String key = storage.store(UUID.randomUUID(), "png", new byte[]{1});
        TransactionSynchronizationManager.initSynchronization();

        storage.deleteAfterCommit(List.of(key));
        TransactionSynchronizationManager.getSynchronizations()
                .forEach(s -> s.afterCompletion(TransactionSynchronization.STATUS_ROLLED_BACK));

        assertThat(dir.resolve(key)).exists();
    }

    @Test
    void removesAFreshlyWrittenFileWhenItsTransactionRollsBack() {
        TransactionSynchronizationManager.initSynchronization();
        String key = storage.store(UUID.randomUUID(), "png", new byte[]{1});
        assertThat(dir.resolve(key)).exists();

        TransactionSynchronizationManager.getSynchronizations()
                .forEach(s -> s.afterCompletion(TransactionSynchronization.STATUS_ROLLED_BACK));

        assertThat(dir.resolve(key)).doesNotExist();
    }

    @Test
    void keepsAFreshlyWrittenFileWhenItsTransactionCommits() {
        TransactionSynchronizationManager.initSynchronization();
        String key = storage.store(UUID.randomUUID(), "png", new byte[]{1});

        TransactionSynchronizationManager.getSynchronizations()
                .forEach(s -> s.afterCompletion(TransactionSynchronization.STATUS_COMMITTED));

        assertThat(dir.resolve(key)).exists();
    }

    @Test
    void deletingAMissingFileIsHarmless() {
        storage.deleteAfterCommit(List.of("ab/does-not-exist.png"));
    }

    @Test
    void createsTheRootDirectoryOnStartup() throws IOException {
        Path fresh = dir.resolve("nested/images");

        new ImageStorage(TestProps.props(true, false, fresh)).init();

        assertThat(fresh).isDirectory();
    }
}
