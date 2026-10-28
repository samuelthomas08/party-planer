package app.partyplaner.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.UUID;

/** Request / response bodies of the auth endpoints. */
public final class AuthDtos {

    private AuthDtos() {
    }

    public record RegisterRequest(
            @NotBlank @Email @Size(max = 254) String email,
            @NotBlank @Size(min = 10, max = 128, message = "PASSWORD_LENGTH") String password,
            @NotBlank @Size(max = 80) String displayName) {
    }

    public record LoginRequest(
            @NotBlank @Size(max = 254) String email,
            @NotBlank @Size(max = 128) String password) {
    }

    public record UserResponse(UUID id, String email, String displayName, String role) {
    }

    public record ProfileRequest(@NotBlank @Size(max = 80) String displayName) {
    }

    public record PasswordRequest(
            @NotBlank @Size(max = 128) String currentPassword,
            @NotBlank @Size(min = 10, max = 128, message = "PASSWORD_LENGTH") String newPassword) {
    }
}
