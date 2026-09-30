<?php

namespace App\GraphQL\Types;

use GraphQL\Type\Definition\Type;
use Rebing\GraphQL\Support\Facades\GraphQL;
use Rebing\GraphQL\Support\Type as GraphQLType;

class TreeMemberType extends GraphQLType
{
    protected $attributes = [
        'name' => 'TreeMember',
        'description' => 'Участник древа',
    ];

    public function fields(): array
    {
        return [
            'id' => ['type' => Type::nonNull(Type::id())],
            'role' => ['type' => Type::nonNull(GraphQL::type('TreeRole'))],
            'user' => ['type' => GraphQL::type('User'), 'description' => 'null, пока приглашение не принято'],
            'invitedEmail' => ['type' => Type::string()],
            'status' => ['type' => Type::nonNull(GraphQL::type('MemberStatus'))],
            'createdAt' => ['type' => Type::nonNull(GraphQL::type('Timestamp'))],
        ];
    }
}
