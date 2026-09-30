<?php

namespace App\GraphQL\Types;

use GraphQL\Type\Definition\Type;
use Rebing\GraphQL\Support\Facades\GraphQL;
use Rebing\GraphQL\Support\Type as GraphQLType;

class PersonType extends GraphQLType
{
    protected $attributes = [
        'name' => 'Person',
        'description' => 'Персона древа',
    ];

    public function fields(): array
    {
        return [
            'id' => ['type' => Type::nonNull(Type::id())],
            'gender' => ['type' => Type::nonNull(GraphQL::type('Gender'))],
            'firstName' => ['type' => Type::nonNull(Type::string())],
            'middleName' => ['type' => Type::nonNull(Type::string())],
            'lastName' => ['type' => Type::nonNull(Type::string())],
            'birthName' => ['type' => Type::nonNull(Type::string()), 'description' => 'Фамилия при рождении'],
            'nickname' => ['type' => Type::nonNull(Type::string())],
            'title' => ['type' => Type::nonNull(Type::string()), 'description' => 'Титул, звание'],
            'suffix' => ['type' => Type::nonNull(Type::string()), 'description' => '«II», «старший»'],
            'clanId' => ['type' => Type::id()],
            'living' => ['type' => Type::nonNull(Type::boolean())],
            'birth' => ['type' => Type::nonNull(GraphQL::type('LifePoint'))],
            'death' => ['type' => Type::nonNull(GraphQL::type('DeathPoint'))],
            'residencePlaceId' => ['type' => Type::id()],
            'occupation' => ['type' => Type::nonNull(Type::string())],
            'email' => ['type' => Type::nonNull(Type::string())],
            'phone' => ['type' => Type::nonNull(Type::string())],
            'avatarId' => ['type' => Type::id(), 'description' => 'Главное фото (id записи Media)'],
            'note' => ['type' => Type::nonNull(Type::string())],
            'biography' => ['type' => Type::nonNull(Type::string())],
            'events' => ['type' => Type::nonNull(Type::listOf(Type::nonNull(GraphQL::type('LifeEvent'))))],
            'custom' => [
                'type' => Type::nonNull(GraphQL::type('JSON')), 'description' => 'Значения дополнительных полей: { [CustomFieldDef.id]: string }',
                'resolve' => fn (array $root) => (object) ($root['custom'] ?? []),
            ],
            'citations' => ['type' => Type::nonNull(Type::listOf(Type::nonNull(GraphQL::type('Citation'))))],
            'favorite' => ['type' => Type::nonNull(Type::boolean())],
            'privacy' => ['type' => Type::nonNull(GraphQL::type('Privacy'))],
            'createdAt' => ['type' => Type::nonNull(GraphQL::type('Timestamp'))],
            'updatedAt' => ['type' => Type::nonNull(GraphQL::type('Timestamp'))],
        ];
    }
}
