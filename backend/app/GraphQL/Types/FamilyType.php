<?php

namespace App\GraphQL\Types;

use GraphQL\Type\Definition\Type;
use Rebing\GraphQL\Support\Facades\GraphQL;
use Rebing\GraphQL\Support\Type as GraphQLType;

class FamilyType extends GraphQLType
{
    protected $attributes = [
        'name' => 'Family',
        'description' => 'Семья: пара (или один родитель) и дети',
    ];

    public function fields(): array
    {
        return [
            'id' => ['type' => Type::nonNull(Type::id())],
            'partners' => ['type' => Type::nonNull(Type::listOf(Type::nonNull(Type::id()))), 'description' => '0–2 партнёра'],
            'status' => ['type' => Type::nonNull(GraphQL::type('FamilyStatus'))],
            'marriage' => ['type' => Type::nonNull(GraphQL::type('LifePoint'))],
            'divorce' => ['type' => Type::nonNull(GraphQL::type('LifePoint'))],
            'children' => ['type' => Type::nonNull(Type::listOf(Type::nonNull(Type::id())))],
            'childLinks' => [
                'type' => Type::nonNull(GraphQL::type('JSON')), 'description' => '{ [childId]: adopted | foster | step | guardian | unknown } — неродные дети',
                'resolve' => fn (array $root) => (object) ($root['childLinks'] ?? []),
            ],
            'note' => ['type' => Type::nonNull(Type::string())],
            'citations' => ['type' => Type::nonNull(Type::listOf(Type::nonNull(GraphQL::type('Citation'))))],
        ];
    }
}
