<?php

namespace App\Models;

use App\Enums\DelegationStatus;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Передача ветки древа родственнику (см. App\Services\Delegations\DelegationService).
 *
 * @property string $id
 * @property string $source_tree_id
 * @property string $root_person_id
 * @property ?array $person_ids
 * @property string $created_by
 * @property ?string $invitee_email
 * @property ?string $message
 * @property ?string $token_encrypted
 * @property DelegationStatus $status
 * @property ?string $target_tree_id
 * @property ?string $target_user_id
 * @property ?Carbon $accepted_at
 * @property Carbon $expires_at
 */
#[Fillable(['source_tree_id', 'root_person_id', 'person_ids', 'created_by', 'invitee_email', 'message', 'token_hash', 'token_encrypted', 'status', 'target_tree_id', 'target_user_id', 'accepted_at', 'ended_at', 'expires_at'])]
#[Hidden(['token_hash', 'token_encrypted'])]
class Delegation extends Model
{
    use HasUlids;

    protected function casts(): array
    {
        return [
            'person_ids' => 'array',
            'status' => DelegationStatus::class,
            'accepted_at' => 'datetime',
            'ended_at' => 'datetime',
            'expires_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<Tree, $this> */
    public function sourceTree(): BelongsTo
    {
        return $this->belongsTo(Tree::class, 'source_tree_id');
    }

    /** @return BelongsTo<Tree, $this> */
    public function targetTree(): BelongsTo
    {
        return $this->belongsTo(Tree::class, 'target_tree_id');
    }

    /** @return BelongsTo<User, $this> */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /** @return BelongsTo<User, $this> */
    public function targetUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'target_user_id');
    }
}
