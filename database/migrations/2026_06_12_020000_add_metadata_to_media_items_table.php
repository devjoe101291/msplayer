<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('media_items', function (Blueprint $table) {
            $table->unsignedInteger('duration_seconds')->nullable()->after('size');
            $table->json('waveform')->nullable()->after('duration_seconds');
            $table->string('processing_status')->default('ready')->after('waveform');
            $table->string('thumbnail_path')->nullable()->after('cover_path');
            $table->string('source')->default('local')->after('processing_status');
            $table->string('source_id')->nullable()->after('source');
            $table->text('source_url')->nullable()->after('source_id');
            $table->text('external_stream_url')->nullable()->after('source_url');
            $table->text('external_cover_url')->nullable()->after('external_stream_url');
        });
    }

    public function down(): void
    {
        Schema::table('media_items', function (Blueprint $table) {
            $table->dropColumn([
                'duration_seconds',
                'waveform',
                'processing_status',
                'thumbnail_path',
                'source',
                'source_id',
                'source_url',
                'external_stream_url',
                'external_cover_url',
            ]);
        });
    }
};
