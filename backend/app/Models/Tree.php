<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Древо. Содержимое (персоны, семьи…) — в таблицах tree_* (см. App\Services\Trees\TreeRepository).
 *
 * @property string $id
 * @property string $owner_id
 * @property string $name
 * @property string $description
 * @property ?string $home_person_id
 * @property array $custom_fields
 * @property int $version
 */
#[Fillable(['owner_id', 'name', 'description', 'home_person_id', 'custom_fields', 'version', 'persons_count', 'families_count', 'media_count', 'home_name', 'home_thumb', 'home_gender'])]
class Tree extends Model
{
    use HasUlids;

    protected function casts(): array
    {
        return [
            'custom_fields' => 'array',
            'version' => 'integer',
            'persons_count' => 'integer',
            'families_count' => 'integer',
            'media_count' => 'integer',
        ];
    }

    /** @return BelongsTo<User, $this> */
    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    /** @return HasMany<TreeMember, $this> */
    public function members(): HasMany
    {
        return $this->hasMany(TreeMember::class);
    }

    /** @return HasMany<Delegation, $this> */
    public function delegations(): HasMany
    {
        return $this->hasMany(Delegation::class, 'source_tree_id');
    }
}
