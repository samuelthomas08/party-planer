package app.partyplaner.common;

import jakarta.validation.ConstraintViolationException;
import java.util.LinkedHashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;

/**
 * Turns exceptions into uniform {@link ErrorResponse} bodies and logs them with a stable event code.
 * Unexpected errors never leak details to the client.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    /** Expected client errors. */
    @ExceptionHandler(ApiException.class)
    ResponseEntity<ErrorResponse> api(ApiException e) {
        log.info("API_REJECTED status={} code={} message=\"{}\"", e.status().value(), e.code(), e.getMessage());
        return ResponseEntity.status(e.status()).body(ErrorResponse.of(e.code(), e.getMessage()));
    }

    /** Bean-validation failures, reported per field. */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ErrorResponse> validation(MethodArgumentNotValidException e) {
        Map<String, String> fields = new LinkedHashMap<>();
        e.getBindingResult().getFieldErrors().forEach(f -> fields.putIfAbsent(f.getField(), f.getDefaultMessage()));
        log.info("API_VALIDATION_FAILED fields={}", fields.keySet());
        return ResponseEntity.badRequest().body(new ErrorResponse("VALIDATION_FAILED", "Validation failed", fields));
    }

    /** Other validation failures. */
    @ExceptionHandler(ConstraintViolationException.class)
    ResponseEntity<ErrorResponse> constraint(ConstraintViolationException e) {
        return ResponseEntity.badRequest().body(ErrorResponse.of("VALIDATION_FAILED", "Validation failed"));
    }

    /** Malformed JSON or a missing multipart part. */
    @ExceptionHandler({HttpMessageNotReadableException.class, MissingServletRequestPartException.class})
    ResponseEntity<ErrorResponse> unreadable(Exception e) {
        log.info("API_BAD_REQUEST reason={}", e.getClass().getSimpleName());
        return ResponseEntity.badRequest().body(ErrorResponse.of("BAD_REQUEST", "Malformed request"));
    }

    /** Upload above the configured size limit. */
    @ExceptionHandler(MaxUploadSizeExceededException.class)
    ResponseEntity<ErrorResponse> tooLarge(MaxUploadSizeExceededException e) {
        return ResponseEntity.status(HttpStatus.CONTENT_TOO_LARGE)
                .body(ErrorResponse.of("IMAGE_TOO_LARGE", "The file is too large"));
    }

    /** Authorisation failures raised inside controllers. */
    @ExceptionHandler(AccessDeniedException.class)
    ResponseEntity<ErrorResponse> denied(AccessDeniedException e) {
        log.warn("API_FORBIDDEN");
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(ErrorResponse.of("FORBIDDEN", "Forbidden"));
    }

    /** Everything else; logged with its stack trace, answered with a generic 500. */
    @ExceptionHandler(Exception.class)
    ResponseEntity<ErrorResponse> other(Exception e) {
        if (e instanceof org.springframework.web.ErrorResponse er) {
            return ResponseEntity.status(er.getStatusCode()).body(ErrorResponse.of("HTTP_ERROR", "Request failed"));
        }
        log.error("Unhandled exception", e);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ErrorResponse.of("INTERNAL_ERROR", "Something went wrong"));
    }
}
