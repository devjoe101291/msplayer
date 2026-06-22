<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('media_items', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->string('artist')->default('Independent Artist');
            $table->string('album')->nullable();
            $table->string('genre')->nullable();
            $table->text('description')->nullable();
            $table->enum('type', ['audio', 'video'])->default('audio');
            $table->string('media_path');
            $table->string('cover_path')->nullable();
            $table->string('mime_type')->nullable();
            $table->unsignedBigInteger('size')->default(0);
            $table->unsignedInteger('plays')->default(0);
            $table->boolean('is_featured')->default(false);
            $table->timestamps();

            $table->index(['type', 'created_at']);
            $table->index(['artist', 'album']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('media_items');
    }
};
