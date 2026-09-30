<?php

namespace App\Domain;

/**
 * Ветка древа: персона, все её потомки и их супруги/партнёры — то, что можно передать родственнику.
 * Работает с TreeData в виде массивов: ['persons' => [id => person], 'families' => [id => family], …].
 */
final class Branch
{
    /**
     * Идентификаторы персон ветки.
     *
     * @return list<string>
     */
    public static function personIds(array $tree, string $rootId): array
    {
        if (! isset($tree['persons'][$rootId])) {
            return [];
        }
        $in = [$rootId => true];
        $queue = [$rootId];
        while ($queue) {
            $id = array_shift($queue);
            foreach ($tree['families'] as $f) {
                if (! in_array($id, $f['partners'], true)) {
                    continue;
                }
                foreach ($f['partners'] as $p) {
                    if (isset($tree['persons'][$p])) {
                        $in[$p] = true;
                    }
                }
                foreach ($f['children'] as $c) {
                    if (isset($tree['persons'][$c]) && ! isset($in[$c])) {
                        $in[$c] = true;
                        $queue[] = $c;
                    }
                }
            }
        }

        return array_keys($in);
    }

    /**
     * Семьи ветки: все партнёры — в ветке (семья корня, семьи потомков).
     * Семья родителей корня остаётся в исходном древе.
     *
     * @param  list<string>  $personIds
     * @return list<string>
     */
    public static function familyIds(array $tree, array $personIds): array
    {
        $set = array_flip($personIds);
        $out = [];
        foreach ($tree['families'] as $id => $f) {
            if ($f['partners'] && ! array_diff($f['partners'], array_keys($set))) {
                $out[] = (string) $id;
            }
        }

        return $out;
    }

    /**
     * Данные ветки для показа или копирования: персоны, семьи и всё, на что они ссылаются
     * (места с родительскими, источники, роды, фото и документы).
     *
     * @param  bool  $withParents  добавить родителей корня (для контекста в новом древе родственника)
     */
    public static function extract(array $tree, string $rootId, bool $withParents = false): array
    {
        $personIds = self::personIds($tree, $rootId);
        $familyIds = self::familyIds($tree, $personIds);

        if ($withParents) {
            foreach ($tree['families'] as $id => $f) {
                if (in_array($rootId, $f['children'], true) && $f['partners']) {
                    $familyIds[] = (string) $id;
                    foreach ($f['partners'] as $p) {
                        if (isset($tree['persons'][$p]) && ! in_array($p, $personIds, true)) {
                            $personIds[] = $p;
                        }
                    }
                    break;
                }
            }
        }

        $set = array_flip($personIds);
        $out = ['persons' => [], 'families' => [], 'places' => [], 'media' => [], 'sources' => [], 'clans' => []];
        foreach ($personIds as $id) {
            $out['persons'][$id] = $tree['persons'][$id];
        }
        foreach (array_unique($familyIds) as $id) {
            $f = $tree['families'][$id];
            // Родительская семья корня: в новом древе — только корень, без его братьев и сестёр
            $f['children'] = array_values(array_filter($f['children'], fn ($c) => isset($set[$c])));
            $f['childLinks'] = array_intersect_key($f['childLinks'] ?? [], array_flip($f['children']));
            $out['families'][$id] = $f;
        }
        foreach ($tree['media'] ?? [] as $id => $m) {
            if (array_intersect($m['personIds'], $personIds)) {
                $m['personIds'] = array_values(array_intersect($m['personIds'], $personIds));
                $out['media'][$id] = $m;
            }
        }

        // Ссылки на места, источники и роды
        $places = [];
        $sources = [];
        $clans = [];
        $collect = function (array $point) use (&$places, &$sources) {
            if (! empty($point['placeId'])) {
                $places[$point['placeId']] = true;
            }
            foreach ($point['citations'] ?? [] as $c) {
                $sources[$c['sourceId']] = true;
            }
        };
        foreach ($out['persons'] as $p) {
            $collect($p['birth']);
            $collect($p['death']);
            array_map($collect, $p['events']);
            foreach ($p['citations'] as $c) {
                $sources[$c['sourceId']] = true;
            }
            if (! empty($p['residencePlaceId'])) {
                $places[$p['residencePlaceId']] = true;
            }
            if (! empty($p['clanId'])) {
                $clans[$p['clanId']] = true;
            }
        }
        foreach ($out['families'] as $f) {
            $collect($f['marriage']);
            $collect($f['divorce']);
            foreach ($f['citations'] as $c) {
                $sources[$c['sourceId']] = true;
            }
        }
        foreach ($out['media'] as $m) {
            if (! empty($m['placeId'])) {
                $places[$m['placeId']] = true;
            }
            if (! empty($m['sourceId'])) {
                $sources[$m['sourceId']] = true;
            }
        }
        // Места вместе с «родителями»: Россия → Тверская губерния → Тверь
        foreach (array_keys($places) as $pid) {
            $guard = 0;
            while ($pid && isset($tree['places'][$pid]) && $guard++ < 20) {
                $out['places'][$pid] = $tree['places'][$pid];
                $pid = $tree['places'][$pid]['parentId'] ?? null;
            }
        }
        foreach (array_keys($sources) as $sid) {
            if (isset($tree['sources'][$sid])) {
                $out['sources'][$sid] = $tree['sources'][$sid];
            }
        }
        foreach (array_keys($clans) as $cid) {
            if (isset($tree['clans'][$cid])) {
                $out['clans'][$cid] = $tree['clans'][$cid];
            }
        }

        return $out;
    }
}
