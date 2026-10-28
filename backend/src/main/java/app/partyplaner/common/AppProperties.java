package app.partyplaner.common;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/** Typed application configuration ({@code app.*} in application.yml). */
@Validated
@ConfigurationProperties(prefix = "app")
public record AppProperties(boolean registrationEnabled, @Valid @NotNull Security security, @Valid @NotNull Storage storage) {

    /** Where uploaded images live on disk. Must be persistent and backed up together with the database. */
    public record Storage(@NotNull java.nio.file.Path imageDir) {
    }

    public record Security(
            @NotBlank @Size(min = 32, message = "JWT_SECRET must be at least 32 characters") String jwtSecret,
            @NotBlank String issuer,
            @NotNull Duration accessTokenTtl,
            @NotNull Duration refreshTokenTtl,
            boolean cookieSecure,
            @Min(1) int authRateLimitPerMinute) {
    }
}
