<?php

namespace App\GraphQL\Mutations;

use App\GraphQL\Support\BaseMutation;
use App\Models\NotificationSetting;
use App\Services\Notifications\NotificationSettingsPresenter;
use GraphQL\Type\Definition\Type;
use Illuminate\Validation\Rule;
use Rebing\GraphQL\Support\Facades\GraphQL;

class UpdateNotificationSettingsMutation extends BaseMutation
{
    protected $attributes = ['name' => 'updateNotificationSettings', 'description' => 'Изменить настройки уведомлений'];

    public function type(): Type
    {
        return Type::nonNull(GraphQL::type('NotificationSettings'));
    }

    public function args(): array
    {
        return ['input' => ['type' => Type::nonNull(GraphQL::type('NotificationSettingsInput'))]];
    }

    protected function rules(array $args = []): array
    {
        return [
            'input.sendTime' => ['sometimes', 'string', 'regex:/^([01]\d|2[0-3]):[0-5]\d$/'],
            'input.timezone' => ['sometimes', 'string', Rule::in(timezone_identifiers_list())],
        ];
    }

    public function resolve($root, array $args, $ctx, NotificationSettingsPresenter $presenter): array
    {
        $user = $this->user();
        $input = $args['input'];
        $s = NotificationSetting::firstOrNew(['user_id' => $user->id]);
        foreach (['enabled', 'birthdays', 'anniversaries', 'memorials'] as $k) {
            if (array_key_exists($k, $input) && $input[$k] !== null) {
                $s->{$k} = (bool) $input[$k];
            }
        }
        if (! empty($input['sendTime'])) {
            $s->send_time = $input['sendTime'];
            $s->last_sent_on = null;
        }
        if (! empty($input['timezone'])) {
            $s->timezone = $input['timezone'];
        }
        $s->save();

        return $presenter->present($user);
    }
}
