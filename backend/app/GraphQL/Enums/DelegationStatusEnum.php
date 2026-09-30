<?php

namespace App\GraphQL\Enums;

use Rebing\GraphQL\Support\EnumType;

class DelegationStatusEnum extends EnumType
{
    protected $attributes = [
        'name' => 'DelegationStatus',
        'description' => 'Статус передачи ветки',
        'values' => [
            'pending' => ['value' => 'pending'],
            'active' => ['value' => 'active'],
            'cloned' => ['value' => 'cloned'],
            'declined' => ['value' => 'declined'],
            'revoked' => ['value' => 'revoked'],
            'ended' => ['value' => 'ended'],
        ],
    ];
}
