package app.partyplaner.image;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Base64;
import org.junit.jupiter.api.Test;

class ImageServiceSniffTest {

    private static final byte[] PNG = Base64.getDecoder().decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==");

    @Test
    void recognisesPng() {
        assertThat(ImageService.sniff(PNG)).isEqualTo("image/png");
    }

    @Test
    void recognisesJpeg() {
        assertThat(ImageService.sniff(new byte[]{(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0, 0, 0})).isEqualTo("image/jpeg");
    }

    @Test
    void recognisesWebp() {
        byte[] webp = "RIFF\0\0\0\0WEBPVP8 ".getBytes();
        assertThat(ImageService.sniff(webp)).isEqualTo("image/webp");
    }

    @Test
    void rejectsSvgHtmlAndGif() {
        assertThat(ImageService.sniff("<svg xmlns='http://www.w3.org/2000/svg'/>".getBytes())).isNull();
        assertThat(ImageService.sniff("<html><script>alert(1)</script>".getBytes())).isNull();
        assertThat(ImageService.sniff("GIF89a......".getBytes())).isNull();
    }

    @Test
    void rejectsTooShortAndEmptyInput() {
        assertThat(ImageService.sniff(new byte[0])).isNull();
        assertThat(ImageService.sniff(new byte[]{(byte) 0x89, 'P'})).isNull();
        assertThat(ImageService.sniff("RIFF....WEB".getBytes())).isNull();
    }

    @Test
    void ignoresAFakeExtensionOrContentTypeBecauseOnlyBytesCount() {
        // an HTML payload pretending to be a PNG is still rejected: the sniffer never sees a file name
        assertThat(ImageService.sniff("<!doctype html>".getBytes())).isNull();
    }
}
