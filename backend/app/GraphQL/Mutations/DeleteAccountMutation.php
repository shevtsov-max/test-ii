<?php

namespace App\GraphQL\Mutations;

use App\GraphQL\Support\ApiError;
use App\GraphQL\Support\BaseMutation;
use App\Models\Tree;
use App\Services\Delegations\DelegationService;
use App\Services\Media\MediaStorage;
use GraphQL\Type\Definition\Type;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

/**
 * Удаление учётной записи и всех её древ (отзыв согласия на обработку ПДн, ст. 9 152-ФЗ).
 * Ветки, которые пользователь продолжал за родственников, возвращаются им.
 */
class DeleteAccountMutation extends BaseMutation
{
    protected $attributes = ['name' => 'deleteAccount', 'description' => 'Удалить учётную запись и все древа'];

    public function type(): Type
    {
        return Type::nonNull(Type::boolean());
    }

    public function args(): array
    {
        return ['password' => ['type' => Type::nonNull(Type::string())]];
    }

    public function resolve($root, array $args, $ctx, DelegationService $delegations, MediaStorage $media): bool
    {
        $user = $this->user();
        if (! Hash::check($args['password'], $user->password)) {
            throw ApiError::validation('Неверный пароль', ['password' => 'Неверный пароль']);
        }
        $treeIds = Tree::where('owner_id', $user->id)->pluck('id');
        DB::transaction(function () use ($user, $delegations) {
            foreach (Tree::where('owner_id', $user->id)->get() as $tree) {
                $delegations->beforeTreeDeleted($tree);
            }
            $user->tokens()->delete();
            $user->delete();
        });
        // Файлы — после фиксации транзакции; «осиротевшие» папки удалит media:cleanup
        foreach ($treeIds as $id) {
            $media->deleteTreeFiles($id);
        }

        return true;
    }
}
