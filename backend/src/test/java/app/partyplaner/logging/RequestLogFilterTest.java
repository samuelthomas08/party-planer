package app.partyplaner.logging;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.slf4j.MDC;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class RequestLogFilterTest {

    private final RequestLogFilter filter = new RequestLogFilter();

    private MockHttpServletResponse run(String incomingId, AtomicReference<String> mdcDuringRequest) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/folders");
        request.setRequestURI("/api/folders");
        if (incomingId != null) request.addHeader("X-Request-Id", incomingId);
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request, response, (req, res) -> mdcDuringRequest.set(MDC.get("requestId")));
        return response;
    }

    @Test
    void generatesARequestIdExposesItAndMakesItAvailableToLoggingDuringTheRequest() throws Exception {
        AtomicReference<String> seen = new AtomicReference<>();

        MockHttpServletResponse response = run(null, seen);

        assertThat(seen.get()).hasSize(8);
        assertThat(response.getHeader("X-Request-Id")).isEqualTo(seen.get());
    }

    @Test
    void adoptsAWellFormedIncomingId() throws Exception {
        AtomicReference<String> seen = new AtomicReference<>();

        run("trace-1234-abcd", seen);

        assertThat(seen.get()).isEqualTo("trace-1234-abcd");
    }

    @Test
    void replacesMaliciousIncomingIdsInsteadOfLoggingThem() throws Exception {
        AtomicReference<String> seen = new AtomicReference<>();

        run("evil\nINFO forged", seen);

        assertThat(seen.get()).isNotEqualTo("evil\nINFO forged").matches("[A-Za-z0-9-]{8}");
    }

    @Test
    void clearsTheMdcWhenTheRequestIsDone() throws Exception {
        run(null, new AtomicReference<>());

        assertThat(MDC.get("requestId")).isNull();
        assertThat(MDC.get("user")).isNull();
    }
}
