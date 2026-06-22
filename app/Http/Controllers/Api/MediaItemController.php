<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MediaItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class MediaItemController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = MediaItem::query()->latest();

        if ($request->filled('type') && in_array($request->string('type')->toString(), ['audio', 'video'], true)) {
            $query->where('type', $request->string('type')->toString());
        }

        if ($request->filled('search')) {
            $search = $request->string('search')->toString();
            $query->where(function ($builder) use ($search) {
                $builder
                    ->where('title', 'like', "%{$search}%")
                    ->orWhere('artist', 'like', "%{$search}%")
                    ->orWhere('album', 'like', "%{$search}%")
                    ->orWhere('genre', 'like', "%{$search}%");
            });
        }

        return response()->json([
            'data' => $query->paginate(24)->withQueryString(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        abort_unless($request->user()?->is_admin, 403, 'Only admin users can upload media.');

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:160'],
            'artist' => ['nullable', 'string', 'max:120'],
            'album' => ['nullable', 'string', 'max:120'],
            'genre' => ['nullable', 'string', 'max:80'],
            'description' => ['nullable', 'string', 'max:1200'],
            'type' => ['required', 'in:audio,video'],
            'duration_seconds' => ['nullable', 'integer', 'min:1', 'max:86400'],
            'media' => ['required', 'file', 'mimes:mp3,wav,ogg,m4a,mp4,webm,mov', 'max:204800'],
            'cover' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:8192'],
        ]);

        $mediaFile = $request->file('media');
        $mediaPath = $mediaFile->store('media', 'public');
        $coverPath = $request->file('cover')?->store('covers', 'public');

        $item = MediaItem::create([
            'title' => $validated['title'],
            'artist' => $validated['artist'] ?? 'Independent Artist',
            'album' => $validated['album'] ?? null,
            'genre' => $validated['genre'] ?? null,
            'description' => $validated['description'] ?? null,
            'type' => $validated['type'],
            'media_path' => $mediaPath,
            'cover_path' => $coverPath,
            'thumbnail_path' => $coverPath,
            'mime_type' => $mediaFile->getMimeType(),
            'size' => $mediaFile->getSize(),
            'duration_seconds' => $validated['duration_seconds'] ?? null,
            'waveform' => $this->makeWaveformSeed($mediaFile->getSize()),
            'processing_status' => 'ready',
            'is_featured' => MediaItem::count() < 4,
        ]);

        return response()->json(['data' => $item], 201);
    }

    public function show(MediaItem $mediaItem): JsonResponse
    {
        return response()->json(['data' => $mediaItem]);
    }

    public function stream(Request $request, MediaItem $mediaItem): Response
    {
        if ($mediaItem->external_stream_url) {
            abort_unless(str_starts_with($mediaItem->external_stream_url, 'http'), 404);

            return redirect()->away($mediaItem->external_stream_url);
        }

        abort_unless(Storage::disk('public')->exists($mediaItem->media_path), 404);

        $path = Storage::disk('public')->path($mediaItem->media_path);
        $size = filesize($path);
        $start = 0;
        $end = $size - 1;
        $status = 200;

        if ($request->headers->has('Range')) {
            $status = 206;
            $range = $request->headers->get('Range');

            if (preg_match('/bytes=(\d*)-(\d*)/', $range, $matches)) {
                $start = $matches[1] === '' ? 0 : (int) $matches[1];
                $end = $matches[2] === '' ? $end : (int) $matches[2];
                $end = min($end, $size - 1);
            }
        }

        $length = $end - $start + 1;
        $headers = [
            'Accept-Ranges' => 'bytes',
            'Content-Type' => $mediaItem->mime_type ?: 'application/octet-stream',
            'Content-Length' => (string) $length,
            'Cache-Control' => 'public, max-age=31536000',
        ];

        if ($status === 206) {
            $headers['Content-Range'] = "bytes {$start}-{$end}/{$size}";
        }

        $mediaItem->increment('plays');

        return response()->stream(function () use ($path, $start, $length): void {
            $stream = fopen($path, 'rb');
            fseek($stream, $start);
            $remaining = $length;

            while ($remaining > 0 && ! feof($stream)) {
                $chunkSize = min(8192, $remaining);
                echo fread($stream, $chunkSize);
                flush();
                $remaining -= $chunkSize;
            }

            fclose($stream);
        }, $status, $headers);
    }

    /**
     * @return array<int, int>
     */
    private function makeWaveformSeed(int $size): array
    {
        $seed = max(1, $size % 97);

        return array_map(
            fn (int $index): int => 18 + (($seed * ($index + 3)) % 72),
            range(0, 31)
        );
    }
}
