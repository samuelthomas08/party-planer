package app.partyplaner.logging;

import app.partyplaner.audit.AuditService;
import app.partyplaner.audit.Change;
import app.partyplaner.common.ApiException;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.function.Consumer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.logging.LogLevel;
import org.springframework.boot.logging.LoggingSystem;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/** Admin-only access to the in-memory log: snapshot, live stream (Server-Sent Events) and runtime log level. */
@RestController
@RequestMapping("/api/admin/logs")
public class AdminLogController {

    private static final Logger log = LoggerFactory.getLogger(AdminLogController.class);
    private static final String APP_LOGGER = "app.partyplaner";

    /** Body to set the log level. */
    public record LevelRequest(@NotNull String level) {
    }

    private final LogBuffer buffer;
    private final LoggingSystem loggingSystem;
    private final AuditService audit;
    private final ExecutorService sender = Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(r, "live-log-sender");
        t.setDaemon(true);
        return t;
    });

    public AdminLogController(LogBuffer buffer, LoggingSystem loggingSystem, AuditService audit) {
        this.buffer = buffer;
        this.loggingSystem = loggingSystem;
        this.audit = audit;
    }

    /** The most recent log lines. */
    @GetMapping
    List<LogEntry> snapshot(@RequestParam(defaultValue = "500") int limit) {
        return buffer.snapshot(0, Math.min(Math.max(limit, 1), 3000));
    }

    /** Server-sent events: a backlog first, then every new line as it is logged. Reconnects resume via Last-Event-ID. */
    @GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    SseEmitter stream(@RequestHeader(value = "Last-Event-ID", required = false) Long lastEventId,
                      @RequestParam(defaultValue = "300") int backlog) {
        SseEmitter emitter = new SseEmitter(0L);
        Consumer<LogEntry> listener = entry -> sender.execute(() -> send(emitter, entry));
        emitter.onCompletion(() -> buffer.unsubscribe(listener));
        emitter.onTimeout(emitter::complete);
        emitter.onError(e -> buffer.unsubscribe(listener));

        buffer.subscribe(listener);
        long after = lastEventId == null ? 0 : lastEventId;
        int limit = lastEventId == null ? Math.min(Math.max(backlog, 0), 3000) : 3000;
        sender.execute(() -> buffer.snapshot(after, limit).forEach(e -> send(emitter, e)));
        return emitter;
    }

    /** Current level of the application's loggers. */
    @GetMapping("/level")
    Map<String, String> level() {
        var configured = loggingSystem.getLoggerConfiguration(APP_LOGGER);
        LogLevel level = configured == null || configured.getEffectiveLevel() == null ? LogLevel.INFO : configured.getEffectiveLevel();
        return Map.of("level", level.name());
    }

    /** Changes the application log level at runtime (also audited). */
    @PutMapping("/level")
    Map<String, String> setLevel(@Valid @RequestBody LevelRequest body) {
        LogLevel level;
        try {
            level = LogLevel.valueOf(body.level().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw ApiException.badRequest("VALIDATION_FAILED", "Unknown log level");
        }
        if (level != LogLevel.DEBUG && level != LogLevel.INFO && level != LogLevel.WARN && level != LogLevel.ERROR) {
            throw ApiException.badRequest("VALIDATION_FAILED", "Unsupported log level");
        }
        loggingSystem.setLogLevel(APP_LOGGER, level);
        log.warn("LOG_LEVEL_CHANGED logger={} level={}", APP_LOGGER, level);
        audit.record("LOG_LEVEL_CHANGED", "SYSTEM", null, APP_LOGGER, null, null, List.of(Change.of("LOG_LEVEL", null, level.name())));
        return Map.of("level", level.name());
    }

    private void send(SseEmitter emitter, LogEntry entry) {
        try {
            emitter.send(SseEmitter.event().id(Long.toString(entry.seq())).name("log").data(entry, MediaType.APPLICATION_JSON));
        } catch (IOException | IllegalStateException e) {
            emitter.completeWithError(e);
        }
    }
}
