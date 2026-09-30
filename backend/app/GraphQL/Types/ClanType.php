<?php

namespace App\GraphQL\Types;

use GraphQL\Type\Definition\Type;
use Rebing\GraphQL\Support\Type as GraphQLType;

class ClanType extends GraphQLType
{
    protected $attributes = [
        'name' => 'Clan',
        'description' => 'Род — ветвь фамилии',
    ];

    public function fields(): array
    {
        return [
            'id' => ['type' => Type::nonNull(Type::id())],
            'name' => ['type' => Type::nonNull(Type::string())],
            'color' => ['type' => Type::nonNull(Type::string())],
            'description' => ['type' => Type::nonNull(Type::string())],
        ];
    }
}
