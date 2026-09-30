<?php

namespace App\GraphQL\Types;

use GraphQL\Type\Definition\Type;
use Rebing\GraphQL\Support\Facades\GraphQL;
use Rebing\GraphQL\Support\Type as GraphQLType;

class TreeType extends GraphQLType
{
    protected $attributes = [
        'name' => 'Tree',
        'description' => 'Древо целиком',
    ];

    public function fields(): array
    {
        return [
            'id' => ['type' => Type::nonNull(Type::id())],
            'name' => ['type' => Type::nonNull(Type::string())],
            'description' => ['type' => Type::nonNull(Type::string())],
            'homePersonId' => ['type' => Type::id(), 'description' => '«Это Вы»'],
            'version' => ['type' => Type::nonNull(Type::float()), 'description' => 'Передаётся в applyTreeChanges как baseVersion'],
            'role' => ['type' => Type::nonNull(GraphQL::type('TreeRole'))],
            'createdAt' => ['type' => Type::nonNull(GraphQL::type('Timestamp'))],
            'updatedAt' => ['type' => Type::nonNull(GraphQL::type('Timestamp'))],
            'customFields' => ['type' => Type::nonNull(Type::listOf(Type::nonNull(GraphQL::type('CustomFieldDef'))))],
            'persons' => ['type' => Type::nonNull(Type::listOf(Type::nonNull(GraphQL::type('Person'))))],
            'families' => ['type' => Type::nonNull(Type::listOf(Type::nonNull(GraphQL::type('Family'))))],
            'places' => ['type' => Type::nonNull(Type::listOf(Type::nonNull(GraphQL::type('Place'))))],
            'media' => ['type' => Type::nonNull(Type::listOf(Type::nonNull(GraphQL::type('Media'))))],
            'sources' => ['type' => Type::nonNull(Type::listOf(Type::nonNull(GraphQL::type('Source'))))],
            'clans' => ['type' => Type::nonNull(Type::listOf(Type::nonNull(GraphQL::type('Clan'))))],
        ];
    }
}
