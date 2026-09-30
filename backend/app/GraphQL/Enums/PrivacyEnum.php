<?php

namespace App\GraphQL\Enums;

use Rebing\GraphQL\Support\EnumType;

class PrivacyEnum extends EnumType
{
    protected $attributes = [
        'name' => 'Privacy',
        'description' => 'Кому видна запись',
        'values' => [
            'public' => ['value' => 'public'],
            'family' => ['value' => 'family'],
            'private' => ['value' => 'private'],
        ],
    ];
}
