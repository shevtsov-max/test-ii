<?php

namespace App\GraphQL\Inputs;

use GraphQL\Type\Definition\Type;
use Rebing\GraphQL\Support\InputType;

class ConsentInput extends InputType
{
    protected $attributes = [
        'name' => 'ConsentInput',
        'description' => 'Согласие с документом определённой редакции',
    ];

    public function fields(): array
    {
        return [
            'document' => ['type' => Type::nonNull(Type::string()), 'description' => 'terms, privacy, personal_data, marketing'],
            'version' => ['type' => Type::nonNull(Type::string())],
        ];
    }
}
