<?php

namespace App\GraphQL\Types;

use App\GraphQL\Support\Context;
use App\Models\Delegation;
use App\Services\Delegations\DelegationService;
use GraphQL\Type\Definition\Type;
use Rebing\GraphQL\Support\Facades\GraphQL;
use Rebing\GraphQL\Support\Type as GraphQLType;

class DelegationType extends GraphQLType
{
    protected $attributes = [
        'name' => 'Delegation',
        'description' => 'Передача ветки родственнику',
    ];

    public function fields(): array
    {
        return [
            'id' => ['type' => Type::nonNull(Type::id())],
            'status' => [
                'type' => Type::nonNull(GraphQL::type('DelegationStatus')),
                'resolve' => fn (Delegation $d) => $d->status->value,
            ],
            'rootPersonId' => [
                'type' => Type::nonNull(Type::id()),
                'resolve' => fn (Delegation $d) => $d->root_person_id,
            ],
            'personIds' => [
                'type' => Type::nonNull(Type::listOf(Type::nonNull(Type::id()))), 'description' => 'Персоны, закрытые для правки (после принятия)',
                'resolve' => fn (Delegation $d) => $d->person_ids ?? [],
            ],
            'email' => [
                'type' => Type::string(),
                'description' => 'Видит только владелец древа',
                'resolve' => fn (Delegation $d) => self::ownerView($d) ? $d->invitee_email : null,
            ],
            'message' => ['type' => Type::string()],
            'link' => [
                'type' => Type::string(), 'description' => 'Ссылка-приглашение (пока не принято)',
                'resolve' => fn (Delegation $d) => self::ownerView($d) ? app(DelegationService::class)->link($d) : null,
            ],
            'delegateName' => [
                'type' => Type::string(), 'description' => 'Кто продолжает ветку',
                'resolve' => fn (Delegation $d) => $d->targetUser?->name,
            ],
            'targetTreeId' => [
                'type' => Type::id(),
                'resolve' => fn (Delegation $d) => $d->target_tree_id,
            ],
            'createdAt' => [
                'type' => Type::nonNull(GraphQL::type('Timestamp')),
                'resolve' => fn (Delegation $d) => $d->created_at,
            ],
            'acceptedAt' => [
                'type' => GraphQL::type('Timestamp'),
                'resolve' => fn (Delegation $d) => $d->accepted_at,
            ],
        ];
    }

    /** Ссылку-приглашение и адрес видит только владелец исходного древа — участники-читатели не должны принимать чужую ветку. */
    private static function ownerView(Delegation $d): bool
    {
        return Context::user()?->id === $d->sourceTree?->owner_id;
    }
}
