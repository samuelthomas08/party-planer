package app.partyplaner.logging;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import app.partyplaner.audit.AuditService;
import app.partyplaner.common.ApiException;
import app.partyplaner.logging.AdminLogController.LevelRequest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.boot.logging.LogLevel;
import org.springframework.boot.logging.LoggingSystem;

@ExtendWith(MockitoExtension.class)
class AdminLogControllerTest {

    @Mock LoggingSystem loggingSystem;
    @Mock AuditService audit;

    private AdminLogController controller() {
        return new AdminLogController(new LogBuffer(), loggingSystem, audit);
    }

    @Test
    void changesTheApplicationLogLevelAndAuditsIt() {
        var result = controller().setLevel(new LevelRequest("debug"));

        assertThat(result).containsEntry("level", "DEBUG");
        verify(loggingSystem).setLogLevel("app.partyplaner", LogLevel.DEBUG);
        verify(audit).record(eq("LOG_LEVEL_CHANGED"), eq("SYSTEM"), any(), eq("app.partyplaner"), any(), any(), anyList());
    }

    @Test
    void rejectsUnknownAndOverlyExtremeLevels() {
        AdminLogController controller = controller();

        for (String bad : new String[]{"LOUD", "", "TRACE", "OFF", "FATAL"}) {
            assertThatThrownBy(() -> controller.setLevel(new LevelRequest(bad))).as(bad).isInstanceOf(ApiException.class);
        }
        verify(loggingSystem, never()).setLogLevel(any(), any());
    }

    @Test
    void snapshotLimitIsClamped() {
        assertThat(controller().snapshot(-5)).isEmpty();
        assertThat(controller().snapshot(1_000_000)).isEmpty();
    }
}
