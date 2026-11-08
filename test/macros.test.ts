import assert from 'node:assert/strict';

import { parseMacroDump } from '../src/core/toolchain';
import { test } from './harness';

test('object-like macros keep their value', () => {
    assert.deepEqual(
        parseMacroDump([
            '#define __GNUC__ 4',
            '#define __ARMCC_VERSION 6240002',
            '#define __STDC_VERSION__ 201710L'
        ]),
        ['__GNUC__=4', '__ARMCC_VERSION=6240002', '__STDC_VERSION__=201710L']
    );
});

test('function-like macros drop their body', () => {
    assert.deepEqual(
        parseMacroDump(['#define __align(x) __attribute__((aligned(x)))', '#define __semihost(x,y) __builtin_semihost(x,y)']),
        ['__align(x)=', '__semihost(x,y)=']
    );
});

test('macros without a body and non-macro lines are ignored', () => {
    assert.deepEqual(
        parseMacroDump(['#define EMPTY', '#define', '', 'not a define', '  #define SPACED 1  ']),
        ['SPACED=1']
    );
});
