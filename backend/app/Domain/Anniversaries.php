<?php

namespace App\Domain;

use Carbon\CarbonImmutable;

/**
 * Памятные даты на ближайшие дни: дни рождения живых, годовщины свадеб, дни памяти.
 * Логика совпадает с upcomingAnniversaries() во frontend/src/domain/stats.js.
 */
final class Anniversaries
{
    public const BIRTHDAY = 'birthday';

    public const WEDDING = 'wedding';

    public const MEMORY_BIRTH = 'memory-birth';

    public const MEMORY_DEATH = 'memory-death';

    /** Порядок в пределах одного дня: сначала дни рождения живых */
    public const ORDER = [self::BIRTHDAY => 0, self::WEDDING => 1, self::MEMORY_BIRTH => 2, self::MEMORY_DEATH => 3];

    /**
     * @param  array  $tree  TreeData (persons, families — словари по id)
     * @param  array<string, bool>  $kinds  какие виды дат нужны
     * @return list<array{kind: string, personIds: list<string>, names: list<string>, date: string, inDays: int, years: ?int}>
     */
    public static function upcoming(array $tree, CarbonImmutable $today, int $days, array $kinds = []): array
    {
        $want = fn (string $k) => $kinds[$k] ?? true;
        $today = $today->startOfDay();
        $out = [];
        $add = function (?array $date, string $kind, array $personIds) use (&$out, $today, $days, $tree) {
            $md = Dates::monthDay($date);
            if (! $md) {
                return;
            }
            $next = self::occurrence($today->year, $md['month'], $md['day']);
            if ($next->lessThan($today)) {
                $next = self::occurrence($today->year + 1, $md['month'], $md['day']);
            }
            $inDays = (int) $today->diffInDays($next);
            if ($inDays > $days) {
                return;
            }
            $out[] = [
                'kind' => $kind,
                'personIds' => $personIds,
                'names' => array_map(fn ($id) => Names::short($tree['persons'][$id] ?? null), $personIds),
                'date' => $next->toDateString(),
                'inDays' => $inDays,
                'years' => ! empty($date['year']) ? $next->year - (int) $date['year'] : null,
            ];
        };

        foreach ($tree['persons'] as $id => $p) {
            if ($p['living']) {
                if ($want(self::BIRTHDAY)) {
                    $add($p['birth']['date'] ?? null, self::BIRTHDAY, [(string) $id]);
                }
            } elseif ($want('memorials')) {
                $add($p['birth']['date'] ?? null, self::MEMORY_BIRTH, [(string) $id]);
                $add($p['death']['date'] ?? null, self::MEMORY_DEATH, [(string) $id]);
            }
        }
        if ($want(self::WEDDING)) {
            foreach ($tree['families'] as $f) {
                $alive = count($f['partners']) === 2
                    && collect($f['partners'])->every(fn ($pid) => ($tree['persons'][$pid]['living'] ?? false) === true);
                if ($alive && in_array($f['status'], ['married', 'widowed'], true)) {
                    $add($f['marriage']['date'] ?? null, self::WEDDING, $f['partners']);
                }
            }
        }
        usort($out, fn ($a, $b) => [$a['inDays'], self::ORDER[$a['kind']]] <=> [$b['inDays'], self::ORDER[$b['kind']]]);

        return $out;
    }

    /** 29 февраля в невисокосный год отмечаем 28-го. */
    private static function occurrence(int $year, int $month, int $day): CarbonImmutable
    {
        $max = CarbonImmutable::create($year, $month, 1)->daysInMonth;

        return CarbonImmutable::create($year, $month, min($day, $max))->startOfDay();
    }

    /** Текст одной даты для сообщения: «Иван Петров — 35 лет». */
    public static function describe(array $e): string
    {
        $who = implode(' и ', $e['names']);
        $y = $e['years'];
        $years = $y !== null ? $y.' '.self::yearsWord($y) : null;

        return match ($e['kind']) {
            self::BIRTHDAY => $years ? "🎂 {$who} — исполняется {$years}" : "🎂 {$who} — день рождения",
            self::WEDDING => $years ? "💍 {$who} — {$years} со дня свадьбы" : "💍 {$who} — годовщина свадьбы",
            self::MEMORY_BIRTH => $years ? "🕯 {$who} — {$years} со дня рождения" : "🕯 {$who} — день рождения",
            self::MEMORY_DEATH => $years ? "🕯 {$who} — {$years} со дня смерти" : "🕯 {$who} — день памяти",
            default => $who,
        };
    }

    public static function yearsWord(int $n): string
    {
        $m10 = $n % 10;
        $m100 = $n % 100;
        if ($m10 === 1 && $m100 !== 11) {
            return 'год';
        }
        if ($m10 >= 2 && $m10 <= 4 && ($m100 < 12 || $m100 > 14)) {
            return 'года';
        }

        return 'лет';
    }
}
