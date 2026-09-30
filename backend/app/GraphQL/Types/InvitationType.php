<?php

namespace App\GraphQL\Types;

use GraphQL\Type\Definition\Type;
use Rebing\GraphQL\Support\Facades\GraphQL;
use Rebing\GraphQL\Support\Type as GraphQLType;

class InvitationType extends GraphQLType
{
    protected $attributes = [
        'name' => 'Invitation',
        'description' => 'Приглашение по ссылке: в древо или продолжить ветку',
    ];

    public function fields(): array
    {
        return [
            'kind' => ['type' => Type::nonNull(GraphQL::type('InvitationKind'))],
            'status' => ['type' => Type::nonNull(Type::string()), 'description' => 'pending — можно принять'],
            'expired' => ['type' => Type::nonNull(Type::boolean())],
            'treeName' => ['type' => Type::nonNull(Type::string())],
            'inviterName' => ['type' => Type::nonNull(Type::string())],
            'role' => ['type' => GraphQL::type('TreeRole'), 'description' => 'Для приглашения в древо'],
            'rootName' => ['type' => Type::string(), 'description' => 'С кого начинается ветка'],
            'persons' => ['type' => Type::int(), 'description' => 'Сколько человек в ветке'],
            'email' => ['type' => Type::string(), 'description' => 'Кому отправлено (частично скрыто)'],
            'message' => ['type' => Type::string(), 'description' => 'Сообщение от пригласившего'],
        ];
    }
}
