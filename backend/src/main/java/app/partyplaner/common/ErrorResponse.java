package app.partyplaner.common;

import java.util.Map;

/** Uniform error body. {@code code} is a stable machine-readable key the frontend translates. */
public record ErrorResponse(String code, String message, Map<String, String> fields) {

    public static ErrorResponse of(String code, String message) {
        return new ErrorResponse(code, message, null);
    }
}
