<?php

namespace App\GraphQL\Mutations;

use App\Enums\TreeRole;
use App\GraphQL\Support\BaseMutation;
use App\GraphQL\Support\Throttle;
use App\Services\Media\MediaStorage;
use App\Services\Trees\TreeAccess;
use GraphQL\Type\Definition\Type;
use Rebing\GraphQL\Support\Facades\GraphQL;

class CreateUploadMutation extends BaseMutation
{
    protected $attributes = ['name' => 'createUpload', 'description' => 'Получить ссылку для загрузки файла в древо'];

    public function type(): Type
    {
        return Type::nonNull(GraphQL::type('Upload'));
    }

    public function args(): array
    {
        return [
            'treeId' => ['type' => Type::nonNull(Type::id())],
            'filename' => ['type' => Type::nonNull(Type::string())],
            'mime' => ['type' => Type::nonNull(Type::string())],
            'size' => ['type' => Type::nonNull(Type::int())],
        ];
    }

    public function resolve($root, array $args, $ctx, TreeAccess $access, MediaStorage $media): array
    {
        $user = $this->user();
        $tree = $access->require($user, $args['treeId'], TreeRole::Editor);
        Throttle::hit('upload:'.$user->id, 300, 3600);

        return $media->createUpload($tree, $user, $args['filename'], $args['mime'], $args['size']);
    }
}
