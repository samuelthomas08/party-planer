package app.partyplaner.place;

import app.partyplaner.common.CurrentUser;
import app.partyplaner.place.PlaceDtos.PlaceRequest;
import app.partyplaner.place.PlaceDtos.PlaceResponse;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** CRUD endpoints for the signed-in user's places. */
@RestController
@RequestMapping("/api/places")
public class PlaceController {

    private final PlaceService service;

    public PlaceController(PlaceService service) {
        this.service = service;
    }

    /** One place with its markers. */
    @GetMapping("/{id}")
    PlaceResponse get(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return service.get(CurrentUser.id(jwt), id);
    }

    /** Creates a place. */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    PlaceResponse create(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody PlaceRequest body) {
        return service.create(CurrentUser.id(jwt), body);
    }

    /** Replaces name, folder, floor plan and markers. */
    @PutMapping("/{id}")
    PlaceResponse update(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id, @Valid @RequestBody PlaceRequest body) {
        return service.update(CurrentUser.id(jwt), id, body);
    }

    /** Deletes a place and its floor-plan image. */
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        service.delete(CurrentUser.id(jwt), id);
    }
}
