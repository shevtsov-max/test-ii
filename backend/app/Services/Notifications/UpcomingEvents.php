<?php

namespace App\Services\Notifications;

use App\Domain\Anniversaries;
use App\Enums\MemberStatus;
use App\Models\Tree;
use App\Models\User;
use App\Services\Trees\TreeRepository;
use Carbon\CarbonImmutable;

/** Памятные даты по всем древам пользователя (свои и те, куда его пригласили). */
final class UpcomingEvents
{
    public function __construct(private readonly TreeRepository $trees) {}

    /**
     * @param  array<string, bool>  $kinds  birthday, wedding, memorials
     * @return list<array>
     */
    public function forUser(User $user, CarbonImmutable $today, int $days, array $kinds = []): array
    {
        $treeIds = Tree::where('owner_id', $user->id)->pluck('id')
            ->merge($user->memberships()->where('status', MemberStatus::Active)->pluck('tree_id'))
            ->unique();
        $out = [];
        foreach (Tree::whereIn('id', $treeIds)->get() as $tree) {
            $data = $this->trees->load($tree, ['persons', 'families']);
            foreach (Anniversaries::upcoming($data, $today, $days, $kinds) as $e) {
                $out[] = $e + ['treeId' => $tree->id, 'treeName' => $tree->name];
            }
        }
        usort($out, fn ($a, $b) => [$a['inDays'], Anniversaries::ORDER[$a['kind']], $a['treeName']] <=> [$b['inDays'], Anniversaries::ORDER[$b['kind']], $b['treeName']]);

        return $out;
    }
}
