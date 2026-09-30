<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

/**
 * Запись журнала согласий: пользователь принял документ определённой редакции.
 *
 * @property string $document
 * @property string $version
 */
#[Fillable(['user_id', 'document', 'version', 'accepted_at', 'revoked_at', 'ip', 'user_agent'])]
class Consent extends Model
{
    public $timestamps = false;

    protected function casts(): array
    {
        return ['accepted_at' => 'datetime', 'revoked_at' => 'datetime'];
    }
}
