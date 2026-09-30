<?php

namespace App\GraphQL\Queries;

use App\GraphQL\Support\BaseQuery;
use App\Services\Notifications\NotificationSettingsPresenter;
use GraphQL\Type\Definition\Type;
use Rebing\GraphQL\Support\Facades\GraphQL;

class NotificationSettingsQuery extends BaseQuery
{
    protected $attributes = ['name' => 'notificationSettings', 'description' => 'Настройки уведомлений о памятных датах'];

    public function type(): Type
    {
        return Type::nonNull(GraphQL::type('NotificationSettings'));
    }

    public function resolve($root, array $args, $ctx, NotificationSettingsPresenter $presenter): array
    {
        return $presenter->present($this->user());
    }
}
