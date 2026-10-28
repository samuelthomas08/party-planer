package app.partyplaner.logging;

import static org.assertj.core.api.Assertions.assertThat;

import app.partyplaner.logging.ClientLogController.ClientLogEntry;
import app.partyplaner.logging.ClientLogController.ClientLogRequest;
import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;

class ClientLogControllerTest {

    private final ClientLogController controller = new ClientLogController();
    private final Logger logger = (Logger) LoggerFactory.getLogger("app.partyplaner.client");
    private final ListAppender<ILoggingEvent> appender = new ListAppender<>();
    private Level previous;

    @BeforeEach
    void attach() {
        previous = logger.getLevel();
        logger.setLevel(Level.DEBUG);
        appender.start();
        logger.addAppender(appender);
    }

    @AfterEach
    void detach() {
        logger.detachAppender(appender);
        logger.setLevel(previous);
    }

    private void send(String level, String event, String message, String url, String data) {
        controller.accept(new ClientLogRequest(List.of(new ClientLogEntry(level, event, message, url, data))));
    }

    @Test
    void mapsBrowserLevelsToServerLevels() {
        send("error", "E", "m", "/", null);
        send("warn", "W", "m", "/", null);
        send("info", "I", "m", "/", null);
        send("debug", "D", "m", "/", null);
        send(null, "N", "m", "/", null);
        send("whatever", "X", "m", "/", null);

        assertThat(appender.list).extracting(ILoggingEvent::getLevel)
                .containsExactly(Level.ERROR, Level.WARN, Level.INFO, Level.DEBUG, Level.INFO, Level.INFO);
    }

    @Test
    void stripsLineBreaksAndControlCharactersSoLogLinesCannotBeForged() {
        send("info", "EVT\nFAKE", "hello\r\n2026-01-01 ERROR forged line\u0007", "/x\ty", "a\nb");

        String line = appender.list.get(0).getFormattedMessage();

        assertThat(line).doesNotContain("\n").doesNotContain("\r").doesNotContain("\u0007").doesNotContain("\t");
        assertThat(line).contains("EVT FAKE").contains("hello");
    }

    @Test
    void includesUrlAndDataWhenGiven() {
        send("info", "EVT", "msg", "/places/1", "{\"a\":1}");

        assertThat(appender.list.get(0).getFormattedMessage()).startsWith("CLIENT EVT").contains("url=/places/1").contains("data={\"a\":1}");
    }

    @Test
    void missingFieldsDoNotCrashAndAreShownAsDashes() {
        send("info", null, null, null, "  ");

        assertThat(appender.list.get(0).getFormattedMessage()).contains("CLIENT -").contains("msg=\"-\"");
    }

    @Test
    void writesEveryEntryOfABatch() {
        controller.accept(new ClientLogRequest(List.of(
                new ClientLogEntry("info", "A", "1", "/", null),
                new ClientLogEntry("info", "B", "2", "/", null))));

        assertThat(appender.list).hasSize(2);
    }
}
