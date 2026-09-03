package msplayer.newpipe;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import org.schabi.newpipe.extractor.Image;
import org.schabi.newpipe.extractor.InfoItem;
import org.schabi.newpipe.extractor.NewPipe;
import org.schabi.newpipe.extractor.ServiceList;
import org.schabi.newpipe.extractor.downloader.Downloader;
import org.schabi.newpipe.extractor.downloader.Request;
import org.schabi.newpipe.extractor.downloader.Response;
import org.schabi.newpipe.extractor.search.SearchInfo;
import org.schabi.newpipe.extractor.stream.AudioStream;
import org.schabi.newpipe.extractor.stream.StreamInfo;
import org.schabi.newpipe.extractor.stream.StreamInfoItem;
import org.schabi.newpipe.extractor.stream.VideoStream;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.URLDecoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

public class NewPipeService {
    public static void main(String[] args) throws IOException {
        NewPipe.init(new JavaNetDownloader());

        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 7071), 0);
        server.createContext("/search", exchange -> {
            try {
                Map<String, String> query = queryParams(exchange);
                writeJson(exchange, 200, searchJson(query.getOrDefault("q", "")));
            } catch (Exception exception) {
                writeJson(exchange, 500, "{\"message\":\"" + escape(exception.getMessage()) + "\",\"results\":[]}");
            }
        });
        server.createContext("/details", exchange -> {
            try {
                Map<String, String> query = queryParams(exchange);
                writeJson(exchange, 200, detailsJson(query.getOrDefault("url", "")));
            } catch (Exception exception) {
                writeJson(exchange, 500, "{\"message\":\"" + escape(exception.getMessage()) + "\"}");
            }
        });
        server.start();
        System.out.println("MS Player NewPipe service listening on http://127.0.0.1:7071");
    }

    private static String searchJson(String query) throws Exception {
        if (query == null || query.isBlank()) {
            return "{\"results\":[]}";
        }

        SearchInfo info = SearchInfo.getInfo(ServiceList.YouTube, ServiceList.YouTube.getSearchQHFactory().fromQuery(query));
        List<String> results = new ArrayList<>();

        for (InfoItem item : info.getRelatedItems()) {
            if (item instanceof StreamInfoItem) {
                StreamInfoItem stream = (StreamInfoItem) item;
                results.add("{"
                        + "\"id\":\"" + escape(videoIdFromUrl(stream.getUrl())) + "\","
                        + "\"title\":\"" + escape(stream.getName()) + "\","
                        + "\"uploader\":\"" + escape(nullToEmpty(stream.getUploaderName())) + "\","
                        + "\"url\":\"" + escape(stream.getUrl()) + "\","
                        + "\"thumbnail_url\":\"" + escape(firstImageUrl(stream.getThumbnails())) + "\","
                        + "\"duration_seconds\":" + Math.max(0, stream.getDuration())
                        + "}");
            }

            if (results.size() >= 12) {
                break;
            }
        }

        return "{\"results\":[" + String.join(",", results) + "]}";
    }

    private static String detailsJson(String url) throws Exception {
        if (url == null || url.isBlank()) {
            throw new IllegalArgumentException("Missing URL.");
        }

        StreamInfo info = StreamInfo.getInfo(url);
        PlayableStream audioStream = firstAudioStream(info);
        PlayableStream videoStream = firstVideoStream(info);

        PlayableStream defaultStream = !audioStream.url.isEmpty() ? audioStream : videoStream;

        return "{"
                + "\"id\":\"" + escape(videoIdFromUrl(url)) + "\","
                + "\"title\":\"" + escape(info.getName()) + "\","
                + "\"uploader\":\"" + escape(nullToEmpty(info.getUploaderName())) + "\","
                + "\"url\":\"" + escape(url) + "\","
                + "\"thumbnail_url\":\"" + escape(firstImageUrl(info.getThumbnails())) + "\","
                + "\"duration_seconds\":" + Math.max(0, info.getDuration()) + ","
                + "\"stream_url\":\"" + escape(defaultStream.url) + "\","
                + "\"stream_type\":\"" + escape(defaultStream.type) + "\","
                + "\"mime_type\":\"" + escape(defaultStream.mimeType) + "\","
                + "\"audio_stream_url\":\"" + escape(audioStream.url) + "\","
                + "\"audio_mime_type\":\"" + escape(audioStream.mimeType) + "\","
                + "\"video_stream_url\":\"" + escape(videoStream.url) + "\","
                + "\"video_mime_type\":\"" + escape(videoStream.mimeType) + "\""
                + "}";
    }

    private static PlayableStream firstAudioStream(StreamInfo info) {
        for (AudioStream stream : info.getAudioStreams()) {
            if (stream.isUrl()) {
                String mime = stream.getFormat() != null && stream.getFormat().getName().toLowerCase().contains("webm")
                        ? "audio/webm"
                        : "audio/mp4";
                return new PlayableStream(stream.getContent(), "audio", mime);
            }
        }
        return new PlayableStream("", "audio", "audio/mp4");
    }

    private static PlayableStream firstVideoStream(StreamInfo info) {
        for (VideoStream stream : info.getVideoStreams()) {
            if (stream.isUrl()) {
                String mime = stream.getFormat() != null && stream.getFormat().getName().toLowerCase().contains("webm")
                        ? "video/webm"
                        : "video/mp4";
                return new PlayableStream(stream.getContent(), "video", mime);
            }
        }
        for (VideoStream stream : info.getVideoOnlyStreams()) {
            if (stream.isUrl()) {
                String mime = stream.getFormat() != null && stream.getFormat().getName().toLowerCase().contains("webm")
                        ? "video/webm"
                        : "video/mp4";
                return new PlayableStream(stream.getContent(), "video", mime);
            }
        }
        return new PlayableStream("", "video", "video/mp4");
    }

    private static String firstImageUrl(List<Image> images) {
        if (images == null || images.isEmpty()) {
            return "";
        }

        return images.get(0).getUrl();
    }

    private static String videoIdFromUrl(String url) {
        if (url == null) {
            return "";
        }

        int marker = url.indexOf("v=");
        if (marker >= 0) {
            String id = url.substring(marker + 2);
            int amp = id.indexOf('&');
            return amp >= 0 ? id.substring(0, amp) : id;
        }

        int slash = url.lastIndexOf('/');
        return slash >= 0 ? url.substring(slash + 1) : url;
    }

    private static Map<String, String> queryParams(HttpExchange exchange) {
        Map<String, String> params = new HashMap<>();
        String rawQuery = exchange.getRequestURI().getRawQuery();

        if (rawQuery == null || rawQuery.isEmpty()) {
            return params;
        }

        for (String pair : rawQuery.split("&")) {
            String[] parts = pair.split("=", 2);
            params.put(decode(parts[0]), parts.length > 1 ? decode(parts[1]) : "");
        }

        return params;
    }

    private static String decode(String value) {
        return URLDecoder.decode(value, StandardCharsets.UTF_8);
    }

    private static void writeJson(HttpExchange exchange, int status, String json) throws IOException {
        byte[] bytes = json.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().add("Content-Type", "application/json; charset=utf-8");
        exchange.sendResponseHeaders(status, bytes.length);

        try (OutputStream body = exchange.getResponseBody()) {
            body.write(bytes);
        }
    }

    private static String nullToEmpty(String value) {
        return value == null ? "" : value;
    }

    private static String escape(String value) {
        return nullToEmpty(value)
                .replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "");
    }

    private static class JavaNetDownloader extends Downloader {
        private final HttpClient client = HttpClient.newBuilder()
                .followRedirects(HttpClient.Redirect.NORMAL)
                .connectTimeout(Duration.ofSeconds(20))
                .build();

        @Override
        public Response execute(Request request) throws IOException {
            try {
                HttpRequest.Builder builder = HttpRequest.newBuilder()
                        .uri(URI.create(request.url()))
                        .timeout(Duration.ofSeconds(30));

                Map<String, List<String>> headers = request.headers();
                if (headers != null) {
                    headers.forEach((key, values) -> {
                        if (key != null && values != null) {
                            values.forEach(value -> builder.header(key, value));
                        }
                    });
                }

                builder.header("User-Agent", "Mozilla/5.0 MSPlayer NewPipeService");

                if (request.httpMethod().equalsIgnoreCase("POST")) {
                    byte[] body = request.dataToSend() == null ? new byte[0] : request.dataToSend();
                    builder.POST(HttpRequest.BodyPublishers.ofByteArray(body));
                } else if (request.httpMethod().equalsIgnoreCase("HEAD")) {
                    builder.method("HEAD", HttpRequest.BodyPublishers.noBody());
                } else {
                    builder.GET();
                }

                HttpResponse<String> response = client.send(builder.build(), HttpResponse.BodyHandlers.ofString());
                Map<String, List<String>> responseHeaders = response.headers().map();

                return new Response(
                        response.statusCode(),
                        "",
                        responseHeaders,
                        response.body(),
                        response.uri().toString()
                );
            } catch (InterruptedException exception) {
                Thread.currentThread().interrupt();
                throw new IOException(exception);
            }
        }
    }

    private static class PlayableStream {
        private final String url;
        private final String type;
        private final String mimeType;

        private PlayableStream(String url, String type, String mimeType) {
            this.url = url;
            this.type = type;
            this.mimeType = mimeType;
        }
    }
}
