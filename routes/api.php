<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\DiscoveryController;
use App\Http\Controllers\Api\LibraryController;
use App\Http\Controllers\Api\MediaItemController;
use App\Http\Controllers\Api\PlaylistController;
use App\Http\Controllers\Api\YoutubeImportController;
use App\Http\Controllers\Api\YoutubePlayController;
use Illuminate\Support\Facades\Route;


Route::post('/auth/register', [AuthController::class, 'register']);
Route::post('/auth/login', [AuthController::class, 'login']);

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);

    Route::get('/library/summary', [LibraryController::class, 'summary']);
    Route::get('/library/liked', [LibraryController::class, 'liked']);
    Route::get('/library/history', [LibraryController::class, 'history']);
    Route::post('/library/media/{mediaItem}/like', [LibraryController::class, 'toggleLike']);
    Route::post('/library/media/{mediaItem}/play', [LibraryController::class, 'recordPlay']);

    Route::post('/youtube/import', [YoutubeImportController::class, 'import']);

    Route::get('/playlists', [PlaylistController::class, 'index']);
    Route::post('/playlists', [PlaylistController::class, 'store']);
    Route::delete('/playlists/{playlist}', [PlaylistController::class, 'destroy']);
    Route::post('/playlists/{playlist}/items', [PlaylistController::class, 'addItem']);
    Route::delete('/playlists/{playlist}/items/{mediaItem}', [PlaylistController::class, 'removeItem']);

});

Route::post('/youtube/play', [YoutubePlayController::class, 'play']);
Route::get('/youtube/search', [YoutubeImportController::class, 'search']);


Route::get('/media', [MediaItemController::class, 'index']);
Route::get('/media/{mediaItem}', [MediaItemController::class, 'show']);
Route::get('/media/{mediaItem}/stream', [MediaItemController::class, 'stream'])->name('media.stream');
Route::get('/artists', [DiscoveryController::class, 'artists']);
Route::get('/albums', [DiscoveryController::class, 'albums']);
Route::get('/videos/{mediaItem}/theater', [DiscoveryController::class, 'videoTheater']);

Route::post('/media', [MediaItemController::class, 'store'])
    ->middleware('auth:sanctum');
