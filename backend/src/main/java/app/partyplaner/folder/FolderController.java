package app.partyplaner.folder;

import app.partyplaner.common.CurrentUser;
import app.partyplaner.folder.FolderDtos.FolderRequest;
import app.partyplaner.folder.FolderDtos.FolderResponse;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** CRUD endpoints for folders (the list includes each folder's places). */
@RestController
@RequestMapping("/api/folders")
public class FolderController {

    private final FolderService service;

    public FolderController(FolderService service) {
        this.service = service;
    }

    /** Folders with their places. */
    @GetMapping
    List<FolderResponse> list(@AuthenticationPrincipal Jwt jwt) {
        return service.list(CurrentUser.id(jwt));
    }

    /** Creates a folder. */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    FolderResponse create(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody FolderRequest body) {
        return service.create(CurrentUser.id(jwt), body.name());
    }

    /** Renames a folder. */
    @PatchMapping("/{id}")
    FolderResponse rename(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id, @Valid @RequestBody FolderRequest body) {
        return service.rename(CurrentUser.id(jwt), id, body.name());
    }

    /** Deletes a folder and its places. */
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        service.delete(CurrentUser.id(jwt), id);
    }
}
