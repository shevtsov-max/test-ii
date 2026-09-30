<?php

namespace App\GraphQL\Enums;

use Rebing\GraphQL\Support\EnumType;

class DateQualifierEnum extends EnumType
{
    protected $attributes = [
        'name' => 'DateQualifier',
        'description' => 'Точность даты',
        'values' => [
            'exact' => ['value' => 'exact'],
            'about' => ['value' => 'about'],
            'estimated' => ['value' => 'estimated'],
            'calculated' => ['value' => 'calculated'],
            'before' => ['value' => 'before'],
            'after' => ['value' => 'after'],
            'between' => ['value' => 'between'],
        ],
    ];
}
