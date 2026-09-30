<?php

namespace App\GraphQL\Mutations;

use App\GraphQL\Support\ApiError;
use App\GraphQL\Support\BaseMutation;
use App\Services\Delegations\DelegationService;
use App\Services\Trees\MembershipService;
use GraphQL\Type\Definition\Type;
use Rebing\GraphQL\Support\Facades\GraphQL;

/** Принять приглашение по ссылке: доступ к древу или продолжение ветки (создаётся своё древо). */
class AcceptInvitationMutation extends BaseMutation
{
    protected $attributes = ['name' => 'acceptInvitation', 'description' => 'Принять приглашение'];

    public function type(): Type
    {
        return Type::nonNull(GraphQL::type('AcceptInvitationResult'));
    }

    public function args(): array
    {
        return ['token' => ['type' => Type::nonNull(Type::string())]];
    }

    public function resolve($root, array $args, $ctx, MembershipService $members, DelegationService $delegations): array
    {
        $user = $this->user();
        $token = $args['token'];
        if (str_starts_with($token, 'm') && ($m = $members->findByToken($token))) {
            return ['kind' => 'member', 'treeId' => $members->accept($m, $user)->id];
        }
        if (str_starts_with($token, 'd') && ($d = $delegations->findByToken($token))) {
            return ['kind' => 'delegation', 'treeId' => $delegations->accept($d, $user)->id];
        }
        throw ApiError::notFound('Приглашение не найдено или уже использовано');
    }
}
