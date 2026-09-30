<?php

namespace App\GraphQL\Types;

use App\Models\User;
use App\Services\Legal\ConsentService;
use GraphQL\Type\Definition\Type;
use Rebing\GraphQL\Support\Facades\GraphQL;
use Rebing\GraphQL\Support\Type as GraphQLType;

class UserType extends GraphQLType
{
    protected $attributes = [
        'name' => 'User',
        'description' => 'Пользователь',
    ];

    public function fields(): array
    {
        return [
            'id' => ['type' => Type::nonNull(Type::id())],
            'email' => ['type' => Type::nonNull(Type::string())],
            'name' => ['type' => Type::nonNull(Type::string())],
            'avatar' => ['type' => Type::string()],
            'emailVerified' => [
                'type' => Type::nonNull(Type::boolean()),
                'resolve' => fn (User $u) => $u->email_verified_at !== null,
            ],
            'marketingOptIn' => [
                'type' => Type::nonNull(Type::boolean()), 'description' => 'Согласие на рассылку новостей',
                'resolve' => fn (User $u) => (bool) $u->marketing_opt_in,
            ],
            'pendingConsents' => [
                'type' => Type::nonNull(Type::listOf(Type::nonNull(Type::string()))), 'description' => 'Обязательные документы, новую редакцию которых нужно принять',
                'resolve' => fn (User $u) => app(ConsentService::class)->pending($u),
            ],
            'createdAt' => [
                'type' => Type::nonNull(GraphQL::type('Timestamp')),
                'resolve' => fn (User $u) => $u->created_at,
            ],
        ];
    }
}
