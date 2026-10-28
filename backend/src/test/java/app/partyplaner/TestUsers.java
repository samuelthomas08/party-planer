package app.partyplaner;

import app.partyplaner.user.Role;
import app.partyplaner.user.User;
import java.util.UUID;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

/** Small builders and fakes shared by the unit tests. */
public final class TestUsers {

    private TestUsers() {
    }

    /** A persisted-looking user (id assigned) whose password hash is {@code "enc:" + rawPassword}. */
    public static User user(String email, String rawPassword, Role role) {
        User u = new User(email, "enc:" + rawPassword, "Test " + email, role);
        ReflectionTestUtils.setField(u, "id", UUID.randomUUID());
        return u;
    }

    /** Deterministic, instant stand-in for Argon2: fast tests, but still never equal to the raw password. */
    public static class FakeEncoder implements PasswordEncoder {
        public int matchesCalls;

        @Override
        public String encode(CharSequence raw) {
            return "enc:" + raw;
        }

        @Override
        public boolean matches(CharSequence raw, String encoded) {
            matchesCalls++;
            return encoded.equals("enc:" + raw);
        }
    }
}
