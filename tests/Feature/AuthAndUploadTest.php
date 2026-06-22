<?php

namespace Tests\Feature;

use App\Models\MediaItem;
use App\Models\User;
use App\Services\NewPipeClient;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class AuthAndUploadTest extends TestCase
{
    use RefreshDatabase;

    public function test_first_registered_user_is_admin(): void
    {
        $response = $this->postJson('/api/auth/register', [
            'name' => 'Studio Owner',
            'email' => 'owner@example.com',
            'password' => 'password123',
        ]);

        $response
            ->assertCreated()
            ->assertJsonPath('user.is_admin', true)
            ->assertJsonStructure(['token', 'user' => ['id', 'name', 'email', 'is_admin']]);
    }

    public function test_listener_cannot_upload_media(): void
    {
        Storage::fake('public');

        User::factory()->create(['is_admin' => true]);
        $listener = User::factory()->create(['is_admin' => false]);
        $token = $listener->createToken('test')->plainTextToken;

        $this
            ->withHeader('Authorization', "Bearer {$token}")
            ->post('/api/media', [
                'title' => 'Listener Upload',
                'type' => 'audio',
                'media' => UploadedFile::fake()->create('song.mp3', 128, 'audio/mpeg'),
            ])
            ->assertForbidden();

        $this->assertSame(0, MediaItem::count());
    }

    public function test_protected_api_returns_json_unauthenticated_response(): void
    {
        $this
            ->getJson('/api/youtube/search?q=music')
            ->assertUnauthorized()
            ->assertJsonPath('message', 'Unauthenticated.');
    }

    public function test_admin_can_upload_media(): void
    {
        Storage::fake('public');

        $admin = User::factory()->create(['is_admin' => true]);
        $token = $admin->createToken('test')->plainTextToken;

        $this
            ->withHeader('Authorization', "Bearer {$token}")
            ->post('/api/media', [
                'title' => 'Admin Upload',
                'artist' => 'MS Artist',
                'type' => 'audio',
                'media' => UploadedFile::fake()->create('song.mp3', 128, 'audio/mpeg'),
            ])
            ->assertCreated()
            ->assertJsonPath('data.title', 'Admin Upload');

        $this->assertSame(1, MediaItem::count());
    }

    public function test_admin_can_import_youtube_reference_without_running_extractor(): void
    {
        config(['services.newpipe.url' => null]);

        $admin = User::factory()->create(['is_admin' => true]);
        $token = $admin->createToken('test')->plainTextToken;

        $this
            ->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/youtube/import', [
                'url' => 'https://www.youtube.com/watch?v=abc123',
                'title' => 'YouTube Reference',
                'artist' => 'Video Channel',
                'thumbnail_url' => 'https://img.youtube.com/vi/abc123/hqdefault.jpg',
                'duration_seconds' => 180,
            ])
            ->assertCreated()
            ->assertJsonPath('data.source', 'youtube')
            ->assertJsonPath('data.title', 'YouTube Reference');

        $this->assertDatabaseHas('media_items', [
            'source' => 'youtube',
            'title' => 'YouTube Reference',
            'processing_status' => 'reference',
        ]);
    }

    public function test_admin_import_uses_extractor_stream_metadata(): void
    {
        $this->app->bind(NewPipeClient::class, fn () => new class extends NewPipeClient
        {
            public function details(string $url): array
            {
                return [
                    'id' => 'abc123',
                    'title' => 'Extractor Track',
                    'uploader' => 'Extractor Channel',
                    'thumbnail_url' => 'https://img.youtube.com/vi/abc123/hqdefault.jpg',
                    'duration_seconds' => 210,
                    'stream_url' => 'https://example.com/audio.m4a',
                    'stream_type' => 'audio',
                    'mime_type' => 'audio/mp4',
                ];
            }
        });

        $admin = User::factory()->create(['is_admin' => true]);
        $token = $admin->createToken('test')->plainTextToken;

        $this
            ->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/youtube/import', [
                'url' => 'https://www.youtube.com/watch?v=abc123',
            ])
            ->assertCreated()
            ->assertJsonPath('data.title', 'Extractor Track')
            ->assertJsonPath('data.type', 'audio')
            ->assertJsonPath('data.mime_type', 'audio/mp4')
            ->assertJsonPath('data.processing_status', 'ready');

        $this->assertDatabaseHas('media_items', [
            'source' => 'youtube',
            'source_id' => 'abc123',
            'external_stream_url' => 'https://example.com/audio.m4a',
            'type' => 'audio',
            'mime_type' => 'audio/mp4',
        ]);
    }
}
