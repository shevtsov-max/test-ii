<?php

namespace App\GraphQL\Support;

use App\Models\User;
use Rebing\GraphQL\Support\Query;

/** Базовый запрос: текущий пользователь и общие помощники. */
abstract class BaseQuery extends Query
{
    protected function user(): User
    {
        return Context::requireUser();
    }
}
