<?php

namespace App\GraphQL\Inputs;

use GraphQL\Type\Definition\Type;
use Rebing\GraphQL\Support\Facades\GraphQL;
use Rebing\GraphQL\Support\InputType;

class TreeInfoInput extends InputType
{
    protected $attributes = [
        'name' => 'TreeInfoInput',
        'description' => 'Сведения о древе',
    ];

    public function fields(): array
    {
        return [
            'name' => ['type' => Type::string()],
            'description' => ['type' => Type::string()],
            'homePersonId' => ['type' => Type::id()],
            'customFields' => ['type' => GraphQL::type('JSON')],
        ];
    }
}
