package app.partyplaner.image;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import app.partyplaner.common.ApiException;
import java.util.Base64;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockMultipartFile;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ImageServiceTest {

    static final byte[] PNG = Base64.getDecoder().decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==");

    @Mock ImageRepository repo;
    @Mock ImageStorage storage;

    ImageService service;
    UUID owner = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        service = new ImageService(repo, storage);
        when(repo.save(any(Image.class))).thenAnswer(inv -> inv.getArgument(0));
        when(storage.store(any(UUID.class), anyString(), any(byte[].class))).thenAnswer(inv -> "ab/" + inv.getArgument(0) + "." + inv.getArgument(1));
    }

    private static void assertApi(Throwable t, HttpStatus status, String code) {
        assertThat(((ApiException) t).status()).isEqualTo(status);
        assertThat(((ApiException) t).code()).isEqualTo(code);
    }

    @Test
    void storesTheFileAndOnlyMetadataInTheDatabase() {
        UUID id = service.store(owner, new MockMultipartFile("file", "a.png", "image/png", PNG));

        ArgumentCaptor<Image> saved = ArgumentCaptor.forClass(Image.class);
        verify(repo).save(saved.capture());
        assertThat(saved.getValue().getId()).isEqualTo(id);
        assertThat(saved.getValue().getContentType()).isEqualTo("image/png");
        assertThat(saved.getValue().getSizeBytes()).isEqualTo(PNG.length);
        assertThat(saved.getValue().getStorageKey()).isEqualTo("ab/" + id + ".png");
        verify(storage).store(eq(id), eq("png"), eq(PNG));
    }

    @Test
    void theRealTypeComesFromTheBytesNotFromTheClaimedNameOrContentType() {
        service.store(owner, new MockMultipartFile("file", "evil.html", "text/html", PNG));

        ArgumentCaptor<Image> saved = ArgumentCaptor.forClass(Image.class);
        verify(repo).save(saved.capture());
        assertThat(saved.getValue().getContentType()).isEqualTo("image/png");
        assertThat(saved.getValue().getStorageKey()).endsWith(".png");
    }

    @Test
    void usesTheMatchingFileExtensionForJpegAndWebp() {
        service.store(owner, new MockMultipartFile("file", "a", "x", new byte[]{(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, 0, 0}));
        service.store(owner, new MockMultipartFile("file", "a", "x", "RIFF\0\0\0\0WEBPVP8 ".getBytes()));

        verify(storage).store(any(UUID.class), eq("jpg"), any(byte[].class));
        verify(storage).store(any(UUID.class), eq("webp"), any(byte[].class));
    }

    @Test
    void rejectsEmptyOversizedAndNonImageUploadsWithoutTouchingStorage() {
        assertThatThrownBy(() -> service.store(owner, new MockMultipartFile("file", "a.png", "image/png", new byte[0])))
                .satisfies(t -> assertApi(t, HttpStatus.BAD_REQUEST, "IMAGE_EMPTY"));
        assertThatThrownBy(() -> service.store(owner, new MockMultipartFile("file", "a.png", "image/png", new byte[5 * 1024 * 1024 + 1])))
                .satisfies(t -> assertApi(t, HttpStatus.CONTENT_TOO_LARGE, "IMAGE_TOO_LARGE"));
        assertThatThrownBy(() -> service.store(owner, new MockMultipartFile("file", "a.png", "image/png", "<svg onload=alert(1)>".getBytes())))
                .satisfies(t -> assertApi(t, HttpStatus.UNSUPPORTED_MEDIA_TYPE, "IMAGE_UNSUPPORTED"));
        verify(storage, never()).store(any(), anyString(), any());
        verify(repo, never()).save(any());
    }

    @Test
    void requireOwnedComparesDistinctIdsAgainstTheOwnedCount() {
        UUID a = UUID.randomUUID();
        when(repo.countByIdInAndOwnerId(Set.of(a), owner)).thenReturn(1L);

        service.requireOwned(owner, List.of(a, a));
        service.requireOwned(owner, List.of());

        when(repo.countByIdInAndOwnerId(Set.of(a), owner)).thenReturn(0L);
        assertThatThrownBy(() -> service.requireOwned(owner, List.of(a))).satisfies(t -> assertApi(t, HttpStatus.BAD_REQUEST, "IMAGE_INVALID"));
    }

    @Test
    void deleteUnreferencedRemovesRowsThenFilesAfterCommit() {
        UUID a = UUID.randomUUID();
        when(repo.findUnreferencedKeys(Set.of(a), owner)).thenReturn(List.of("ab/a.png"));

        service.deleteUnreferenced(owner, List.of(a));

        var order = inOrder(repo, storage);
        order.verify(repo).deleteUnreferenced(Set.of(a), owner);
        order.verify(storage).deleteAfterCommit(List.of("ab/a.png"));
    }

    @Test
    void deleteUnreferencedWithNothingToDeleteDoesNoWork() {
        service.deleteUnreferenced(owner, List.of());

        verify(repo, never()).deleteUnreferenced(anyCollection(), any());
    }

    @Test
    void loadIsScopedToTheOwner() {
        UUID id = UUID.randomUUID();
        when(repo.findByIdAndOwnerId(id, owner)).thenReturn(java.util.Optional.empty());

        assertThatThrownBy(() -> service.load(owner, id)).satisfies(t -> assertApi(t, HttpStatus.NOT_FOUND, "NOT_FOUND"));
    }

    @Test
    void contentIs404WhenTheFileVanishedFromDisk() {
        Image withKey = new Image(UUID.randomUUID(), owner, "image/png", 1, "ab/x.png");
        Image withoutKey = new Image(UUID.randomUUID(), owner, "image/png", 1, null);
        when(storage.open("ab/x.png")).thenReturn(null);

        assertThatThrownBy(() -> service.content(withKey)).satisfies(t -> assertApi(t, HttpStatus.NOT_FOUND, "NOT_FOUND"));
        assertThatThrownBy(() -> service.content(withoutKey)).satisfies(t -> assertApi(t, HttpStatus.NOT_FOUND, "NOT_FOUND"));

        Resource resource = new ByteArrayResource(PNG);
        when(storage.open("ab/x.png")).thenReturn(resource);
        assertThat(service.content(withKey)).isSameAs(resource);
    }
}
