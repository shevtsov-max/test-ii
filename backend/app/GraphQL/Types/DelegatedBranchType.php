<?php

namespace App\GraphQL\Types;

use GraphQL\Type\Definition\Type;
use Rebing\GraphQL\Support\Facades\GraphQL;
use Rebing\GraphQL\Support\Type as GraphQLType;

class DelegatedBranchType extends GraphQLType
{
    protected $attributes = [
        'name' => 'DelegatedBranch',
        'description' => 'Актуальная ветка из древа родственника (только просмотр)',
    ];

    public function fields(): array
    {
        return [
            'delegation' => ['type' => Type::nonNull(GraphQL::type('Delegation'))],
            'data' => ['type' => Type::nonNull(GraphQL::type('JSON')), 'description' => 'TreeData ветки: persons, families, places, media, sources, clans — словари по id'],
        ];
    }
}
