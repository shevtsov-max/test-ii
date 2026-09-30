<?php

namespace App\GraphQL\Enums;

use Rebing\GraphQL\Support\EnumType;

class MemberStatusEnum extends EnumType
{
    protected $attributes = [
        'name' => 'MemberStatus',
        'description' => 'Статус участника',
        'values' => [
            'pending' => ['value' => 'pending'],
            'active' => ['value' => 'active'],
        ],
    ];
}
