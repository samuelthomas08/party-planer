package app.partyplaner.equipment;

import app.partyplaner.common.CurrentUser;
import app.partyplaner.equipment.EquipmentDtos.EquipmentRequest;
import app.partyplaner.equipment.EquipmentDtos.EquipmentResponse;
import jakarta.validation.Valid;
import java.util.List;
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

/** CRUD endpoints for the signed-in user's equipment. */
@RestController
@RequestMapping("/api/equipment")
public class EquipmentController {

    private final EquipmentService service;

    public EquipmentController(EquipmentService service) {
        this.service = service;
    }

    /** All equipment of the user. */
    @GetMapping
    List<EquipmentResponse> list(@AuthenticationPrincipal Jwt jwt) {
        return service.list(CurrentUser.id(jwt));
    }

    /** One piece of equipment. */
    @GetMapping("/{id}")
    EquipmentResponse get(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return service.get(CurrentUser.id(jwt), id);
    }

    /** Creates equipment. */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    EquipmentResponse create(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody EquipmentRequest body) {
        return service.create(CurrentUser.id(jwt), body);
    }

    /** Replaces title, description, category and images. */
    @PutMapping("/{id}")
    EquipmentResponse update(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id, @Valid @RequestBody EquipmentRequest body) {
        return service.update(CurrentUser.id(jwt), id, body);
    }

    /** Deletes equipment; markers that used it are left without assignment. */
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        service.delete(CurrentUser.id(jwt), id);
    }
}
