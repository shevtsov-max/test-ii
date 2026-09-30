<?php

namespace App\GraphQL\Enums;

use Rebing\GraphQL\Support\EnumType;

class SourceTypeEnum extends EnumType
{
    protected $attributes = [
        'name' => 'SourceType',
        'description' => 'Тип источника',
        'values' => [
            'metric' => ['value' => 'metric'],
            'revision' => ['value' => 'revision'],
            'census' => ['value' => 'census'],
            'archive' => ['value' => 'archive'],
            'document' => ['value' => 'document'],
            'book' => ['value' => 'book'],
            'website' => ['value' => 'website'],
            'oral' => ['value' => 'oral'],
            'other' => ['value' => 'other'],
        ],
    ];
}
