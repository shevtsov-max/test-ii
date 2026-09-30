<?php

namespace App\GraphQL\Enums;

use Rebing\GraphQL\Support\EnumType;

class CalendarEnum extends EnumType
{
    protected $attributes = [
        'name' => 'Calendar',
        'description' => 'Календарь: julian — старый стиль',
        'values' => [
            'gregorian' => ['value' => 'gregorian'],
            'julian' => ['value' => 'julian'],
        ],
    ];
}
