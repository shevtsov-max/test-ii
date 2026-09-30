<?php

namespace App\GraphQL\Enums;

use Rebing\GraphQL\Support\EnumType;

class GenderEnum extends EnumType
{
    protected $attributes = [
        'name' => 'Gender',
        'description' => 'Пол: M — мужской, F — женский, U — неизвестен',
        'values' => [
            'M' => ['value' => 'M'],
            'F' => ['value' => 'F'],
            'U' => ['value' => 'U'],
        ],
    ];
}
