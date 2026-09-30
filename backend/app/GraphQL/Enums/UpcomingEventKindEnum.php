<?php

namespace App\GraphQL\Enums;

use Rebing\GraphQL\Support\EnumType;

class UpcomingEventKindEnum extends EnumType
{
    protected $attributes = [
        'name' => 'UpcomingEventKind',
        'description' => 'Вид памятной даты',
        'values' => [
            'birthday' => ['value' => 'birthday'],
            'wedding' => ['value' => 'wedding'],
            'memory_birth' => ['value' => 'memory-birth'],
            'memory_death' => ['value' => 'memory-death'],
        ],
    ];
}
