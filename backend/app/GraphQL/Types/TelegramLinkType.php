<?php

namespace App\GraphQL\Types;

use GraphQL\Type\Definition\Type;
use Rebing\GraphQL\Support\Facades\GraphQL;
use Rebing\GraphQL\Support\Type as GraphQLType;

class TelegramLinkType extends GraphQLType
{
    protected $attributes = [
        'name' => 'TelegramLink',
        'description' => 'Ссылка для привязки Telegram',
    ];

    public function fields(): array
    {
        return [
            'url' => ['type' => Type::nonNull(Type::string())],
            'expiresAt' => ['type' => Type::nonNull(GraphQL::type('Timestamp'))],
        ];
    }
}
