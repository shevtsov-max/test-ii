<?php

namespace App\GraphQL\Types;

use GraphQL\Type\Definition\Type;
use Rebing\GraphQL\Support\Facades\GraphQL;
use Rebing\GraphQL\Support\Type as GraphQLType;

class UpcomingEventType extends GraphQLType
{
    protected $attributes = [
        'name' => 'UpcomingEvent',
        'description' => 'Ближайшая памятная дата',
    ];

    public function fields(): array
    {
        return [
            'kind' => ['type' => Type::nonNull(GraphQL::type('UpcomingEventKind'))],
            'date' => ['type' => Type::nonNull(Type::string()), 'description' => 'YYYY-MM-DD'],
            'inDays' => ['type' => Type::nonNull(Type::int())],
            'years' => ['type' => Type::int()],
            'treeId' => ['type' => Type::nonNull(Type::id())],
            'treeName' => ['type' => Type::nonNull(Type::string())],
            'personIds' => ['type' => Type::nonNull(Type::listOf(Type::nonNull(Type::id())))],
            'names' => ['type' => Type::nonNull(Type::listOf(Type::nonNull(Type::string())))],
        ];
    }
}
