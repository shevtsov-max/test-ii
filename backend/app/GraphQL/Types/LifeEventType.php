<?php

namespace App\GraphQL\Types;

use GraphQL\Type\Definition\Type;
use Rebing\GraphQL\Support\Facades\GraphQL;
use Rebing\GraphQL\Support\Type as GraphQLType;

class LifeEventType extends GraphQLType
{
    protected $attributes = [
        'name' => 'LifeEvent',
        'description' => 'Событие жизни',
    ];

    public function fields(): array
    {
        return [
            'id' => ['type' => Type::nonNull(Type::id())],
            'type' => ['type' => Type::nonNull(GraphQL::type('EventType'))],
            'title' => ['type' => Type::nonNull(Type::string()), 'description' => 'Название для type = custom'],
            'date' => ['type' => Type::nonNull(GraphQL::type('GDate'))],
            'placeId' => ['type' => Type::id()],
            'description' => ['type' => Type::nonNull(Type::string())],
            'citations' => ['type' => Type::nonNull(Type::listOf(Type::nonNull(GraphQL::type('Citation'))))],
        ];
    }
}
