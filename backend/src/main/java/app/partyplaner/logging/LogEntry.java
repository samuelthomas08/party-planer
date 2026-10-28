package app.partyplaner.logging;

import java.time.Instant;

/** One captured log line, as shown in the live log. */
public record LogEntry(long seq, Instant ts, String level, String logger, String thread, String message,
                       String requestId, String user, String stack) {
}
