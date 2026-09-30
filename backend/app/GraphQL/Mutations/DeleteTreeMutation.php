<?php

namespace App\GraphQL\Mutations;

use App\Enums\TreeRole;
use App\GraphQL\Support\BaseMutation;
use App\Services\Delegations\DelegationService;
use App\Services\Media\MediaStorage;
use App\Services\Trees\TreeAccess;
use GraphQL\Type\Definition\Type;
use Illuminate\Support\Facades\DB;

/** Удалить древо. Если это ветка, переданная родственником, она вернётся в его древо. */
class DeleteTreeMutation extends BaseMutation
{
    protected $attributes = ['name' => 'deleteTree', 'description' => 'Удалить древо безвозвратно'];

    public function type(): Type
    {
        return Type::nonNull(Type::boolean());
    }

    public function args(): array
    {
        return ['id' => ['type' => Type::nonNull(Type::id())]];
    }

    public function resolve($root, array $args, $ctx, TreeAccess $access, DelegationService $delegations, MediaStorage $media): bool
    {
        $tree = $access->require($this->user(), $args['id'], TreeRole::Owner);
        DB::transaction(function () use ($tree, $delegations) {
            $delegations->beforeTreeDeleted($tree);
            $tree->delete();
        });
        $media->deleteTreeFiles($tree->id);

        return true;
    }
}
