<?php

namespace App\GraphQL\Enums;

use Rebing\GraphQL\Support\EnumType;

class EventTypeEnum extends EnumType
{
    protected $attributes = [
        'name' => 'EventType',
        'description' => 'Тип события жизни',
        'values' => [
            'baptism' => ['value' => 'baptism'],
            'education' => ['value' => 'education'],
            'occupation' => ['value' => 'occupation'],
            'residence' => ['value' => 'residence'],
            'military' => ['value' => 'military'],
            'award' => ['value' => 'award'],
            'emigration' => ['value' => 'emigration'],
            'immigration' => ['value' => 'immigration'],
            'census' => ['value' => 'census'],
            'religion' => ['value' => 'religion'],
            'nationality' => ['value' => 'nationality'],
            'namechange' => ['value' => 'namechange'],
            'illness' => ['value' => 'illness'],
            'burial' => ['value' => 'burial'],
            'custom' => ['value' => 'custom'],
        ],
    ];
}
