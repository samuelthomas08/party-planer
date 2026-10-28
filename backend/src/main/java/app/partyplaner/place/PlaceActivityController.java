package app.partyplaner.place;

import app.partyplaner.audit.AuditDtos.AuditEntry;
import app.partyplaner.audit.AuditDtos.PageResponse;
import app.partyplaner.audit.AuditService;
import app.partyplaner.common.CurrentUser;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Who changed what on one place, when and how. Visible to the place's owner and to every admin. */
@RestController
@RequestMapping("/api/places/{id}/activity")
public class PlaceActivityController {

    private final AuditService audit;
    private final PlaceService places;

    public PlaceActivityController(AuditService audit, PlaceService places) {
        this.audit = audit;
        this.places = places;
    }

    /** The change history of one place; owners and admins only. */
    @GetMapping
    PageResponse<AuditEntry> activity(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
                                      @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "30") int size) {
        boolean admin = "ADMIN".equals(jwt.getClaimAsString("role"));
        if (!admin) {
            places.requireOwned(CurrentUser.id(jwt), id);
        }
        return audit.page(id, page, size, admin);
    }
}
