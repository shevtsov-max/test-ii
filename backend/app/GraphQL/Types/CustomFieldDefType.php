<?php

namespace App\GraphQL\Types;

use GraphQL\Type\Definition\Type;
use Rebing\GraphQL\Support\Facades\GraphQL;
use Rebing\GraphQL\Support\Type as GraphQLType;

class CustomFieldDefType extends GraphQLType
{
    protected $attributes = [
        'name' => 'CustomFieldDef',
        'description' => 'Дополнительное поле древа',
    ];

    public function fields(): array
    {
        return [
            'id' => ['type' => Type::nonNull(Type::id())],
            'label' => ['type' => Type::nonNull(Type::string())],
            'type' => ['type' => Type::nonNull(GraphQL::type('CustomFieldType'))],
        ];
    }
}
