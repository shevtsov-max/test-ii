<?php

namespace App\GraphQL\Enums;

use Rebing\GraphQL\Support\EnumType;

class PlaceTypeEnum extends EnumType
{
    protected $attributes = [
        'name' => 'PlaceType',
        'description' => 'Тип места',
        'values' => [
            'country' => ['value' => 'country'],
            'region' => ['value' => 'region'],
            'district' => ['value' => 'district'],
            'city' => ['value' => 'city'],
            'village' => ['value' => 'village'],
            'address' => ['value' => 'address'],
            'church' => ['value' => 'church'],
            'cemetery' => ['value' => 'cemetery'],
            'other' => ['value' => 'other'],
        ],
    ];
}
