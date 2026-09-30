<?php

namespace App\GraphQL\Enums;

use Rebing\GraphQL\Support\EnumType;

class MediaKindEnum extends EnumType
{
    protected $attributes = [
        'name' => 'MediaKind',
        'description' => 'Вид файла',
        'values' => [
            'photo' => ['value' => 'photo'],
            'document' => ['value' => 'document'],
            'audio' => ['value' => 'audio'],
            'video' => ['value' => 'video'],
            'other' => ['value' => 'other'],
        ],
    ];
}
