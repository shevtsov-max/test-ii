<?php

namespace App\GraphQL\Types;

use GraphQL\Type\Definition\Type;
use Rebing\GraphQL\Support\Facades\GraphQL;
use Rebing\GraphQL\Support\Type as GraphQLType;

class CreateDelegationResultType extends GraphQLType
{
    protected $attributes = [
        'name' => 'CreateDelegationResult',
        'description' => 'Созданная передача и ссылка для отправки',
    ];

    public function fields(): array
    {
        return [
            'delegation' => ['type' => Type::nonNull(GraphQL::type('Delegation'))],
            'link' => ['type' => Type::nonNull(Type::string())],
        ];
    }
}
