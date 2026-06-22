# NewPipeExtractor Service Adapter

This folder is a small Java adapter intended to run beside Laravel. It is wired to
the official TeamNewPipe/NewPipeExtractor library after the extractor is built
locally.

MS Player calls it through `NEWPIPE_SERVICE_URL` for:

- `GET /search?q=...`
- `GET /details?url=...`

The Laravel app imports selected YouTube results as catalog references. It does not bulk download copyrighted content.

## Runtime expectation

The adapter uses TeamNewPipe/NewPipeExtractor. Because the extractor's Gradle
wrapper requires Java 17 while the library compiles with Java 11, this workspace
uses:

- Portable JDK 17 at `C:\tmp\jdk17\jdk-17.0.19+10`
- Existing JDK 11 at `C:\Users\Production\AppData\Local\Programs\Eclipse Adoptium\jdk-11.0.29.7-hotspot`

Recommended production setup:

1. Build NewPipeExtractor:
   `tools\NewPipeExtractor\gradlew.bat -p tools\NewPipeExtractor publishReleasePublicationToLocalRepository -x test -x checkstyleMain`
2. Run this service:
   `tools\NewPipeExtractor\gradlew.bat -p tools\newpipe-service run`
3. Keep `NEWPIPE_SERVICE_URL=http://127.0.0.1:7071` in Laravel `.env`.

## API contract

Search response:

```json
{
  "results": [
    {
      "id": "youtube-video-id",
      "title": "Song title",
      "uploader": "Artist or channel",
      "url": "https://www.youtube.com/watch?v=...",
      "thumbnail_url": "https://...",
      "duration_seconds": 240
    }
  ]
}
```

Details response:

```json
{
  "id": "youtube-video-id",
  "title": "Song title",
  "uploader": "Artist or channel",
  "url": "https://www.youtube.com/watch?v=...",
  "thumbnail_url": "https://...",
  "duration_seconds": 240,
  "stream_url": "https://..."
}
```
