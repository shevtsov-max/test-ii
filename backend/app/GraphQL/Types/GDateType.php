<?php

namespace App\GraphQL\Types;

use GraphQL\Type\Definition\Type;
use Rebing\GraphQL\Support\Facades\GraphQL;
use Rebing\GraphQL\Support\Type as GraphQLType;

class GDateType extends GraphQLType
{
    protected $attributes = [
        'name' => 'GDate',
        'description' => 'Дата с точностью: «около 1850», «между 1880 и 1885», старый стиль',
    ];

    public function fields(): array
    {
        return [
            'qualifier' => ['type' => Type::nonNull(GraphQL::type('DateQualifier'))],
            'day' => ['type' => Type::int()],
            'month' => ['type' => Type::int()],
            'year' => ['type' => Type::int()],
            'day2' => ['type' => Type::int(), 'description' => 'Вторая граница для between'],
            'month2' => ['type' => Type::int()],
            'year2' => ['type' => Type::int()],
            'calendar' => ['type' => GraphQL::type('Calendar'), 'description' => 'julian — старый стиль'],
            'text' => ['type' => Type::string(), 'description' => 'Исходный текст, если дату не удалось разобрать'],
        ];
    }
}
