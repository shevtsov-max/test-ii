<?php

namespace App\Console\Commands;

use GraphQL\Utils\SchemaPrinter;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Rebing\GraphQL\Support\Facades\GraphQL;

/**
 * Схема GraphQL в формате SDL, собранная из классов app/GraphQL.
 * Проверяет схему и обновляет контракт для фронтенда: php artisan graphql:print-schema --output=../docs/api/schema.graphql
 */
#[Signature('graphql:print-schema {--output= : Записать в файл}')]
#[Description('Проверить схему GraphQL и вывести её в формате SDL')]
class PrintGraphQLSchema extends Command
{
    public function handle(): int
    {
        $schema = GraphQL::schema();
        $schema->assertValid();
        $sdl = "# Сгенерировано командой `php artisan graphql:print-schema` из backend/app/GraphQL — не редактировать вручную.\n"
            ."# Описание протокола — docs/api/README.md\n\n"
            .SchemaPrinter::doPrint($schema);
        if ($file = $this->option('output')) {
            file_put_contents($file, $sdl);
            $this->info("Схема записана: {$file}");
        } else {
            $this->line($sdl);
        }

        return self::SUCCESS;
    }
}
