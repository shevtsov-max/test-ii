<?php

namespace App\GraphQL\Queries;

use App\Domain\Branch;
use App\Domain\Names;
use App\Enums\DelegationStatus;
use App\Enums\MemberStatus;
use App\GraphQL\Support\BaseQuery;
use App\Services\Delegations\DelegationService;
use App\Services\Trees\MembershipService;
use App\Services\Trees\TreeRepository;
use GraphQL\Type\Definition\Type;
use Rebing\GraphQL\Support\Facades\GraphQL;

/** Что за приглашение по ссылке #/invite/<token> — доступно и без входа. */
class InvitationQuery extends BaseQuery
{
    protected $attributes = ['name' => 'invitation', 'description' => 'Сведения о приглашении по токену из ссылки'];

    public function type(): Type
    {
        return GraphQL::type('Invitation');
    }

    public function args(): array
    {
        return ['token' => ['type' => Type::nonNull(Type::string())]];
    }

    public function resolve($root, array $args, $ctx, MembershipService $members, DelegationService $delegations, TreeRepository $trees): ?array
    {
        $token = $args['token'];
        if (str_starts_with($token, 'm') && ($m = $members->findByToken($token))) {
            return [
                'kind' => 'member',
                'status' => $m->status === MemberStatus::Pending ? 'pending' : 'accepted',
                'expired' => $m->created_at->addDays(config('rodoslovnaya.invitations.ttl_days'))->isPast(),
                'treeName' => $m->tree->name,
                'inviterName' => $m->inviter?->name ?? $m->tree->owner->name,
                'role' => $m->role->value,
                'email' => $delegations->maskEmail($m->invited_email),
            ];
        }
        if (str_starts_with($token, 'd') && ($d = $delegations->findByToken($token))) {
            $data = $trees->load($d->sourceTree, ['persons', 'families']);

            return [
                'kind' => 'delegation',
                'status' => $d->status->value,
                'expired' => $d->status === DelegationStatus::Pending && $d->expires_at->isPast(),
                'treeName' => $d->sourceTree->name,
                'inviterName' => $d->creator->name,
                'rootName' => Names::formal($data['persons'][$d->root_person_id] ?? null),
                'persons' => count(Branch::personIds($data, $d->root_person_id)),
                'email' => $delegations->maskEmail($d->invitee_email),
                'message' => $d->message,
            ];
        }

        return null;
    }
}
