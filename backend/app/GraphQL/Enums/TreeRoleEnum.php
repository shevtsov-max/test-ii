<?php

namespace App\GraphQL\Enums;

use Rebing\GraphQL\Support\EnumType;

class TreeRoleEnum extends EnumType
{
    protected $attributes = [
        'name' => 'TreeRole',
        'description' => 'Роль в древе',
        'values' => [
            'owner' => ['value' => 'owner'],
            'editor' => ['value' => 'editor'],
            'viewer' => ['value' => 'viewer'],
        ],
    ];
}
