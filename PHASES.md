# MS Player Build Phases

## Phase 1: Foundation

Status: complete

- Laravel 12 backend scaffolded.
- React frontend wired through Vite.
- SQLite development database configured.
- Public storage link created for uploaded covers and media files.

## Phase 2: Upload And Streaming MVP

Status: complete

- `media_items` table added for audio and video uploads.
- Upload API supports title, artist, album, genre, description, media file, and cover image.
- Library API supports listing, filtering by type, and search.
- Streaming endpoint supports HTTP range requests for fast audio/video seeking.

## Phase 3: Modern Responsive UI

Status: complete

- Clean non-neon interface inspired by Spotify and YouTube Music.
- Desktop sidebar navigation.
- Mobile bottom navigation.
- Home, search, library, and upload views.
- Persistent audio/video player.

## Phase 4: Authentication And Admin Uploads

Status: complete

- Added Laravel Sanctum token authentication.
- Added register, login, current-user, and logout API endpoints.
- First registered user automatically becomes the admin uploader.
- Upload API now requires an authenticated admin account.
- React UI now includes login/register/logout controls.
- Upload studio is locked for guests and listener accounts.
- Feature tests cover first-user admin assignment, listener upload rejection, and admin upload success.

## Phase 5: Playlists, Likes, And Listening History

Status: complete

- Added liked songs/videos.
- Added listening history with play counts and last played timestamps.
- Added playlist creation.
- Added playlist item add/remove behavior.
- Added protected API endpoints for account library actions.

## Phase 6: Artists And Albums

Status: complete

- Added artist grouping API.
- Added album grouping API.
- Added React catalog pages for artists and albums.

## Phase 7: Video Theater

Status: complete

- Added video theater API.
- Added large video playback page with related video queue.
- Video tiles now open theater mode.

## Phase 8: Media Metadata

Status: complete

- Added duration fields.
- Added generated waveform seed metadata for uploads.
- Added processing status.
- Added thumbnail support.

## Phase 9: YouTube / NewPipeExtractor Import Bridge

Status: complete

- Added admin-only YouTube search/import UI.
- Added Laravel API bridge for NewPipeExtractor-style local service.
- Added manual YouTube URL reference import.
- Added Java HTTP adapter under `tools/newpipe-service`.
- Cloned and built the official TeamNewPipe/NewPipeExtractor library under `tools/NewPipeExtractor`.
- Wired the adapter to real NewPipeExtractor search and details APIs.
- Details extraction now returns playable stream URL, stream type, MIME type, thumbnail, channel/uploader, and duration.
- Imported NewPipe items use the correct audio/video player type.
- External extracted streams redirect directly for faster browser playback instead of proxying through PHP.
- Added offline fallback so manual imports still work when the NewPipe service is not running.

Note: The extractor build requires Java 17+ to run Gradle and Java 11 to compile the library. A portable JDK 17 was downloaded to `C:\tmp\jdk17`, and the existing JDK 11 is referenced by Gradle toolchain configuration.

## Phase 10: Production Hardening

Status: pending for deployment

- Move storage to S3-compatible object storage.
- Add CDN delivery for media.
- Add queue workers for real FFmpeg duration, thumbnail, and waveform extraction.
- Add moderation and copyright ownership checks before public release.
