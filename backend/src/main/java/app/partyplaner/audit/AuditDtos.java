package app.partyplaner.audit;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Wire format of the audit log. */
public final class AuditDtos {

    private AuditDtos() {
    }

    public record AuditEntry(UUID id, Instant at, String actorName, String actorType, String action, String entityType,
                             UUID entityId, String entityName, UUID placeId, String placeName, List<Change> changes,
                             String ip) {
    }

    public record PageResponse<T>(List<T> items, int page, int totalPages, long total) {
    }
}
