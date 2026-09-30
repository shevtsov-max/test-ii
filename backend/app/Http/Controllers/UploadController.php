<?php

namespace App\Http\Controllers;

use App\GraphQL\Support\ApiError;
use App\Models\Upload;
use App\Services\Media\MediaStorage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Приём файла по подписанной ссылке из мутации createUpload (PUT /api/uploads/{upload}). */
class UploadController
{
    public function __invoke(Request $request, Upload $upload, MediaStorage $media): JsonResponse
    {
        if (! $request->hasValidRelativeSignature()) {
            return response()->json(['message' => 'Ссылка для загрузки недействительна'], 403);
        }
        try {
            $length = $request->header('Content-Length');
            $media->store($upload, $request->getContent(true), $length !== null ? (int) $length : null);
        } catch (ApiError $e) {
            return response()->json(['message' => $e->getMessage(), 'code' => $e->errorCode], $e->errorCode === ApiError::FORBIDDEN ? 403 : 422);
        }

        return response()->json(['url' => $media->url($upload->path)]);
    }
}
