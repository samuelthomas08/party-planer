package app.partyplaner.share;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import app.partyplaner.TestProps;
import app.partyplaner.TestUsers;
import app.partyplaner.audit.Actor;
import app.partyplaner.audit.AuditService;
import app.partyplaner.auth.JwtService;
import app.partyplaner.common.ApiException;
import app.partyplaner.place.Place;
import app.partyplaner.place.PlaceRepository;
import app.partyplaner.place.PlaceService;
import app.partyplaner.user.Role;
import app.partyplaner.user.UserRepository;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ShareServiceTest {

    @Mock ShareLinkRepository links;
    @Mock PlaceService placeService;
    @Mock PlaceRepository places;
    @Mock UserRepository users;
    @Mock AuditService audit;

    ShareService service;
    UUID owner = UUID.randomUUID();
    Place place = new Place(owner);

    @BeforeEach
    void setUp() {
        service = new ShareService(links, placeService, places, users, new JwtService(TestProps.props()), audit);
        place.update("Main hall", UUID.randomUUID(), UUID.randomUUID(), List.of());
        when(placeService.requireOwned(owner, place.getId())).thenReturn(place);
        when(places.findById(place.getId())).thenReturn(Optional.of(place));
        when(links.save(any(ShareLink.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    private ShareLink link(String token, Instant expires) {
        ShareLink l = new ShareLink(place.getId(), owner, token, expires);
        when(links.findByToken(token)).thenReturn(Optional.of(l));
        when(links.findById(l.getId())).thenReturn(Optional.of(l));
        return l;
    }

    private Jwt decode(String token) {
        return NimbusJwtDecoder.withSecretKey(new javax.crypto.spec.SecretKeySpec(TestProps.SECRET.getBytes(), "HmacSHA256"))
                .macAlgorithm(org.springframework.security.oauth2.jose.jws.MacAlgorithm.HS256).build().decode(token);
    }

    @Test
    void createsAHardToGuessTokenWithTheRequestedLifetime() {
        ShareDtos.ShareResponse a = service.create(owner, place.getId(), 24);
        ShareDtos.ShareResponse b = service.create(owner, place.getId(), null);

        assertThat(a.token()).hasSize(43).matches("[A-Za-z0-9_-]+").isNotEqualTo(b.token());
        assertThat(a.expiresAt()).isBetween(Instant.now().plus(Duration.ofHours(23)), Instant.now().plus(Duration.ofHours(25)));
        assertThat(b.expiresAt()).isNull();
        assertThat(a.active()).isTrue();
        verify(audit, org.mockito.Mockito.times(2)).record(eq("SHARE_CREATED"), eq("SHARE"), any(), any(), eq(place.getId()), any(), anyList());
    }

    @Test
    void theTokenNeverReachesTheAuditEntry() {
        service.create(owner, place.getId(), 24);

        ArgumentCaptor<List<app.partyplaner.audit.Change>> changes = ArgumentCaptor.forClass(List.class);
        verify(audit).record(eq("SHARE_CREATED"), any(), any(), any(), any(), any(), changes.capture());
        assertThat(changes.getValue().toString()).doesNotContain("token");
    }

    @Test
    void onlyTheOwnerMayManageLinks() {
        UUID stranger = UUID.randomUUID();
        when(placeService.requireOwned(stranger, place.getId())).thenThrow(ApiException.notFound("Place"));

        assertThatThrownBy(() -> service.create(stranger, place.getId(), 24)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> service.list(stranger, place.getId())).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> service.revoke(stranger, place.getId(), UUID.randomUUID())).isInstanceOf(ApiException.class);
        verify(links, never()).save(any());
    }

    @Test
    void revokingDeactivatesTheLinkAndIsRecordedOnce() {
        ShareLink l = link("tok", null);
        when(links.findByIdAndPlaceId(l.getId(), place.getId())).thenReturn(Optional.of(l));

        service.revoke(owner, place.getId(), l.getId());
        service.revoke(owner, place.getId(), l.getId());

        assertThat(l.isActive(Instant.now())).isFalse();
        verify(audit, org.mockito.Mockito.times(1)).record(eq("SHARE_REVOKED"), any(), any(), any(), any(), any(), anyList());
    }

    @Test
    void previewOfAnInvalidLinkIsA404() {
        ShareLink revoked = link("revoked", null);
        revoked.revoke();
        link("expired", Instant.now().minusSeconds(5));

        for (String token : new String[]{"unknown", "revoked", "expired"}) {
            assertThatThrownBy(() -> service.preview(token)).as(token).satisfies(t -> {
                assertThat(((ApiException) t).status()).isEqualTo(HttpStatus.NOT_FOUND);
                assertThat(((ApiException) t).code()).isEqualTo("SHARE_INVALID");
            });
        }
    }

    @Test
    void previewNamesThePlaceAndWhoSharedIt() {
        link("tok", null);
        when(users.findById(owner)).thenReturn(Optional.of(TestUsers.user("o@b.de", "pw", Role.USER)));

        ShareDtos.SharePreview preview = service.preview("tok");

        assertThat(preview.placeName()).isEqualTo("Main hall");
        assertThat(preview.sharedBy()).startsWith("Test");
    }

    @Test
    void aGuestSessionLastsEightHoursAtMost() {
        link("tok", null);

        ShareService.Joined joined = service.joinAsGuest("tok", "Gina");

        assertThat(joined.expiresAt()).isBetween(Instant.now().plus(Duration.ofHours(7)).plusSeconds(3000), Instant.now().plus(Duration.ofHours(8)).plusSeconds(5));
        Jwt jwt = decode(joined.guestToken());
        assertThat(jwt.getClaimAsString("typ")).isEqualTo("guest");
        assertThat(jwt.getClaimAsString("place")).isEqualTo(place.getId().toString());
        assertThat(jwt.getClaimAsString("name")).isEqualTo("Gina");
    }

    @Test
    void aGuestSessionNeverOutlivesTheLink() {
        Instant linkExpiry = Instant.now().plus(Duration.ofMinutes(30));
        link("tok", linkExpiry);

        ShareService.Joined joined = service.joinAsGuest("tok", "Gina");

        assertThat(joined.expiresAt()).isEqualTo(linkExpiry);
    }

    @Test
    void controlCharactersInTheGuestNameAreRemovedAndTheJoinIsAudited() {
        link("tok", null);

        ShareService.Joined joined = service.joinAsGuest("tok", "  Gi\nna\u0007  ");

        assertThat(joined.name()).isEqualTo("Gi na");
        ArgumentCaptor<Actor> actor = ArgumentCaptor.forClass(Actor.class);
        verify(audit).record(actor.capture(), eq("GUEST_JOINED"), any(), any(), any(), eq(place.getId()), any(), anyList());
        assertThat(actor.getValue().type()).isEqualTo("GUEST");
        assertThat(actor.getValue().name()).isEqualTo("Gi na");
    }

    @Test
    void joiningWithADeadLinkFails() {
        ShareLink l = link("tok", null);
        l.revoke();

        assertThatThrownBy(() -> service.joinAsGuest("tok", "Gina")).isInstanceOf(ApiException.class);
    }

    @Test
    void guestRequestsRecheckTheLinkEveryTime() {
        ShareLink l = link("tok", null);

        assertThat(service.requireActiveById(l.getId(), place.getId())).isSameAs(l);

        l.revoke();
        assertThatThrownBy(() -> service.requireActiveById(l.getId(), place.getId())).satisfies(t -> {
            assertThat(((ApiException) t).status()).isEqualTo(HttpStatus.UNAUTHORIZED);
            assertThat(((ApiException) t).code()).isEqualTo("SHARE_INVALID");
        });
    }

    @Test
    void aLinkCannotBeUsedForAnotherPlace() {
        ShareLink l = link("tok", null);

        assertThatThrownBy(() -> service.requireActiveById(l.getId(), UUID.randomUUID())).isInstanceOf(ApiException.class);
    }
}
