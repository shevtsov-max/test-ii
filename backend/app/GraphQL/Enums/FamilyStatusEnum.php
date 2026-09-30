<?php

namespace App\GraphQL\Enums;

use Rebing\GraphQL\Support\EnumType;

class FamilyStatusEnum extends EnumType
{
    protected $attributes = [
        'name' => 'FamilyStatus',
        'description' => 'Отношения пары',
        'values' => [
            'married' => ['value' => 'married'],
            'partners' => ['value' => 'partners'],
            'engaged' => ['value' => 'engaged'],
            'separated' => ['value' => 'separated'],
            'divorced' => ['value' => 'divorced'],
            'widowed' => ['value' => 'widowed'],
            'unknown' => ['value' => 'unknown'],
        ],
    ];
}
