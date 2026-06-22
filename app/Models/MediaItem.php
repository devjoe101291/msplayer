<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

class MediaItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'title',
        'artist',
        'album',
        'genre',
        'description',
        'type',
        'media_path',
        'cover_path',
        'thumbnail_path',
        'mime_type',
        'size',
        'duration_seconds',
        'waveform',
        'processing_status',
        'source',
        'source_id',
        'source_url',
        'external_stream_url',
        'external_cover_url',
        'plays',
        'is_featured',
    ];

    protected $casts = [
        'is_featured' => 'boolean',
        'plays' => 'integer',
        'size' => 'integer',
        'duration_seconds' => 'integer',
        'waveform' => 'array',
    ];

    protected $appends = [
        'stream_url',
        'cover_url',
        'thumbnail_url',
        'formatted_size',
        'duration_label',
    ];

    public function getStreamUrlAttribute(): string
    {
        if ($this->external_stream_url) {
            return $this->external_stream_url;
        }

        return route('media.stream', $this);
    }

    public function getCoverUrlAttribute(): ?string
    {
        return $this->cover_path ? Storage::disk('public')->url($this->cover_path) : $this->external_cover_url;
    }

    public function getThumbnailUrlAttribute(): ?string
    {
        return $this->thumbnail_path ? Storage::disk('public')->url($this->thumbnail_path) : $this->cover_url;
    }

    public function getFormattedSizeAttribute(): string
    {
        if ($this->size >= 1073741824) {
            return round($this->size / 1073741824, 1).' GB';
        }

        if ($this->size >= 1048576) {
            return round($this->size / 1048576, 1).' MB';
        }

        return round($this->size / 1024, 1).' KB';
    }

    public function getDurationLabelAttribute(): string
    {
        if (! $this->duration_seconds) {
            return '--:--';
        }

        $minutes = floor($this->duration_seconds / 60);
        $seconds = $this->duration_seconds % 60;

        return $minutes.':'.str_pad((string) $seconds, 2, '0', STR_PAD_LEFT);
    }
}
