package app.partyplaner.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import app.partyplaner.TestProps;
import java.nio.file.Path;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class SettingsServiceTest {

    @Mock AppSettingRepository repo;

    @Test
    void fallsBackToThePropertyDefaultWhenNothingIsStored() {
        when(repo.findById("registration_enabled")).thenReturn(Optional.empty());

        assertThat(new SettingsService(repo, TestProps.props(true, false, Path.of("x"))).registrationEnabled()).isTrue();
        assertThat(new SettingsService(repo, TestProps.props(false, false, Path.of("x"))).registrationEnabled()).isFalse();
    }

    @Test
    void aStoredValueWinsOverTheDefault() {
        when(repo.findById("registration_enabled")).thenReturn(Optional.of(new AppSetting("registration_enabled", "false")));

        assertThat(new SettingsService(repo, TestProps.props(true, false, Path.of("x"))).registrationEnabled()).isFalse();
    }

    @Test
    void savingCreatesTheRowWhenMissing() {
        when(repo.findById("registration_enabled")).thenReturn(Optional.empty());

        new SettingsService(repo, TestProps.props()).setRegistrationEnabled(false);

        ArgumentCaptor<AppSetting> saved = ArgumentCaptor.forClass(AppSetting.class);
        verify(repo).save(saved.capture());
        assertThat(saved.getValue().getValue()).isEqualTo("false");
    }

    @Test
    void savingUpdatesTheExistingRow() {
        AppSetting existing = new AppSetting("registration_enabled", "false");
        when(repo.findById("registration_enabled")).thenReturn(Optional.of(existing));

        new SettingsService(repo, TestProps.props()).setRegistrationEnabled(true);

        assertThat(existing.getValue()).isEqualTo("true");
        verify(repo).save(any(AppSetting.class));
    }
}
