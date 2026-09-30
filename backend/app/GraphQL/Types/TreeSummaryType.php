<?php

namespace App\GraphQL\Types;

use GraphQL\Type\Definition\Type;
use Rebing\GraphQL\Support\Facades\GraphQL;
use Rebing\GraphQL\Support\Type as GraphQLType;

class TreeSummaryType extends GraphQLType
{
    protected $attributes = [
        'name' => 'TreeSummary',
        'description' => 'Карточка древа для списка «Мои древа»',
    ];

    public function fields(): array
    {
        return [
            'id' => ['type' => Type::nonNull(Type::id())],
            'name' => ['type' => Type::nonNull(Type::string())],
            'description' => ['type' => Type::nonNull(Type::string())],
            'persons' => ['type' => Type::nonNull(Type::int())],
            'families' => ['type' => Type::nonNull(Type::int())],
            'media' => ['type' => Type::nonNull(Type::int())],
            'homeName' => ['type' => Type::string()],
            'homeThumb' => ['type' => Type::string()],
            'homeGender' => ['type' => GraphQL::type('Gender')],
            'role' => ['type' => Type::nonNull(GraphQL::type('TreeRole'))],
            'createdAt' => ['type' => Type::nonNull(GraphQL::type('Timestamp'))],
            'updatedAt' => ['type' => Type::nonNull(GraphQL::type('Timestamp'))],
        ];
    }
}
