<?php

namespace App\GraphQL\Support;

use App\Models\User;
use Rebing\GraphQL\Support\Mutation;

/** Базовая мутация: текущий пользователь и общие помощники. */
abstract class BaseMutation extends Mutation
{
    protected function user(): User
    {
        return Context::requireUser();
    }
}
