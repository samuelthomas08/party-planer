package app.partyplaner.audit;

import app.partyplaner.audit.AuditDtos.AuditEntry;
import app.partyplaner.audit.AuditDtos.PageResponse;
import java.util.List;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import tools.jackson.core.JacksonException;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

/**
 * The permanent, user-facing history ("who changed what, when, where, how"). Written in the same
 * transaction as the change itself, so an entry exists if and only if the change was committed.
 */
@Service
public class AuditService {

    private static final Logger log = LoggerFactory.getLogger(AuditService.class);
    private static final TypeReference<List<Change>> CHANGES = new TypeReference<>() {
    };

    private final AuditLogRepository repo;
    private final JsonMapper json;

    public AuditService(AuditLogRepository repo, JsonMapper json) {
        this.repo = repo;
        this.json = json;
    }

    /** Records an event attributed to whoever is making the current request. */
    @Transactional
    public void record(String action, String entityType, UUID entityId, String entityName,
                       UUID placeId, String placeName, List<Change> changes) {
        record(Actor.current(), action, entityType, entityId, entityName, placeId, placeName, changes);
    }

    @Transactional
    public void record(Actor actor, String action, String entityType, UUID entityId, String entityName,
                       UUID placeId, String placeName, List<Change> changes) {
        String payload;
        try {
            payload = json.writeValueAsString(changes == null ? List.of() : changes);
        } catch (JacksonException e) {
            log.error("AUDIT_SERIALIZE_FAILED action={} entity={}", action, entityId, e);
            payload = "[]";
        }
        repo.save(new AuditLog(actor, action, entityType, entityId, truncate(entityName, 200), placeId,
                truncate(placeName, 120), payload, clientIp()));
        log.info("AUDIT action={} actor={}({}) entity={}:{} place={}", action, actor.name(), actor.type(),
                entityType, entityId, placeId);
    }

    /** One page of history, newest first; optionally limited to one place. IP addresses are only included on request. */
    @Transactional(readOnly = true)
    public PageResponse<AuditEntry> page(UUID placeId, int page, int size, boolean includeIp) {
        PageRequest request = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100));
        Page<AuditLog> result = placeId == null ? repo.findAllByOrderByAtDesc(request)
                : repo.findByPlaceIdOrderByAtDesc(placeId, request);
        return new PageResponse<>(result.map(a -> toEntry(a, includeIp)).getContent(), result.getNumber(),
                result.getTotalPages(), result.getTotalElements());
    }

    private AuditEntry toEntry(AuditLog a, boolean includeIp) {
        List<Change> changes;
        try {
            changes = json.readValue(a.getChanges(), CHANGES);
        } catch (JacksonException e) {
            log.warn("AUDIT_PARSE_FAILED id={}", a.getId());
            changes = List.of();
        }
        return new AuditEntry(a.getId(), a.getAt(), a.getActorName(), a.getActorType(), a.getAction(), a.getEntityType(),
                a.getEntityId(), a.getEntityName(), a.getPlaceId(), a.getPlaceName(), changes, includeIp ? a.getIp() : null);
    }

    private static String clientIp() {
        if (RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attrs) {
            return attrs.getRequest().getRemoteAddr();
        }
        return null;
    }

    private static String truncate(String value, int max) {
        return value == null || value.length() <= max ? value : value.substring(0, max);
    }
}
