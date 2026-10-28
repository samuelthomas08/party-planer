package app.partyplaner.audit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import app.partyplaner.audit.AuditDtos.AuditEntry;
import app.partyplaner.audit.AuditDtos.PageResponse;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import tools.jackson.databind.json.JsonMapper;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AuditServiceTest {

    @Mock AuditLogRepository repo;

    AuditService service;
    final Actor actor = Actor.user(UUID.randomUUID(), "Ada");

    @BeforeEach
    void setUp() {
        service = new AuditService(repo, JsonMapper.builder().build());
        when(repo.save(any(AuditLog.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    private AuditLog saved() {
        ArgumentCaptor<AuditLog> captor = ArgumentCaptor.forClass(AuditLog.class);
        verify(repo).save(captor.capture());
        return captor.getValue();
    }

    @Test
    void recordsActorEntityPlaceAndChangesAsJson() {
        UUID place = UUID.randomUUID();

        service.record(actor, "PLACE_UPDATED", "PLACE", place, "Main", place, "Main", List.of(Change.ofRef("MARKER_MOVED", "2", null, null)));

        AuditLog log = saved();
        assertThat(log.getActorName()).isEqualTo("Ada");
        assertThat(log.getActorType()).isEqualTo("USER");
        assertThat(log.getAction()).isEqualTo("PLACE_UPDATED");
        assertThat(log.getPlaceId()).isEqualTo(place);
        assertThat(log.getChanges()).contains("MARKER_MOVED").contains("\"ref\":\"2\"");
    }

    @Test
    void noChangesBecomeAnEmptyJsonArray() {
        service.record(actor, "LOGIN", "USER", null, "Ada", null, null, null);

        assertThat(saved().getChanges()).isEqualTo("[]");
    }

    @Test
    void overlongNamesAreTruncatedToTheColumnSize() {
        service.record(actor, "PLACE_CREATED", "PLACE", null, "x".repeat(500), null, "y".repeat(500), List.of());

        AuditLog log = saved();
        assertThat(log.getEntityName()).hasSize(200);
        assertThat(log.getPlaceName()).hasSize(120);
    }

    @Test
    void jsonSpecialCharactersInValuesStayValidJson() {
        service.record(actor, "PLACE_UPDATED", "PLACE", null, "n", null, null,
                List.of(Change.of("NAME", "a\"quote", "line\nbreak")));
        AuditLog log = saved();
        when(repo.findAllByOrderByAtDesc(any(Pageable.class))).thenReturn(new PageImpl<>(List.of(log)));

        AuditEntry entry = service.page(null, 0, 10, false).items().get(0);

        assertThat(entry.changes()).containsExactly(Change.of("NAME", "a\"quote", "line\nbreak"));
    }

    @Test
    void pageHidesIpAddressesUnlessAskedToInclude() {
        AuditLog log = new AuditLog(actor, "LOGIN", "USER", null, "Ada", null, null, "[]", "10.0.0.7");
        when(repo.findAllByOrderByAtDesc(any(Pageable.class))).thenReturn(new PageImpl<>(List.of(log), PageRequest.of(0, 10), 1));

        assertThat(service.page(null, 0, 10, false).items().get(0).ip()).isNull();
        assertThat(service.page(null, 0, 10, true).items().get(0).ip()).isEqualTo("10.0.0.7");
    }

    @Test
    void pageFiltersByPlaceWhenGiven() {
        UUID place = UUID.randomUUID();
        when(repo.findByPlaceIdOrderByAtDesc(any(UUID.class), any(Pageable.class))).thenReturn(new PageImpl<>(List.of()));

        PageResponse<AuditEntry> page = service.page(place, 0, 10, false);

        assertThat(page.items()).isEmpty();
        verify(repo).findByPlaceIdOrderByAtDesc(any(UUID.class), any(Pageable.class));
    }

    @Test
    void pageSizeAndNumberAreClamped() {
        when(repo.findAllByOrderByAtDesc(any(Pageable.class))).thenReturn(new PageImpl<>(List.of()));

        service.page(null, -5, 100_000, false);

        ArgumentCaptor<Pageable> captor = ArgumentCaptor.forClass(Pageable.class);
        verify(repo).findAllByOrderByAtDesc(captor.capture());
        assertThat(captor.getValue().getPageNumber()).isZero();
        assertThat(captor.getValue().getPageSize()).isEqualTo(100);
    }

    @Test
    void unparsableStoredChangesDegradeToAnEmptyList() {
        AuditLog broken = new AuditLog(actor, "LOGIN", "USER", null, "Ada", null, null, "{not json", null);
        when(repo.findAllByOrderByAtDesc(any(Pageable.class))).thenReturn(new PageImpl<>(List.of(broken)));

        assertThat(service.page(null, 0, 10, false).items().get(0).changes()).isEmpty();
    }
}
