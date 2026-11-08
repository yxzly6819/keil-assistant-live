import assert from 'node:assert/strict';

import { tailFrom } from '../src/core/logtail';
import { test } from './harness';

test('only the new part of the log is returned', () => {
    assert.deepEqual(tailFrom('compiling a.c...\n', 0), {
        text: 'compiling a.c...\n',
        offset: 17
    });
    assert.deepEqual(tailFrom('compiling a.c...\nlinking...\n', 17), {
        text: 'linking...\n',
        offset: 28
    });
});

test('nothing is returned when the log did not grow', () => {
    assert.deepEqual(tailFrom('same', 4), { text: '', offset: 4 });
});

test('a truncated log is read from the beginning again', () => {
    assert.deepEqual(tailFrom('new run', 100), { text: 'new run', offset: 7 });
});
