package app.partyplaner.image;

import app.partyplaner.common.CurrentUser;
import java.time.Duration;
import java.util.Map;
import java.util.UUID;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/** Upload and download of images. Download streams the stored file with long-lived cache headers. */
@RestController
@RequestMapping("/api/images")
public class ImageController {

    private final ImageService images;

    public ImageController(ImageService images) {
        this.images = images;
    }

    /** Stores an uploaded image and returns its id. */
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    ResponseEntity<Map<String, UUID>> upload(@AuthenticationPrincipal Jwt jwt, @RequestPart("file") MultipartFile file) {
        UUID id = images.store(CurrentUser.id(jwt), file);
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("id", id));
    }

    /** Streams an image of the signed-in user. */
    @GetMapping("/{id}")
    ResponseEntity<Resource> get(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        Image image = images.load(CurrentUser.id(jwt), id);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(image.getContentType()))
                // Ids are random and the bytes never change, so the browser may keep them for good.
                .cacheControl(CacheControl.maxAge(Duration.ofDays(365)).cachePrivate().immutable())
                .header("X-Content-Type-Options", "nosniff")
                .contentLength(image.getSizeBytes())
                .body(images.content(image));
    }
}
