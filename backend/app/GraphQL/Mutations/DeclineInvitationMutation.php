<?php

namespace App\GraphQL\Mutations;

use App\GraphQL\Support\ApiError;
use App\GraphQL\Support\BaseMutation;
use App\Services\Delegations\DelegationService;
use App\Services\Trees\MembershipService;
use GraphQL\Type\Definition\Type;

class DeclineInvitationMutation extends BaseMutation
{
    protected $attributes = ['name' => 'declineInvitation', 'description' => 'Отклонить приглашение'];

    public function type(): Type
    {
        return Type::nonNull(Type::boolean());
    }

    public function args(): array
    {
        return ['token' => ['type' => Type::nonNull(Type::string())]];
    }

    public function resolve($root, array $args, $ctx, MembershipService $members, DelegationService $delegations): bool
    {
        $token = $args['token'];
        if (str_starts_with($token, 'm') && ($m = $members->findByToken($token))) {
            $m->delete();

            return true;
        }
        if (str_starts_with($token, 'd') && ($d = $delegations->findByToken($token))) {
            $delegations->decline($d);

            return true;
        }
        throw ApiError::notFound('Приглашение не найдено или уже использовано');
    }
}
