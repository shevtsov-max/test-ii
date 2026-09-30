<?php

namespace App\GraphQL\Queries;

use App\GraphQL\Support\BaseQuery;
use App\GraphQL\Support\Context;
use GraphQL\Type\Definition\Type;
use Rebing\GraphQL\Support\Facades\GraphQL;

/** Текущий пользователь или null — клиент так проверяет сеанс при запуске. */
class MeQuery extends BaseQuery
{
    protected $attributes = ['name' => 'me', 'description' => 'Текущий пользователь или null'];

    public function type(): Type
    {
        return GraphQL::type('User');
    }

    public function resolve(): mixed
    {
        return Context::user();
    }
}
