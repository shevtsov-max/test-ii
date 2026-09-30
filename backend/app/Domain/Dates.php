<?php

namespace App\Domain;

/** Даты древа (GDate): перевод старого стиля и день/месяц для годовщин. Повторяет frontend/src/domain/dates.js. */
final class Dates
{
    /** Юлианская дата → григорианская через юлианский день. */
    public static function julianToGregorian(int $day, int $month, int $year): array
    {
        $a = intdiv(14 - $month, 12);
        $yy = $year + 4800 - $a;
        $mm = $month + 12 * $a - 3;
        $jdn = $day + intdiv(153 * $mm + 2, 5) + 365 * $yy + self::floorDiv($yy, 4) - 32083;

        $a = $jdn + 32044;
        $b = intdiv(4 * $a + 3, 146097);
        $c = $a - intdiv(146097 * $b, 4);
        $d = intdiv(4 * $c + 3, 1461);
        $e = $c - intdiv(1461 * $d, 4);
        $m = intdiv(5 * $e + 2, 153);

        return [
            'day' => $e - intdiv(153 * $m + 2, 5) + 1,
            'month' => $m + 3 - 12 * intdiv($m, 10),
            'year' => 100 * $b + $d - 4800 + intdiv($m, 10),
        ];
    }

    /**
     * День и месяц для годовщины (по новому стилю) или null, если точной даты нет.
     *
     * @return array{day: int, month: int}|null
     */
    public static function monthDay(?array $date): ?array
    {
        if (! $date || empty($date['day']) || empty($date['month']) || ($date['qualifier'] ?? 'exact') === 'between') {
            return null;
        }
        if (($date['calendar'] ?? null) === 'julian' && ! empty($date['year'])) {
            $g = self::julianToGregorian((int) $date['day'], (int) $date['month'], (int) $date['year']);

            return ['day' => $g['day'], 'month' => $g['month']];
        }

        return ['day' => (int) $date['day'], 'month' => (int) $date['month']];
    }

    private static function floorDiv(int $a, int $b): int
    {
        return (int) floor($a / $b);
    }
}
