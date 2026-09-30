<?php

namespace App\GraphQL\Mutations;

use App\GraphQL\Support\BaseMutation;
use App\Services\Trees\TreeRepository;
use GraphQL\Type\Definition\Type;
use Rebing\GraphQL\Support\Facades\GraphQL;

/** Новое древо: пустое, из мастера, пример или импорт (data — TreeData со словарями по id). */
class CreateTreeMutation extends BaseMutation
{
    protected $attributes = ['name' => 'createTree', 'description' => 'Создать древо'];

    public function type(): Type
    {
        return Type::nonNull(GraphQL::type('TreeSummary'));
    }

    public function args(): array
    {
        return ['input' => ['type' => Type::nonNull(GraphQL::type('CreateTreeInput'))]];
    }

    protected function rules(array $args = []): array
    {
        return [
            'input.name' => ['required', 'string', 'max:200'],
            'input.description' => ['nullable', 'string', 'max:5000'],
            'input.data' => ['nullable', 'array'],
        ];
    }

    public function resolve($root, array $args, $ctx, TreeRepository $trees): array
    {
        $input = $args['input'];
        $tree = $trees->create($this->user(), $input['name'], $input['description'] ?? '', $input['data'] ?? []);

        return $trees->summary($tree, 'owner');
    }
}
