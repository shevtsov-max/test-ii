<?php

namespace App\Domain;

/**
 * Серверная проверка и нормализация сущностей древа.
 *
 * Клиент присылает сущности целиком (JSON). Здесь каждая приводится к модели из frontend/src/domain/types.js:
 * известные поля с правильными типами и значениями по умолчанию, неизвестные — отбрасываются,
 * значения перечислений — только допустимые, строки — ограниченной длины. Так в базе не появится мусор,
 * а ответы GraphQL всегда соответствуют схеме (non-null поля заполнены).
 */
final class TreeSchema
{
    public const GENDERS = ['M', 'F', 'U'];

    public const QUALIFIERS = ['exact', 'about', 'estimated', 'calculated', 'before', 'after', 'between'];

    public const FAMILY_STATUSES = ['married', 'partners', 'engaged', 'separated', 'divorced', 'widowed', 'unknown'];

    public const CHILD_LINKS = ['birth', 'adopted', 'foster', 'step', 'guardian', 'unknown'];

    public const EVENT_TYPES = ['baptism', 'education', 'occupation', 'residence', 'military', 'award', 'emigration', 'immigration', 'census', 'religion', 'nationality', 'namechange', 'illness', 'burial', 'custom'];

    public const PLACE_TYPES = ['country', 'region', 'district', 'city', 'village', 'address', 'church', 'cemetery', 'other'];

    public const MEDIA_KINDS = ['photo', 'document', 'audio', 'video', 'other'];

    public const SOURCE_TYPES = ['metric', 'revision', 'census', 'archive', 'document', 'book', 'website', 'oral', 'other'];

    public const PRIVACY = ['public', 'family', 'private'];

    public const CUSTOM_FIELD_TYPES = ['text', 'number', 'date', 'url'];

    /** Коллекции древа и их нормализаторы */
    public const COLLECTIONS = ['persons', 'families', 'places', 'media', 'sources', 'clans'];

    public static function normalize(string $collection, array $e): array
    {
        return match ($collection) {
            'persons' => self::person($e),
            'families' => self::family($e),
            'places' => self::place($e),
            'media' => self::media($e),
            'sources' => self::source($e),
            'clans' => self::clan($e),
        };
    }

    public static function person(array $p): array
    {
        $now = (int) round(microtime(true) * 1000);

        return [
            'id' => self::id($p['id'] ?? null),
            'gender' => self::enum($p['gender'] ?? null, self::GENDERS, 'U'),
            'firstName' => self::str($p['firstName'] ?? '', 100),
            'middleName' => self::str($p['middleName'] ?? '', 100),
            'lastName' => self::str($p['lastName'] ?? '', 100),
            'birthName' => self::str($p['birthName'] ?? '', 100),
            'nickname' => self::str($p['nickname'] ?? '', 100),
            'title' => self::str($p['title'] ?? '', 100),
            'suffix' => self::str($p['suffix'] ?? '', 30),
            'clanId' => self::nullableId($p['clanId'] ?? null),
            'living' => (bool) ($p['living'] ?? true),
            'birth' => self::point($p['birth'] ?? null),
            'death' => self::point($p['death'] ?? null) + ['cause' => self::str(is_array($p['death'] ?? null) ? ($p['death']['cause'] ?? '') : '', 500)],
            'residencePlaceId' => self::nullableId($p['residencePlaceId'] ?? null),
            'occupation' => self::str($p['occupation'] ?? '', 300),
            'email' => self::str($p['email'] ?? '', 190),
            'phone' => self::str($p['phone'] ?? '', 50),
            'avatarId' => self::nullableId($p['avatarId'] ?? null),
            'note' => self::str($p['note'] ?? '', 20000),
            'biography' => self::str($p['biography'] ?? '', 100000),
            'events' => array_values(array_map(self::event(...), self::list($p['events'] ?? [], 500))),
            'custom' => self::stringMap($p['custom'] ?? [], 2000),
            'citations' => self::citations($p['citations'] ?? []),
            'favorite' => (bool) ($p['favorite'] ?? false),
            'privacy' => self::enum($p['privacy'] ?? null, self::PRIVACY, 'public'),
            'createdAt' => self::int($p['createdAt'] ?? null) ?? $now,
            'updatedAt' => self::int($p['updatedAt'] ?? null) ?? $now,
        ];
    }

    public static function family(array $f): array
    {
        $children = self::idList($f['children'] ?? [], 200);
        $links = [];
        foreach (self::stringMap($f['childLinks'] ?? [], 20) as $child => $link) {
            if (in_array($child, $children, true) && in_array($link, self::CHILD_LINKS, true) && $link !== 'birth') {
                $links[$child] = $link;
            }
        }

        return [
            'id' => self::id($f['id'] ?? null),
            'partners' => array_slice(self::idList($f['partners'] ?? [], 2), 0, 2),
            'status' => self::enum($f['status'] ?? null, self::FAMILY_STATUSES, 'unknown'),
            'marriage' => self::point($f['marriage'] ?? null),
            'divorce' => self::point($f['divorce'] ?? null),
            'children' => $children,
            'childLinks' => $links,
            'note' => self::str($f['note'] ?? '', 20000),
            'citations' => self::citations($f['citations'] ?? []),
        ];
    }

    public static function place(array $p): array
    {
        return [
            'id' => self::id($p['id'] ?? null),
            'name' => self::str($p['name'] ?? '', 300),
            'type' => self::enum($p['type'] ?? null, self::PLACE_TYPES, 'other'),
            'parentId' => self::nullableId($p['parentId'] ?? null),
            'lat' => self::float($p['lat'] ?? null, -90, 90),
            'lng' => self::float($p['lng'] ?? null, -180, 180),
            'altNames' => self::str($p['altNames'] ?? '', 1000),
            'note' => self::str($p['note'] ?? '', 5000),
        ];
    }

    public static function media(array $m): array
    {
        return [
            'id' => self::id($m['id'] ?? null),
            'kind' => self::enum($m['kind'] ?? null, self::MEDIA_KINDS, 'other'),
            'title' => self::str($m['title'] ?? '', 300),
            'description' => self::str($m['description'] ?? '', 20000),
            'date' => self::date($m['date'] ?? null),
            'placeId' => self::nullableId($m['placeId'] ?? null),
            'personIds' => self::idList($m['personIds'] ?? [], 500),
            'sourceId' => self::nullableId($m['sourceId'] ?? null),
            // Ссылки на файлы; data:-адреса сервер выносит в файлы до сохранения (MediaStorage)
            'src' => self::nullableStr($m['src'] ?? null, 20_000_000),
            'thumb' => self::nullableStr($m['thumb'] ?? null, 2_000_000),
            'mime' => self::str($m['mime'] ?? '', 100),
            'size' => max(0, self::int($m['size'] ?? 0) ?? 0),
            'createdAt' => self::int($m['createdAt'] ?? null) ?? (int) round(microtime(true) * 1000),
        ];
    }

    public static function source(array $s): array
    {
        return [
            'id' => self::id($s['id'] ?? null),
            'title' => self::str($s['title'] ?? '', 500),
            'type' => self::enum($s['type'] ?? null, self::SOURCE_TYPES, 'other'),
            'author' => self::str($s['author'] ?? '', 300),
            'repository' => self::str($s['repository'] ?? '', 300),
            'callNumber' => self::str($s['callNumber'] ?? '', 300),
            'url' => self::str($s['url'] ?? '', 2000),
            'date' => self::date($s['date'] ?? null),
            'note' => self::str($s['note'] ?? '', 20000),
        ];
    }

    public static function clan(array $c): array
    {
        $color = is_string($c['color'] ?? null) && preg_match('/^#[0-9a-fA-F]{6}$/', $c['color']) ? $c['color'] : '#C2410C';

        return [
            'id' => self::id($c['id'] ?? null),
            'name' => self::str($c['name'] ?? '', 200),
            'color' => $color,
            'description' => self::str($c['description'] ?? '', 5000),
        ];
    }

    /** @return list<array{id: string, label: string, type: string}> */
    public static function customFields(mixed $list): array
    {
        $out = [];
        foreach (self::list($list, 100) as $f) {
            $out[] = [
                'id' => self::id($f['id'] ?? null),
                'label' => self::str($f['label'] ?? '', 100),
                'type' => self::enum($f['type'] ?? null, self::CUSTOM_FIELD_TYPES, 'text'),
            ];
        }

        return $out;
    }

    // ------------------------------------------------------------------ составные части

    public static function date(mixed $d): array
    {
        $d = is_array($d) ? $d : [];
        $out = [
            'qualifier' => self::enum($d['qualifier'] ?? null, self::QUALIFIERS, 'exact'),
            'day' => self::intRange($d['day'] ?? null, 1, 31),
            'month' => self::intRange($d['month'] ?? null, 1, 12),
            'year' => self::intRange($d['year'] ?? null, -5000, 3000),
            'day2' => self::intRange($d['day2'] ?? null, 1, 31),
            'month2' => self::intRange($d['month2'] ?? null, 1, 12),
            'year2' => self::intRange($d['year2'] ?? null, -5000, 3000),
            'calendar' => ($d['calendar'] ?? null) === 'julian' ? 'julian' : null,
            'text' => self::nullableStr($d['text'] ?? null, 300),
        ];

        return $out;
    }

    public static function point(mixed $p): array
    {
        $p = is_array($p) ? $p : [];

        return [
            'date' => self::date($p['date'] ?? null),
            'placeId' => self::nullableId($p['placeId'] ?? null),
            'citations' => self::citations($p['citations'] ?? []),
        ];
    }

    public static function event(mixed $e): array
    {
        $e = is_array($e) ? $e : [];

        return [
            'id' => self::id($e['id'] ?? null),
            'type' => self::enum($e['type'] ?? null, self::EVENT_TYPES, 'custom'),
            'title' => self::str($e['title'] ?? '', 200),
            'date' => self::date($e['date'] ?? null),
            'placeId' => self::nullableId($e['placeId'] ?? null),
            'description' => self::str($e['description'] ?? '', 20000),
            'citations' => self::citations($e['citations'] ?? []),
        ];
    }

    public static function citations(mixed $list): array
    {
        $out = [];
        foreach (self::list($list, 200) as $c) {
            $out[] = [
                'id' => self::id($c['id'] ?? null),
                'sourceId' => self::str($c['sourceId'] ?? '', 64),
                'page' => self::str($c['page'] ?? '', 500),
                'quality' => self::intRange($c['quality'] ?? 2, 0, 3) ?? 2,
                'note' => self::str($c['note'] ?? '', 5000),
            ];
        }

        return $out;
    }

    // ------------------------------------------------------------------ примитивы

    /** Идентификатор сущности (его создаёт клиент), см. isValidId(). */
    public static function id(mixed $v): string
    {
        $s = is_scalar($v) ? (string) $v : '';
        if (! self::isValidId($s)) {
            throw new \InvalidArgumentException('Недопустимый идентификатор записи: '.mb_substr($s, 0, 70));
        }

        return $s;
    }

    /** Допустимый id записи: буквы (в том числе кириллица), цифры и «_-.:@», до 64 символов. */
    public static function isValidId(mixed $v): bool
    {
        return is_string($v) && preg_match('/^[\p{L}\p{N}_\-.:@]{1,64}$/u', $v) === 1;
    }

    private static function nullableId(mixed $v): ?string
    {
        return self::isValidId($v) ? $v : null;
    }

    private static function idList(mixed $v, int $max): array
    {
        $out = [];
        foreach (is_array($v) ? $v : [] as $x) {
            if (self::isValidId($x) && ! in_array($x, $out, true)) {
                $out[] = $x;
            }
            if (count($out) >= $max) {
                break;
            }
        }

        return $out;
    }

    private static function str(mixed $v, int $max): string
    {
        if (! is_scalar($v)) {
            return '';
        }
        $s = (string) $v;

        return mb_strlen($s) > $max ? mb_substr($s, 0, $max) : $s;
    }

    private static function nullableStr(mixed $v, int $max): ?string
    {
        return is_string($v) && $v !== '' ? self::str($v, $max) : null;
    }

    private static function enum(mixed $v, array $allowed, string $default): string
    {
        return is_string($v) && in_array($v, $allowed, true) ? $v : $default;
    }

    private static function int(mixed $v): ?int
    {
        return is_numeric($v) ? (int) $v : null;
    }

    private static function intRange(mixed $v, int $min, int $max): ?int
    {
        if (! is_numeric($v)) {
            return null;
        }
        $n = (int) $v;

        return $n >= $min && $n <= $max ? $n : null;
    }

    private static function float(mixed $v, float $min, float $max): ?float
    {
        if (! is_numeric($v)) {
            return null;
        }
        $n = (float) $v;

        return $n >= $min && $n <= $max ? $n : null;
    }

    /** @return list<array> */
    private static function list(mixed $v, int $max): array
    {
        if (! is_array($v)) {
            return [];
        }

        return array_values(array_slice(array_filter($v, 'is_array'), 0, $max));
    }

    /** Словарь «строка → строка» (дополнительные поля, childLinks). */
    private static function stringMap(mixed $v, int $maxLen): array
    {
        $out = [];
        foreach (is_array($v) ? $v : [] as $k => $x) {
            if (self::isValidId((string) $k) && is_scalar($x)) {
                $out[(string) $k] = self::str($x, $maxLen);
            }
        }

        return $out;
    }
}
