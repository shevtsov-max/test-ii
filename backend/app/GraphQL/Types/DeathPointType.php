<?php

namespace App\GraphQL\Types;

use GraphQL\Type\Definition\Type;
use Rebing\GraphQL\Support\Facades\GraphQL;
use Rebing\GraphQL\Support\Type as GraphQLType;

class DeathPointType extends GraphQLType
{
    protected $attributes = [
        'name' => 'DeathPoint',
        'description' => 'Смерть: дата, место, причина',
    ];

    public function fields(): array
    {
        return [
            'date' => ['type' => Type::nonNull(GraphQL::type('GDate'))],
            'placeId' => ['type' => Type::id()],
            'citations' => ['type' => Type::nonNull(Type::listOf(Type::nonNull(GraphQL::type('Citation'))))],
            'cause' => ['type' => Type::nonNull(Type::string())],
        ];
    }
}
