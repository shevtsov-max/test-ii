<?php

namespace Tests;

use App\Models\User;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Testing\TestResponse;

abstract class TestCase extends BaseTestCase
{
    /** Выполнить GraphQL-запрос (с токеном — от имени пользователя). */
    protected function graphql(string $query, array $variables = [], ?string $token = null): TestResponse
    {
        $headers = $token ? ['Authorization' => 'Bearer '.$token] : [];
        // Как Octane между запросами: пользователь определяется заново по токену
        $this->app['auth']->forgetGuards();

        return $this->postJson('/graphql', ['query' => $query, 'variables' => $variables], $headers);
    }

    /** Данные ответа; при ошибках GraphQL тест падает с понятным сообщением. */
    protected function gqlData(string $query, array $variables = [], ?string $token = null): array
    {
        $res = $this->graphql($query, $variables, $token);
        $json = $res->json();
        $this->assertArrayNotHasKey('errors', $json, 'GraphQL: '.json_encode($json['errors'] ?? null, JSON_UNESCAPED_UNICODE));

        return $json['data'];
    }

    /** Код первой ошибки GraphQL (extensions.code). */
    protected function gqlErrorCode(string $query, array $variables = [], ?string $token = null): ?string
    {
        return $this->graphql($query, $variables, $token)->json('errors.0.extensions.code');
    }

    /** Пользователь и токен доступа. @return array{0: User, 1: string} */
    protected function login(?User $user = null): array
    {
        $user ??= User::factory()->create();

        return [$user, $user->createToken('test')->plainTextToken];
    }

    /** Текущие редакции документов для регистрации. */
    protected function consents(): array
    {
        return collect(config('rodoslovnaya.legal'))
            ->filter(fn ($d) => $d['required'])
            ->map(fn ($d, $doc) => ['document' => $doc, 'version' => $d['version']])
            ->values()
            ->all();
    }

    /** Небольшое древо: дед и бабушка, их сын с женой и двое внуков. */
    protected function sampleTreeData(): array
    {
        $p = fn ($id, $g, $first, $last, $year = null, $extra = []) => array_merge([
            'id' => $id, 'gender' => $g, 'firstName' => $first, 'lastName' => $last, 'living' => true,
            'birth' => ['date' => ['qualifier' => 'exact', 'year' => $year, 'month' => null, 'day' => null], 'placeId' => null, 'citations' => []],
        ], $extra);

        return [
            'homePersonId' => 'me',
            'persons' => [
                'gf' => $p('gf', 'M', 'Пётр', 'Орлов', 1930, ['living' => false]),
                'gm' => $p('gm', 'F', 'Анна', 'Орлова', 1932, ['living' => false]),
                'fa' => $p('fa', 'M', 'Сергей', 'Орлов', 1956),
                'mo' => $p('mo', 'F', 'Ирина', 'Орлова', 1959),
                'me' => $p('me', 'M', 'Алексей', 'Орлов', 1985),
                'sis' => $p('sis', 'F', 'Дарья', 'Орлова', 1989),
                'uncle' => $p('uncle', 'M', 'Виктор', 'Орлов', 1953),
                'cousin' => $p('cousin', 'M', 'Денис', 'Орлов', 1980),
            ],
            'families' => [
                'f1' => ['id' => 'f1', 'partners' => ['gf', 'gm'], 'status' => 'married', 'children' => ['uncle', 'fa']],
                'f2' => ['id' => 'f2', 'partners' => ['fa', 'mo'], 'status' => 'married', 'children' => ['me', 'sis']],
                'f3' => ['id' => 'f3', 'partners' => ['uncle'], 'status' => 'unknown', 'children' => ['cousin']],
            ],
            'places' => ['pl1' => ['id' => 'pl1', 'name' => 'Тверь', 'type' => 'city']],
        ];
    }
}
