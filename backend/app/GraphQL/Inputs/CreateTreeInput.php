<?php

namespace App\GraphQL\Inputs;

use GraphQL\Type\Definition\Type;
use Rebing\GraphQL\Support\Facades\GraphQL;
use Rebing\GraphQL\Support\InputType;

class CreateTreeInput extends InputType
{
    protected $attributes = [
        'name' => 'CreateTreeInput',
        'description' => 'Новое древо',
    ];

    public function fields(): array
    {
        return [
            'name' => ['type' => Type::nonNull(Type::string())],
            'description' => ['type' => Type::string()],
            'data' => ['type' => GraphQL::type('JSON'), 'description' => 'TreeData (импорт, пример, мастер «Новое древо»)'],
        ];
    }
}
