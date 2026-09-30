<?php

namespace App\GraphQL\Types;

use GraphQL\Type\Definition\Type;
use Rebing\GraphQL\Support\Facades\GraphQL;
use Rebing\GraphQL\Support\Type as GraphQLType;

class PlaceType extends GraphQLType
{
    protected $attributes = [
        'name' => 'Place',
        'description' => 'Место (иерархия: страна → регион → город)',
    ];

    public function fields(): array
    {
        return [
            'id' => ['type' => Type::nonNull(Type::id())],
            'name' => ['type' => Type::nonNull(Type::string())],
            'type' => ['type' => Type::nonNull(GraphQL::type('PlaceType'))],
            'parentId' => ['type' => Type::id()],
            'lat' => ['type' => Type::float()],
            'lng' => ['type' => Type::float()],
            'altNames' => ['type' => Type::nonNull(Type::string())],
            'note' => ['type' => Type::nonNull(Type::string())],
        ];
    }
}
