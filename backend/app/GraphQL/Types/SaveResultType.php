<?php

namespace App\GraphQL\Types;

use GraphQL\Type\Definition\Type;
use Rebing\GraphQL\Support\Facades\GraphQL;
use Rebing\GraphQL\Support\Type as GraphQLType;

class SaveResultType extends GraphQLType
{
    protected $attributes = [
        'name' => 'SaveResult',
        'description' => 'Результат сохранения древа',
    ];

    public function fields(): array
    {
        return [
            'version' => ['type' => Type::nonNull(Type::float())],
            'updatedAt' => ['type' => Type::nonNull(GraphQL::type('Timestamp'))],
        ];
    }
}
