<?php

namespace App\GraphQL\Scalars;

use GraphQL\Error\Error;
use GraphQL\Language\AST\IntValueNode;
use GraphQL\Language\AST\Node;
use GraphQL\Language\AST\StringValueNode;
use GraphQL\Type\Definition\ScalarType;
use Rebing\GraphQL\Support\Contracts\TypeConvertible;

/** Время — миллисекунды Unix (как Date.now() во фронтенде). */
class TimestampScalar extends ScalarType implements TypeConvertible
{
    public string $name = 'Timestamp';

    public ?string $description = 'Миллисекунды Unix';

    public function serialize($value): mixed
    {
        if ($value instanceof \DateTimeInterface) {
            return (int) $value->format('Uv');
        }

        return is_numeric($value) ? (float) $value : null;
    }

    public function parseValue($value): mixed
    {
        if (! is_numeric($value)) {
            throw new Error('Timestamp: ожидается число миллисекунд');
        }

        return (float) $value;
    }

    public function parseLiteral(Node $valueNode, ?array $variables = null): mixed
    {
        if ($valueNode instanceof IntValueNode || $valueNode instanceof StringValueNode) {
            return $this->parseValue($valueNode->value);
        }
        throw new Error('Timestamp: ожидается число миллисекунд');
    }

    public function toType(): ScalarType
    {
        return new static;
    }
}
