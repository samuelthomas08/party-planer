package app.partyplaner;

import app.partyplaner.common.AppProperties;
import java.nio.file.Path;
import java.time.Duration;

/** Builds {@link AppProperties} for unit tests without starting Spring. */
public final class TestProps {

    public static final String SECRET = "unit-test-secret-unit-test-secret-1234";

    private TestProps() {
    }

    public static AppProperties props() {
        return props(true, false, Path.of("target/test-images"));
    }

    public static AppProperties props(boolean registrationEnabled, boolean cookieSecure, Path imageDir) {
        return new AppProperties(registrationEnabled,
                new AppProperties.Security(SECRET, "test-issuer", Duration.ofMinutes(15), Duration.ofDays(14), cookieSecure, 10),
                new AppProperties.Storage(imageDir));
    }
}
