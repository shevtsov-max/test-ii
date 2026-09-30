<?php

namespace App\GraphQL\Queries;

use App\GraphQL\Support\BaseQuery;
use App\Services\Notifications\UpcomingEvents;
use Carbon\CarbonImmutable;
use GraphQL\Type\Definition\Type;
use Rebing\GraphQL\Support\Facades\GraphQL;

/** Памятные даты по всем древам на ближайшие дни (блок «Сегодня» на главной). */
class UpcomingEventsQuery extends BaseQuery
{
    protected $attributes = ['name' => 'upcomingEvents', 'description' => 'Дни рождения и памятные даты по всем древам'];

    public function type(): Type
    {
        return Type::nonNull(Type::listOf(Type::nonNull(GraphQL::type('UpcomingEvent'))));
    }

    public function args(): array
    {
        return [
            'days' => ['type' => Type::int(), 'defaultValue' => 7],
            'timezone' => ['type' => Type::string(), 'description' => 'Часовой пояс пользователя, например Europe/Moscow'],
        ];
    }

    public function resolve($root, array $args, $ctx, UpcomingEvents $events): array
    {
        $tz = in_array($args['timezone'] ?? '', timezone_identifiers_list(), true) ? $args['timezone'] : 'Europe/Moscow';
        $days = max(0, min(60, (int) $args['days']));

        return $events->forUser($this->user(), CarbonImmutable::now($tz)->startOfDay(), $days);
    }
}
