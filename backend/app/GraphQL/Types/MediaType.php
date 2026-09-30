<?php

namespace App\GraphQL\Types;

use GraphQL\Type\Definition\Type;
use Rebing\GraphQL\Support\Facades\GraphQL;
use Rebing\GraphQL\Support\Type as GraphQLType;

class MediaType extends GraphQLType
{
    protected $attributes = [
        'name' => 'Media',
        'description' => 'Фото или документ',
    ];

    public function fields(): array
    {
        return [
            'id' => ['type' => Type::nonNull(Type::id())],
            'kind' => ['type' => Type::nonNull(GraphQL::type('MediaKind'))],
            'title' => ['type' => Type::nonNull(Type::string())],
            'description' => ['type' => Type::nonNull(Type::string())],
            'date' => ['type' => Type::nonNull(GraphQL::type('GDate'))],
            'placeId' => ['type' => Type::id()],
            'personIds' => ['type' => Type::nonNull(Type::listOf(Type::nonNull(Type::id())))],
            'sourceId' => ['type' => Type::id()],
            'src' => ['type' => Type::string()],
            'thumb' => ['type' => Type::string()],
            'mime' => ['type' => Type::nonNull(Type::string())],
            'size' => ['type' => Type::nonNull(Type::int())],
            'createdAt' => ['type' => Type::nonNull(GraphQL::type('Timestamp'))],
        ];
    }
}
