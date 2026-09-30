<?php

namespace Tests\Unit;

use App\Domain\Anniversaries;
use App\Domain\Branch;
use App\Domain\Dates;
use App\Domain\TreeSchema;
use PHPUnit\Framework\TestCase;

class DomainTest extends TestCase
{
    public function test_julian_to_gregorian(): void
    {
        $this->assertSame(['day' => 18, 'month' => 5, 'year' => 1868], Dates::julianToGregorian(6, 5, 1868));
        $this->assertSame(['day' => 7, 'month' => 11, 'year' => 1917], Dates::julianToGregorian(25, 10, 1917));
        $this->assertNull(Dates::monthDay(['qualifier' => 'between', 'day' => 1, 'month' => 2]));
    }

    public function test_schema_normalizes_and_rejects_bad_ids(): void
    {
        $p = TreeSchema::person(['id' => 'p1', 'gender' => 'X', 'firstName' => str_repeat('я', 500), 'evil' => 1]);
        $this->assertSame('U', $p['gender']);
        $this->assertSame(100, mb_strlen($p['firstName']));
        $this->assertArrayNotHasKey('evil', $p);
        $this->assertSame('exact', $p['birth']['date']['qualifier']);
        // id из примеров и старых версий: кириллица, точки, двоеточия
        $this->assertTrue(TreeSchema::isValidId('pl-Россия'));
        $this->assertTrue(TreeSchema::isValidId('I12:@F3'));
        $this->assertFalse(TreeSchema::isValidId('a b'));
        $this->assertFalse(TreeSchema::isValidId(str_repeat('x', 65)));
        $this->expectException(\InvalidArgumentException::class);
        TreeSchema::person(['id' => 'a/b']);
    }

    public function test_branch_contains_descendants_and_partners(): void
    {
        $tree = [
            'persons' => array_fill_keys(['a', 'b', 'c', 'd', 'e', 'x'], ['id' => '']),
            'families' => [
                'f0' => ['partners' => ['x'], 'children' => ['a']],
                'f1' => ['partners' => ['a', 'b'], 'children' => ['c']],
                'f2' => ['partners' => ['c', 'd'], 'children' => ['e']],
            ],
        ];
        $ids = Branch::personIds($tree, 'a');
        sort($ids);
        $this->assertSame(['a', 'b', 'c', 'd', 'e'], $ids);
        $this->assertSame(['f1', 'f2'], Branch::familyIds($tree, $ids));
    }

    public function test_years_word(): void
    {
        $this->assertSame('год', Anniversaries::yearsWord(41));
        $this->assertSame('года', Anniversaries::yearsWord(22));
        $this->assertSame('лет', Anniversaries::yearsWord(11));
        $this->assertSame('лет', Anniversaries::yearsWord(35));
    }
}
