<?php

namespace App\GraphQL\Types;

use GraphQL\Type\Definition\Type;
use Rebing\GraphQL\Support\Type as GraphQLType;

class CitationType extends GraphQLType
{
    protected $attributes = [
        'name' => 'Citation',
        'description' => 'Ссылка на источник',
    ];

    public function fields(): array
    {
        return [
            'id' => ['type' => Type::nonNull(Type::id())],
            'sourceId' => ['type' => Type::nonNull(Type::id())],
            'page' => ['type' => Type::nonNull(Type::string()), 'description' => 'Лист, страница, запись'],
            'quality' => ['type' => Type::nonNull(Type::int()), 'description' => '3 — прямое свидетельство … 0 — ненадёжное'],
            'note' => ['type' => Type::nonNull(Type::string())],
        ];
    }
}
