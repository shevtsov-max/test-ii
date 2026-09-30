<?php

namespace App\Models;

use App\Enums\MemberStatus;
use App\Enums\TreeRole;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Участник древа (кроме владельца): приглашение по почте → принятие по ссылке.
 *
 * @property string $id
 * @property string $tree_id
 * @property ?string $user_id
 * @property ?string $invited_email
 * @property TreeRole $role
 * @property MemberStatus $status
 */
#[Fillable(['tree_id', 'user_id', 'invited_email', 'role', 'status', 'token_hash', 'invited_by', 'accepted_at'])]
class TreeMember extends Model
{
    use HasUlids;

    protected function casts(): array
    {
        return [
            'role' => TreeRole::class,
            'status' => MemberStatus::class,
            'accepted_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<Tree, $this> */
    public function tree(): BelongsTo
    {
        return $this->belongsTo(Tree::class);
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return BelongsTo<User, $this> */
    public function inviter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'invited_by');
    }
}
