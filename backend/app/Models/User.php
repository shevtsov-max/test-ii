<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\HasApiTokens;

/**
 * @property string $id
 * @property string $name
 * @property string $email
 * @property ?Carbon $email_verified_at
 * @property ?string $avatar
 * @property bool $marketing_opt_in
 */
#[Fillable(['name', 'email', 'password', 'avatar', 'marketing_opt_in'])]
#[Hidden(['password'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, HasUlids, Notifiable;

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'marketing_opt_in' => 'boolean',
        ];
    }

    /** @return HasMany<Tree, $this> */
    public function ownedTrees(): HasMany
    {
        return $this->hasMany(Tree::class, 'owner_id');
    }

    /** @return HasMany<TreeMember, $this> */
    public function memberships(): HasMany
    {
        return $this->hasMany(TreeMember::class);
    }

    /** @return HasMany<Consent, $this> */
    public function consents(): HasMany
    {
        return $this->hasMany(Consent::class);
    }

    /** @return HasOne<NotificationSetting, $this> */
    public function notificationSettings(): HasOne
    {
        return $this->hasOne(NotificationSetting::class);
    }
}
