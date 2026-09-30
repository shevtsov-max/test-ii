<?php

namespace App\GraphQL\Types;

use GraphQL\Type\Definition\Type;
use Rebing\GraphQL\Support\Facades\GraphQL;
use Rebing\GraphQL\Support\Type as GraphQLType;

class SourceType extends GraphQLType
{
    protected $attributes = [
        'name' => 'Source',
        'description' => 'Источник: метрическая книга, архивное дело, публикация',
    ];

    public function fields(): array
    {
        return [
            'id' => ['type' => Type::nonNull(Type::id())],
            'title' => ['type' => Type::nonNull(Type::string())],
            'type' => ['type' => Type::nonNull(GraphQL::type('SourceType'))],
            'author' => ['type' => Type::nonNull(Type::string())],
            'repository' => ['type' => Type::nonNull(Type::string()), 'description' => 'Архив, библиотека'],
            'callNumber' => ['type' => Type::nonNull(Type::string()), 'description' => 'Фонд, опись, дело'],
            'url' => ['type' => Type::nonNull(Type::string())],
            'date' => ['type' => Type::nonNull(GraphQL::type('GDate'))],
            'note' => ['type' => Type::nonNull(Type::string())],
        ];
    }
}
