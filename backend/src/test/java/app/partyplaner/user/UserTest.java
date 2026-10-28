package app.partyplaner.user;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.time.Instant;
import org.junit.jupiter.api.Test;

class UserTest {

    private static final Duration LOCK = Duration.ofMinutes(15);

    private User user() {
        return new User("a@b.de", "hash", "Ada", Role.USER);
    }

    @Test
    void startsEnabledUnlockedWithTheGivenRole() {
        User u = new User("a@b.de", "hash", "Ada", Role.ADMIN);

        assertThat(u.isEnabled()).isTrue();
        assertThat(u.isLocked(Instant.now())).isFalse();
        assertThat(u.getRole()).isEqualTo(Role.ADMIN);
        assertThat(u.getFailedLoginAttempts()).isZero();
    }

    @Test
    void locksAfterTheConfiguredNumberOfFailuresAndResetsTheCounter() {
        User u = user();
        Instant now = Instant.now();

        for (int i = 0; i < 4; i++) {
            u.registerFailedLogin(5, LOCK, now);
        }
        assertThat(u.isLocked(now)).isFalse();
        assertThat(u.getFailedLoginAttempts()).isEqualTo(4);

        u.registerFailedLogin(5, LOCK, now);

        assertThat(u.isLocked(now)).isTrue();
        assertThat(u.getLockedUntil()).isEqualTo(now.plus(LOCK));
        assertThat(u.getFailedLoginAttempts()).isZero();
    }

    @Test
    void theLockExpires() {
        User u = user();
        Instant now = Instant.now();
        for (int i = 0; i < 5; i++) u.registerFailedLogin(5, LOCK, now);

        assertThat(u.isLocked(now.plus(LOCK).minusSeconds(1))).isTrue();
        assertThat(u.isLocked(now.plus(LOCK).plusSeconds(1))).isFalse();
    }

    @Test
    void aSuccessfulLoginClearsFailuresAndLock() {
        User u = user();
        Instant now = Instant.now();
        for (int i = 0; i < 5; i++) u.registerFailedLogin(5, LOCK, now);

        u.registerSuccessfulLogin();

        assertThat(u.isLocked(now)).isFalse();
        assertThat(u.getFailedLoginAttempts()).isZero();
    }

    @Test
    void unlockClearsTheLockAndTheCounter() {
        User u = user();
        Instant now = Instant.now();
        for (int i = 0; i < 5; i++) u.registerFailedLogin(5, LOCK, now);

        u.unlock();

        assertThat(u.isLocked(now)).isFalse();
    }
}
