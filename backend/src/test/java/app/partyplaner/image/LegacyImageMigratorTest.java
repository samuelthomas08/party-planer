package app.partyplaner.image;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.jdbc.core.JdbcTemplate;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class LegacyImageMigratorTest {

    @Mock JdbcTemplate jdbc;
    @Mock ImageStorage storage;

    @Test
    void doesNothingWhenNoImageStillLivesInTheDatabase() {
        when(jdbc.queryForList(anyString(), eq(UUID.class))).thenReturn(List.of());

        new LegacyImageMigrator(jdbc, storage).afterPropertiesSet();

        verify(storage, never()).store(any(), anyString(), any());
    }

    @Test
    void writesTheFileBeforeItEmptiesTheRowSoACrashCanNeverLoseAnImage() {
        UUID id = UUID.randomUUID();
        byte[] bytes = {1, 2, 3};
        when(jdbc.queryForList(anyString(), eq(UUID.class))).thenReturn(List.of(id));
        when(jdbc.queryForMap(anyString(), eq(id))).thenReturn(Map.of("content_type", "image/webp", "data", bytes));
        when(storage.store(id, "webp", bytes)).thenReturn("ab/key.webp");

        new LegacyImageMigrator(jdbc, storage).afterPropertiesSet();

        var order = inOrder(storage, jdbc);
        order.verify(storage).store(id, "webp", bytes);
        order.verify(jdbc).update(anyString(), eq("ab/key.webp"), eq(id));
    }

    @Test
    void mapsContentTypesToExtensions() {
        UUID png = UUID.randomUUID();
        UUID jpeg = UUID.randomUUID();
        when(jdbc.queryForList(anyString(), eq(UUID.class))).thenReturn(List.of(png, jpeg));
        when(jdbc.queryForMap(anyString(), eq(png))).thenReturn(Map.of("content_type", "image/png", "data", new byte[]{1}));
        when(jdbc.queryForMap(anyString(), eq(jpeg))).thenReturn(Map.of("content_type", "image/jpeg", "data", new byte[]{2}));
        when(storage.store(any(), anyString(), any())).thenReturn("k");

        new LegacyImageMigrator(jdbc, storage).afterPropertiesSet();

        verify(storage).store(eq(png), eq("png"), any());
        verify(storage).store(eq(jpeg), eq("jpg"), any());
    }
}
