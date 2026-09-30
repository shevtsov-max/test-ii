<?php

namespace App\GraphQL\Types;

use GraphQL\Type\Definition\Type;
use Rebing\GraphQL\Support\Facades\GraphQL;
use Rebing\GraphQL\Support\Type as GraphQLType;

class AuthPayloadType extends GraphQLType
{
    protected $attributes = [
        'name' => 'AuthPayload',
        'description' => 'Токены и пользователь',
    ];

    public function fields(): array
    {
        return [
            'accessToken' => ['type' => Type::nonNull(Type::string())],
            'refreshToken' => ['type' => Type::nonNull(Type::string())],
            'user' => ['type' => Type::nonNull(GraphQL::type('User'))],
        ];
    }
}
