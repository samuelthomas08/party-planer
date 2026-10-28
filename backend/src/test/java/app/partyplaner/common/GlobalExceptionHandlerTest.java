package app.partyplaner.common;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.core.MethodParameter;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.validation.BeanPropertyBindingResult;
import org.springframework.validation.FieldError;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

class GlobalExceptionHandlerTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    void apiExceptionsKeepTheirStatusAndStableCode() {
        ResponseEntity<ErrorResponse> response = handler.api(new ApiException(HttpStatus.CONFLICT, "EMAIL_TAKEN", "taken"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(response.getBody().code()).isEqualTo("EMAIL_TAKEN");
    }

    @Test
    void convenienceFactoriesBuild404And400() {
        assertThat(ApiException.notFound("Place").status()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(ApiException.notFound("Place").code()).isEqualTo("NOT_FOUND");
        assertThat(ApiException.badRequest("X", "y").status()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void validationErrorsAreReportedPerFieldWithTheFirstMessageWinning() throws Exception {
        BeanPropertyBindingResult binding = new BeanPropertyBindingResult(new Object(), "request");
        binding.addError(new FieldError("request", "email", "must be a well-formed email address"));
        binding.addError(new FieldError("request", "email", "second message"));
        binding.addError(new FieldError("request", "password", "PASSWORD_LENGTH"));
        MethodParameter parameter = new MethodParameter(Object.class.getMethod("toString"), -1);

        ResponseEntity<ErrorResponse> response = handler.validation(new MethodArgumentNotValidException(parameter, binding));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody().code()).isEqualTo("VALIDATION_FAILED");
        assertThat(response.getBody().fields()).containsExactlyInAnyOrderEntriesOf(
                Map.of("email", "must be a well-formed email address", "password", "PASSWORD_LENGTH"));
    }

    @Test
    void tooLargeUploadsAnswer413() {
        ResponseEntity<ErrorResponse> response = handler.tooLarge(new MaxUploadSizeExceededException(1));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONTENT_TOO_LARGE);
        assertThat(response.getBody().code()).isEqualTo("IMAGE_TOO_LARGE");
    }

    @Test
    void accessDeniedAnswers403() {
        assertThat(handler.denied(new AccessDeniedException("x")).getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    void springWebExceptionsKeepTheirOwnStatus() {
        ResponseEntity<ErrorResponse> response = handler.other(new HttpRequestMethodNotSupportedException("DELETE"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.METHOD_NOT_ALLOWED);
    }

    @Test
    void unexpectedErrorsAnswer500WithoutLeakingAnyDetail() {
        ResponseEntity<ErrorResponse> response = handler.other(new IllegalStateException("jdbc:postgresql://secret-host password=hunter2"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
        assertThat(response.getBody().code()).isEqualTo("INTERNAL_ERROR");
        assertThat(response.getBody().toString()).doesNotContain("secret-host").doesNotContain("hunter2");
    }
}
