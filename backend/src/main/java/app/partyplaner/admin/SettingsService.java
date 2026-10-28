package app.partyplaner.admin;

import app.partyplaner.common.AppProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Settings an admin can change at runtime; the property file only provides the defaults. */
@Service
public class SettingsService {

    private static final Logger log = LoggerFactory.getLogger(SettingsService.class);
    private static final String REGISTRATION = "registration_enabled";

    private final AppSettingRepository repo;
    private final AppProperties props;

    public SettingsService(AppSettingRepository repo, AppProperties props) {
        this.repo = repo;
        this.props = props;
    }

    /** Whether people may sign up on their own (database value, falling back to the property default). */
    @Transactional(readOnly = true)
    public boolean registrationEnabled() {
        return repo.findById(REGISTRATION).map(s -> Boolean.parseBoolean(s.getValue())).orElse(props.registrationEnabled());
    }

    /** Persists the registration switch. */
    @Transactional
    public void setRegistrationEnabled(boolean enabled) {
        AppSetting setting = repo.findById(REGISTRATION).orElseGet(() -> new AppSetting(REGISTRATION, "true"));
        setting.setValue(Boolean.toString(enabled));
        repo.save(setting);
        log.info("SETTINGS_REGISTRATION_CHANGED enabled={}", enabled);
    }
}
