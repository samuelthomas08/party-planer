package app.partyplaner.auth;

import app.partyplaner.auth.AuthDtos.LoginRequest;
import app.partyplaner.auth.AuthDtos.PasswordRequest;
import app.partyplaner.auth.AuthDtos.ProfileRequest;
import app.partyplaner.auth.AuthDtos.RegisterRequest;
import app.partyplaner.auth.AuthDtos.UserResponse;
import app.partyplaner.user.User;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Public and session endpoints: CSRF bootstrap, register, login, refresh, logout, current user, profile, password.
 * <p>Tokens are only ever transported in httpOnly cookies, never in response bodies.
 */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService auth;
    private final AuthCookies cookies;

    public AuthController(AuthService auth, AuthCookies cookies) {
        this.auth = auth;
        this.cookies = cookies;
    }

    /** Touching any GET endpoint makes Spring set the XSRF-TOKEN cookie; this one exists for clients without a cookie yet. */
    @GetMapping("/csrf")
    ResponseEntity<Void> csrf() {
        return ResponseEntity.noContent().build();
    }

    /** Self-service sign-up (the first account becomes admin; later ones need registration to be open). */
    @PostMapping("/register")
    ResponseEntity<UserResponse> register(@Valid @RequestBody RegisterRequest body) {
        return withSession(HttpStatus.CREATED, auth.register(body.email(), body.password(), body.displayName()));
    }

    /** Signs in and sets the token cookies. */
    @PostMapping("/login")
    ResponseEntity<UserResponse> login(@Valid @RequestBody LoginRequest body) {
        return withSession(HttpStatus.OK, auth.login(body.email(), body.password()));
    }

    /** Rotates the refresh token and issues a new access token; clears both cookies if the session is no longer valid. */
    @PostMapping("/refresh")
    ResponseEntity<UserResponse> refresh(HttpServletRequest request) {
        try {
            return withSession(HttpStatus.OK, auth.refresh(AuthCookies.read(request, AuthCookies.REFRESH)));
        } catch (app.partyplaner.common.ApiException e) {
            return ResponseEntity.status(e.status())
                    .header(HttpHeaders.SET_COOKIE, cookies.clearAccess().toString())
                    .header(HttpHeaders.SET_COOKIE, cookies.clearRefresh().toString())
                    .build();
        }
    }

    /** Revokes the current session family and clears the cookies. */
    @PostMapping("/logout")
    ResponseEntity<Void> logout(HttpServletRequest request) {
        auth.logout(AuthCookies.read(request, AuthCookies.REFRESH));
        return ResponseEntity.noContent()
                .header(HttpHeaders.SET_COOKIE, cookies.clearAccess().toString())
                .header(HttpHeaders.SET_COOKIE, cookies.clearRefresh().toString())
                .build();
    }

    /** The signed-in user. */
    @GetMapping("/me")
    UserResponse me(@AuthenticationPrincipal Jwt jwt) {
        return toResponse(auth.currentUser(UUID.fromString(jwt.getSubject())));
    }

    /** Changes the display name. */
    @PatchMapping("/profile")
    UserResponse profile(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody ProfileRequest body) {
        return toResponse(auth.updateProfile(UUID.fromString(jwt.getSubject()), body.displayName()));
    }

    /** Changes the password, ends all other sessions and returns a fresh session for this device. */
    @PostMapping("/password")
    ResponseEntity<UserResponse> password(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody PasswordRequest body) {
        return withSession(HttpStatus.OK,
                auth.changePassword(UUID.fromString(jwt.getSubject()), body.currentPassword(), body.newPassword()));
    }

    /** Builds a response that sets both token cookies. */
    private ResponseEntity<UserResponse> withSession(HttpStatus status, AuthService.Session session) {
        return ResponseEntity.status(status)
                .header(HttpHeaders.SET_COOKIE, cookies.access(session.accessToken()).toString())
                .header(HttpHeaders.SET_COOKIE, cookies.refresh(session.refreshToken()).toString())
                .body(toResponse(session.user()));
    }

    private static UserResponse toResponse(User user) {
        return new UserResponse(user.getId(), user.getEmail(), user.getDisplayName(), user.getRole().name());
    }
}
