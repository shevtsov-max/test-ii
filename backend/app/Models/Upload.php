<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * Выданная ссылка на загрузку файла в древо.
 *
 * @property string $id
 * @property string $tree_id
 * @property string $path
 * @property string $mime
 * @property int $size
 * @property ?Carbon $completed_at
 * @property Carbon $expires_at
 */
#[Fillable(['tree_id', 'user_id', 'path', 'mime', 'size', 'completed_at', 'expires_at'])]
class Upload extends Model
{
    use HasUlids;

    protected function casts(): array
    {
        return [
            'size' => 'integer',
            'completed_at' => 'datetime',
            'expires_at' => 'datetime',
        ];
    }
}
