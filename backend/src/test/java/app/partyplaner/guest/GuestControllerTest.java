package app.partyplaner.guest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import app.partyplaner.common.ApiException;
import app.partyplaner.equipment.Equipment;
import app.partyplaner.equipment.EquipmentCategory;
import app.partyplaner.equipment.EquipmentRepository;
import app.partyplaner.equipment.EquipmentSlot;
import app.partyplaner.image.Image;
import app.partyplaner.image.ImageRepository;
import app.partyplaner.image.ImageService;
import app.partyplaner.place.Place;
import app.partyplaner.place.PlaceRepository;
import app.partyplaner.share.ShareService;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.jwt.Jwt;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class GuestControllerTest {

    @Mock ShareService shares;
    @Mock PlaceRepository places;
    @Mock EquipmentRepository equipmentRepo;
    @Mock ImageRepository imageRepo;
    @Mock ImageService images;

    GuestController controller;
    UUID shareId = UUID.randomUUID();
    UUID floorPlan = UUID.randomUUID();
    UUID equipmentImage = UUID.randomUUID();
    Equipment used;
    Place place;
    Jwt guest;

    @BeforeEach
    void setUp() {
        controller = new GuestController(shares, places, equipmentRepo, imageRepo, images);
        used = new Equipment(UUID.randomUUID());
        used.update("Spot", "", EquipmentCategory.STAND, Map.of(EquipmentSlot.FOOT, equipmentImage));
        place = new Place(UUID.randomUUID());
        place.update("Shared", UUID.randomUUID(), floorPlan, List.of(
                new Place.MarkerData(null, used.getId(), 0.1, 0.1, "#000000"),
                new Place.MarkerData(null, null, 0.2, 0.2, "#000000")));
        when(places.findById(place.getId())).thenReturn(Optional.of(place));
        when(equipmentRepo.findAllById(Set.of(used.getId()))).thenReturn(List.of(used));
        guest = Jwt.withTokenValue("t").header("alg", "none").subject(UUID.randomUUID().toString()).issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(60)).claim("typ", "guest").claim("name", "Gina")
                .claim("share", shareId.toString()).claim("place", place.getId().toString()).build();
    }

    @Test
    void returnsThePlaceWithOnlyTheEquipmentItsMarkersUse() {
        var response = controller.place(guest);

        assertThat(response.guestName()).isEqualTo("Gina");
        assertThat(response.place().name()).isEqualTo("Shared");
        assertThat(response.equipment()).extracting(e -> e.title()).containsExactly("Spot");
        verify(shares).requireActiveById(shareId, place.getId());
    }

    @Test
    void aRevokedLinkEndsTheGuestSessionImmediately() {
        when(shares.requireActiveById(shareId, place.getId()))
                .thenThrow(new ApiException(HttpStatus.UNAUTHORIZED, "SHARE_INVALID", "gone"));

        assertThatThrownBy(() -> controller.place(guest)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> controller.image(guest, floorPlan)).isInstanceOf(ApiException.class);
    }

    @Test
    void servesTheFloorPlanAndImagesOfEquipmentUsedOnThePlace() {
        for (UUID id : new UUID[]{floorPlan, equipmentImage}) {
            Image image = new Image(id, UUID.randomUUID(), "image/png", 3, "ab/x.png");
            when(imageRepo.findById(id)).thenReturn(Optional.of(image));
            when(images.content(image)).thenReturn(new ByteArrayResource(new byte[]{1, 2, 3}));

            var response = controller.image(guest, id);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(response.getHeaders().getFirst("X-Content-Type-Options")).isEqualTo("nosniff");
            assertThat(response.getHeaders().getContentLength()).isEqualTo(3);
        }
    }

    @Test
    void anyOtherImageIsAnIndistinguishable404EvenIfItExists() {
        UUID foreign = UUID.randomUUID();
        when(imageRepo.findById(foreign)).thenReturn(Optional.of(new Image(foreign, UUID.randomUUID(), "image/png", 1, "ab/y.png")));

        assertThatThrownBy(() -> controller.image(guest, foreign)).satisfies(t ->
                assertThat(((ApiException) t).status()).isEqualTo(HttpStatus.NOT_FOUND));
        verify(imageRepo, never()).findById(foreign);
    }
}
