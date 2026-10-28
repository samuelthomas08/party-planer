package app.partyplaner.logging;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Lets the browser app write into the same log as the server, so the live log shows the whole picture.
 * Everything coming from the client is untrusted: control characters are stripped (no log forging) and sizes capped.
 */
@RestController
@RequestMapping("/api/client-logs")
public class ClientLogController {

    private static final Logger log = LoggerFactory.getLogger("app.partyplaner.client");

    /** One browser-side log line. */
    public record ClientLogEntry(@Size(max = 10) String level, @Size(max = 80) String event,
                                 @Size(max = 600) String message, @Size(max = 200) String url,
                                 @Size(max = 600) String data) {
    }

    /** A batch of browser-side log lines. */
    public record ClientLogRequest(@NotEmpty @Size(max = 50) List<@Valid ClientLogEntry> entries) {
    }

    /** Writes browser log lines into the server log, sanitised. */
    @PostMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void accept(@Valid @RequestBody ClientLogRequest body) {
        for (ClientLogEntry e : body.entries()) {
            String line = "CLIENT {} msg=\"{}\" url={}{}";
            String event = clean(e.event());
            String message = clean(e.message());
            String url = clean(e.url());
            String data = e.data() == null || e.data().isBlank() ? "" : " data=" + clean(e.data());
            switch (e.level() == null ? "info" : e.level().toLowerCase()) {
                case "error" -> log.error(line, event, message, url, data);
                case "warn" -> log.warn(line, event, message, url, data);
                case "debug" -> log.debug(line, event, message, url, data);
                default -> log.info(line, event, message, url, data);
            }
        }
    }

    private static String clean(String value) {
        return value == null ? "-" : value.replaceAll("[\\p{Cntrl}]", " ").trim();
    }
}
