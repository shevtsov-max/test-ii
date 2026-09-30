<?php

namespace App\GraphQL\Types;

use GraphQL\Type\Definition\Type;
use Rebing\GraphQL\Support\Facades\GraphQL;
use Rebing\GraphQL\Support\Type as GraphQLType;

class AcceptInvitationResultType extends GraphQLType
{
    protected $attributes = [
        'name' => 'AcceptInvitationResult',
        'description' => 'Принятое приглашение',
    ];

    public function fields(): array
    {
        return [
            'kind' => ['type' => Type::nonNull(GraphQL::type('InvitationKind'))],
            'treeId' => ['type' => Type::nonNull(Type::id()), 'description' => 'Древо, которое теперь доступно'],
        ];
    }
}
