package app.partyplaner.logging;

import static org.assertj.core.api.Assertions.assertThat;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.LoggerContext;
import ch.qos.logback.classic.spi.LoggingEvent;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class LogBufferTest {

    private final LoggerContext context = new LoggerContext();
    private final LogBuffer buffer = new LogBuffer();

    private LoggingEvent event(Level level, String message, Throwable error) {
        LoggingEvent e = new LoggingEvent("fqcn", context.getLogger("app.test"), level, message, error, null);
        e.setMDCPropertyMap(Map.of("requestId", "abcd1234", "user", "u-1"));
        return e;
    }

    @Test
    void capturesLevelLoggerMessageAndRequestContext() {
        buffer.append(event(Level.WARN, "something happened", null));

        LogEntry entry = buffer.snapshot(0, 10).get(0);

        assertThat(entry.level()).isEqualTo("WARN");
        assertThat(entry.logger()).isEqualTo("app.test");
        assertThat(entry.message()).isEqualTo("something happened");
        assertThat(entry.requestId()).isEqualTo("abcd1234");
        assertThat(entry.user()).isEqualTo("u-1");
        assertThat(entry.stack()).isNull();
    }

    @Test
    void entriesGetIncreasingSequenceNumbers() {
        buffer.append(event(Level.INFO, "a", null));
        buffer.append(event(Level.INFO, "b", null));

        assertThat(buffer.snapshot(0, 10)).extracting(LogEntry::seq).containsExactly(1L, 2L);
    }

    @Test
    void snapshotCanResumeAfterASequenceNumber() {
        for (int i = 0; i < 5; i++) buffer.append(event(Level.INFO, "m" + i, null));

        assertThat(buffer.snapshot(3, 10)).extracting(LogEntry::message).containsExactly("m3", "m4");
    }

    @Test
    void snapshotLimitKeepsTheNewestEntries() {
        for (int i = 0; i < 10; i++) buffer.append(event(Level.INFO, "m" + i, null));

        assertThat(buffer.snapshot(0, 3)).extracting(LogEntry::message).containsExactly("m7", "m8", "m9");
    }

    @Test
    void theBufferIsBoundedAndDropsTheOldestEntries() {
        for (int i = 0; i < 3100; i++) buffer.append(event(Level.INFO, "m" + i, null));

        List<LogEntry> all = buffer.snapshot(0, 10_000);
        assertThat(all).hasSize(3000);
        assertThat(all.get(0).message()).isEqualTo("m100");
        assertThat(all.get(2999).message()).isEqualTo("m3099");
    }

    @Test
    void includesAndTruncatesStackTraces() {
        buffer.append(event(Level.ERROR, "boom", new IllegalStateException("x".repeat(20_000))));

        String stack = buffer.snapshot(0, 1).get(0).stack();

        assertThat(stack).contains("IllegalStateException").endsWith("(truncated)");
        assertThat(stack.length()).isLessThan(6100);
    }

    @Test
    void subscribersReceiveNewEntriesUntilTheyUnsubscribe() {
        List<LogEntry> received = new ArrayList<>();
        java.util.function.Consumer<LogEntry> listener = received::add;

        buffer.subscribe(listener);
        buffer.append(event(Level.INFO, "one", null));
        buffer.unsubscribe(listener);
        buffer.append(event(Level.INFO, "two", null));

        assertThat(received).extracting(LogEntry::message).containsExactly("one");
    }
}
