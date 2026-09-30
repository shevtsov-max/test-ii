<?php

namespace App\Domain;

/**
 * TreeData для отдачи клиенту одним JSON: словари (коллекции, custom, childLinks) всегда объекты,
 * даже пустые — иначе PHP закодирует пустой массив как [] вместо {}.
 */
final class TreeJson
{
    public static function encode(array $data): object
    {
        $out = [];
        foreach ($data as $collection => $items) {
            if (! is_array($items)) {
                $out[$collection] = $items;

                continue;
            }
            $out[$collection] = (object) array_map(function ($e) {
                if (is_array($e)) {
                    foreach (['custom', 'childLinks'] as $k) {
                        if (array_key_exists($k, $e)) {
                            $e[$k] = (object) $e[$k];
                        }
                    }
                }

                return $e;
            }, $items);
        }

        return (object) $out;
    }
}
