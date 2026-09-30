<?php

namespace App\GraphQL\Enums;

use Rebing\GraphQL\Support\EnumType;

class CustomFieldTypeEnum extends EnumType
{
    protected $attributes = [
        'name' => 'CustomFieldType',
        'description' => 'Тип дополнительного поля',
        'values' => [
            'text' => ['value' => 'text'],
            'number' => ['value' => 'number'],
            'date' => ['value' => 'date'],
            'url' => ['value' => 'url'],
        ],
    ];
}
