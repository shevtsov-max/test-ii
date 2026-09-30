<?php

namespace App\GraphQL\Inputs;

use GraphQL\Type\Definition\Type;
use Rebing\GraphQL\Support\Facades\GraphQL;
use Rebing\GraphQL\Support\InputType;

class TreeChangesInput extends InputType
{
    protected $attributes = [
        'name' => 'TreeChangesInput',
        'description' => 'Изменения древа: только изменённые сущности',
    ];

    public function fields(): array
    {
        return [
            'baseVersion' => ['type' => Type::float(), 'description' => 'Версия, от которой клиент вносил изменения'],
            'tree' => ['type' => GraphQL::type('TreeInfoInput')],
            'replace' => ['type' => GraphQL::type('JSON'), 'description' => 'Полная замена содержимого (импорт)'],
            'upsertPersons' => ['type' => Type::listOf(Type::nonNull(GraphQL::type('JSON')))],
            'deletePersons' => ['type' => Type::listOf(Type::nonNull(Type::id()))],
            'upsertFamilies' => ['type' => Type::listOf(Type::nonNull(GraphQL::type('JSON')))],
            'deleteFamilies' => ['type' => Type::listOf(Type::nonNull(Type::id()))],
            'upsertPlaces' => ['type' => Type::listOf(Type::nonNull(GraphQL::type('JSON')))],
            'deletePlaces' => ['type' => Type::listOf(Type::nonNull(Type::id()))],
            'upsertMedia' => ['type' => Type::listOf(Type::nonNull(GraphQL::type('JSON')))],
            'deleteMedia' => ['type' => Type::listOf(Type::nonNull(Type::id()))],
            'upsertSources' => ['type' => Type::listOf(Type::nonNull(GraphQL::type('JSON')))],
            'deleteSources' => ['type' => Type::listOf(Type::nonNull(Type::id()))],
            'upsertClans' => ['type' => Type::listOf(Type::nonNull(GraphQL::type('JSON')))],
            'deleteClans' => ['type' => Type::listOf(Type::nonNull(Type::id()))],
        ];
    }
}
