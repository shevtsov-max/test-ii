<?php

namespace App\Services\Trees;

use App\Domain\Names;
use App\Domain\TreeSchema;
use App\GraphQL\Support\ApiError;
use App\Models\Tree;
use App\Models\User;
use App\Services\Delegations\DelegationService;
use App\Services\Media\MediaStorage;
use Illuminate\Support\Facades\DB;

/**
 * Хранение содержимого древ.
 *
 * TreeData (как во фронтенде): ['persons' => [id => Person], 'families' => […], 'places', 'media', 'sources', 'clans'].
 * Каждая сущность — строка в своей таблице (tree_persons…): data (JSON) + version (версия древа, когда запись менялась).
 */
final class TreeRepository
{
    /** Коллекция TreeData → таблица */
    public const TABLES = [
        'persons' => 'tree_persons',
        'families' => 'tree_families',
        'places' => 'tree_places',
        'media' => 'tree_media',
        'sources' => 'tree_sources',
        'clans' => 'tree_clans',
    ];

    public function __construct(private readonly MediaStorage $media) {}

    /**
     * Всё содержимое древа.
     *
     * @param  list<string>|null  $only  только эти коллекции
     */
    public function load(Tree $tree, ?array $only = null): array
    {
        $out = [];
        foreach (self::TABLES as $collection => $table) {
            if ($only && ! in_array($collection, $only, true)) {
                continue;
            }
            $out[$collection] = [];
            foreach (DB::table($table)->where('tree_id', $tree->id)->orderBy('id')->get(['id', 'data']) as $row) {
                $out[$collection][$row->id] = json_decode($row->data, true);
            }
        }

        return $out;
    }

    /** Полные данные для GraphQL-типа Tree (коллекции — списками). */
    public function forGraphQL(Tree $tree, string $role): array
    {
        $data = $this->load($tree);

        return [
            'id' => $tree->id,
            'name' => $tree->name,
            'description' => $tree->description,
            'homePersonId' => $tree->home_person_id,
            'version' => $tree->version,
            'role' => $role,
            'createdAt' => $tree->created_at,
            'updatedAt' => $tree->updated_at,
            'customFields' => $tree->custom_fields ?? [],
        ] + array_map('array_values', $data);
    }

    /** Создать древо из TreeData (новое, импорт, пример, ветка родственника). */
    public function create(User $owner, string $name, string $description, array $data): Tree
    {
        $limit = config('rodoslovnaya.trees.max_per_user');
        if (Tree::where('owner_id', $owner->id)->count() >= $limit) {
            throw ApiError::validation("Можно создать не больше {$limit} древ");
        }

        return DB::transaction(function () use ($owner, $name, $description, $data) {
            $tree = Tree::create([
                'owner_id' => $owner->id,
                'name' => mb_substr(trim($name) ?: 'Моё семейное древо', 0, 200),
                'description' => mb_substr($description, 0, 5000),
                'home_person_id' => null,
                'custom_fields' => TreeSchema::customFields($data['customFields'] ?? []),
                'version' => $this->nextVersion(0),
            ]);
            $this->writeAll($tree, $data);
            $home = $data['homePersonId'] ?? null;
            $tree->home_person_id = is_string($home) && isset($data['persons'][$home]) ? $home : array_key_first($data['persons'] ?? []);
            $this->refreshSummary($tree);
            $tree->save();

            return $tree;
        });
    }

    /**
     * Сохранить изменения (мутация applyTreeChanges).
     *
     * @param  array  $changes  см. TreeChangesInput в docs/api/schema.graphql
     * @return array{version: int, updatedAt: \DateTimeInterface}
     */
    public function apply(Tree $tree, array $changes, DelegationService $delegations): array
    {
        return DB::transaction(function () use ($tree, $changes, $delegations) {
            /** @var Tree $tree */
            $tree = Tree::whereKey($tree->id)->lockForUpdate()->firstOrFail();
            $base = isset($changes['baseVersion']) ? (int) $changes['baseVersion'] : null;
            $locked = array_flip($delegations->lockedPersonIds($tree));
            $version = $this->nextVersion($tree->version);

            if (isset($changes['replace'])) {
                if ($locked) {
                    throw ApiError::conflict('Часть древа передана родственнику — сначала склонируйте ветки себе, затем импортируйте данные');
                }
                $data = $changes['replace'];
                foreach (self::TABLES as $table) {
                    DB::table($table)->where('tree_id', $tree->id)->delete();
                }
                $tree->version = $version;
                $this->writeAll($tree, $data);
                $this->applyInfo($tree, $data);
            } else {
                foreach (self::TABLES as $collection => $table) {
                    $key = ucfirst($collection);
                    $upserts = [];
                    foreach ($changes["upsert{$key}"] ?? [] as $raw) {
                        $entity = $this->normalize($collection, $raw);
                        $upserts[$entity['id']] = $entity;
                    }
                    $deletes = array_values(array_filter($changes["delete{$key}"] ?? [], [TreeSchema::class, 'isValidId']));
                    $ids = array_merge(array_keys($upserts), $deletes);
                    if (! $ids) {
                        continue;
                    }
                    $existing = DB::table($table)->where('tree_id', $tree->id)->whereIn('id', $ids)->get(['id', 'data', 'version'])->keyBy('id');

                    // Конфликт: запись поменял кто-то другой после версии, от которой отталкивался клиент
                    if ($base !== null) {
                        $stale = $existing->filter(fn ($r) => (int) $r->version > $base)->keys();
                        if ($stale->isNotEmpty()) {
                            throw ApiError::conflict('Эти данные только что изменил другой участник древа. Древо обновлено — повторите правку.');
                        }
                    }
                    $this->assertNotLocked($collection, $upserts, $deletes, $existing, $locked);

                    if ($collection === 'media') {
                        $upserts = array_map(fn ($m) => $this->media->externalize($tree, $m), $upserts);
                    }
                    $this->upsertRows($tree, $table, $upserts, $version);
                    if ($deletes) {
                        DB::table($table)->where('tree_id', $tree->id)->whereIn('id', $deletes)->delete();
                    }
                }
                if (! empty($changes['tree'])) {
                    $this->applyInfo($tree, $changes['tree']);
                }
            }

            $this->assertLimits($tree);
            $tree->version = $version;
            $this->refreshSummary($tree);
            $tree->save();

            return ['version' => $tree->version, 'updatedAt' => $tree->updated_at];
        });
    }

    /** Записать все сущности TreeData (в пустое древо). */
    public function writeAll(Tree $tree, array $data): void
    {
        foreach (self::TABLES as $collection => $table) {
            $rows = [];
            foreach ($data[$collection] ?? [] as $raw) {
                if (! is_array($raw)) {
                    continue;
                }
                $entity = $this->normalize($collection, $raw);
                if ($collection === 'media') {
                    $entity = $this->media->externalize($tree, $entity);
                }
                $rows[$entity['id']] = $entity;
            }
            $this->upsertRows($tree, $table, $rows, $tree->version);
        }
        $this->assertLimits($tree);
    }

    /** @param array<string, array> $entities */
    public function upsertRows(Tree $tree, string $table, array $entities, int $version): void
    {
        $rows = [];
        foreach ($entities as $id => $e) {
            $rows[] = [
                'tree_id' => $tree->id,
                'id' => $id,
                'data' => json_encode($e, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR),
                'version' => $version,
            ];
        }
        foreach (array_chunk($rows, 500) as $chunk) {
            DB::table($table)->upsert($chunk, ['tree_id', 'id'], ['data', 'version']);
        }
    }

    /** Пересчитать сводку для списка «Мои древа». */
    public function refreshSummary(Tree $tree): void
    {
        $tree->persons_count = DB::table('tree_persons')->where('tree_id', $tree->id)->count();
        $tree->families_count = DB::table('tree_families')->where('tree_id', $tree->id)->count();
        $tree->media_count = DB::table('tree_media')->where('tree_id', $tree->id)->count();
        $home = $tree->home_person_id
            ? DB::table('tree_persons')->where('tree_id', $tree->id)->where('id', $tree->home_person_id)->value('data')
            : null;
        $person = $home ? json_decode($home, true) : null;
        $tree->home_name = $person ? mb_substr(Names::short($person), 0, 200) : null;
        $tree->home_gender = $person['gender'] ?? null;
        $thumb = null;
        if (! empty($person['avatarId'])) {
            $m = DB::table('tree_media')->where('tree_id', $tree->id)->where('id', $person['avatarId'])->value('data');
            $m = $m ? json_decode($m, true) : null;
            $thumb = $m['thumb'] ?? $m['src'] ?? null;
        }
        $tree->home_thumb = $thumb && ! str_starts_with($thumb, 'data:') ? $thumb : null;
    }

    public function summary(Tree $tree, string $role): array
    {
        return [
            'id' => $tree->id,
            'name' => $tree->name,
            'description' => $tree->description,
            'persons' => $tree->persons_count,
            'families' => $tree->families_count,
            'media' => $tree->media_count,
            'homeName' => $tree->home_name,
            'homeThumb' => $tree->home_thumb,
            'homeGender' => $tree->home_gender,
            'role' => $role,
            'createdAt' => $tree->created_at,
            'updatedAt' => $tree->updated_at,
        ];
    }

    /** Версия древа — миллисекунды Unix, строго больше предыдущей. */
    public function nextVersion(int $current): int
    {
        return max((int) floor(microtime(true) * 1000), $current + 1);
    }

    // ------------------------------------------------------------------ внутреннее

    private function normalize(string $collection, mixed $raw): array
    {
        if (! is_array($raw)) {
            throw ApiError::validation('Некорректные данные древа');
        }
        try {
            $entity = TreeSchema::normalize($collection, $raw);
        } catch (\InvalidArgumentException $e) {
            throw ApiError::validation($e->getMessage());
        }
        $size = strlen(json_encode($entity, JSON_UNESCAPED_UNICODE));
        // У медиа data:-адрес ещё не вынесен в файл — его размер проверяет MediaStorage
        if ($collection !== 'media' && $size > config('rodoslovnaya.trees.max_entity_bytes')) {
            throw ApiError::validation('Слишком большая запись: сократите биографию или заметки');
        }

        return $entity;
    }

    private function applyInfo(Tree $tree, array $info): void
    {
        if (array_key_exists('name', $info) && is_string($info['name']) && trim($info['name']) !== '') {
            $tree->name = mb_substr(trim($info['name']), 0, 200);
        }
        if (array_key_exists('description', $info) && is_string($info['description'])) {
            $tree->description = mb_substr($info['description'], 0, 5000);
        }
        if (array_key_exists('customFields', $info)) {
            $tree->custom_fields = TreeSchema::customFields($info['customFields']);
        }
        if (array_key_exists('homePersonId', $info)) {
            $id = $info['homePersonId'];
            $tree->home_person_id = TreeSchema::isValidId($id) ? $id : null;
        }
    }

    /** Персоны и семьи переданной ветки меняет только родственник, которому её передали. */
    private function assertNotLocked(string $collection, array $upserts, array $deletes, $existing, array $locked): void
    {
        if (! $locked) {
            return;
        }
        $touched = array_merge(array_keys($upserts), $deletes);
        if ($collection === 'persons' && array_intersect_key(array_flip($touched), $locked)) {
            throw ApiError::forbidden('Эта ветка передана родственнику и доступна только для просмотра. Чтобы изменить её, склонируйте ветку себе.');
        }
        if ($collection === 'families') {
            foreach ($touched as $id) {
                $partners = $upserts[$id]['partners'] ?? (isset($existing[$id]) ? json_decode($existing[$id]->data, true)['partners'] : []);
                $old = isset($existing[$id]) ? json_decode($existing[$id]->data, true)['partners'] : [];
                // Семья, где хотя бы один из супругов — из переданной ветки, тоже часть ветки (см. Branch::personIds)
                foreach ([$partners, $old] as $list) {
                    if (array_intersect_key(array_flip($list), $locked)) {
                        throw ApiError::forbidden('Эта ветка передана родственнику и доступна только для просмотра. Чтобы изменить её, склонируйте ветку себе.');
                    }
                }
            }
        }
    }

    private function assertLimits(Tree $tree): void
    {
        $max = config('rodoslovnaya.trees.max_entities');
        $n = DB::table('tree_persons')->where('tree_id', $tree->id)->count();
        if ($n > $max) {
            throw ApiError::validation("В древе может быть не больше {$max} персон");
        }
    }
}
