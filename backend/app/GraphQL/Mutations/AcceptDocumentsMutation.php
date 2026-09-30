<?php

namespace App\GraphQL\Mutations;

use App\GraphQL\Support\BaseMutation;
use App\Services\Legal\ConsentService;
use GraphQL\Type\Definition\Type;
use Illuminate\Http\Request;
use Rebing\GraphQL\Support\Facades\GraphQL;

/** Принять новые редакции документов (или дать необязательное согласие на рассылку). */
class AcceptDocumentsMutation extends BaseMutation
{
    protected $attributes = ['name' => 'acceptDocuments', 'description' => 'Принять документы в текущей редакции'];

    public function type(): Type
    {
        return Type::nonNull(GraphQL::type('User'));
    }

    public function args(): array
    {
        return ['consents' => ['type' => Type::nonNull(Type::listOf(Type::nonNull(GraphQL::type('ConsentInput'))))]];
    }

    public function resolve($root, array $args, $ctx, Request $request, ConsentService $consents)
    {
        $user = $this->user();
        $consents->record($user, $args['consents'], $request);

        return $user->fresh();
    }
}
