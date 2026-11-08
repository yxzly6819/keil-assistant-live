import assert from 'node:assert/strict';

import { parseDependencyFile } from '../src/core/deps';
import { test } from './harness';

test('armclang dependency files use backslash continuations', () => {
    const content = [
        '.\\Objects\\main.o: ..\\Core\\Src\\main.c \\',
        ' .\\Core\\Inc\\main.h \\',
        ' .\\Drivers\\CMSIS\\stm32f1xx.h'
    ].join('\r\n');

    assert.deepEqual(parseDependencyFile(content), [
        '..\\Core\\Src\\main.c',
        '.\\Core\\Inc\\main.h',
        '.\\Drivers\\CMSIS\\stm32f1xx.h'
    ]);
});

test('armcc dependency files are a single target line', () => {
    const content = '.\\Objects\\main.o: .\\Core\\Src\\main.c .\\Core\\Inc\\main.h';
    assert.deepEqual(parseDependencyFile(content), ['.\\Core\\Src\\main.c', '.\\Core\\Inc\\main.h']);
});

test('escaped spaces in a path are unescaped', () => {
    const content = '.\\Objects\\main.o: C:\\Program\\ Files\\Keil\\inc\\a.h';
    assert.deepEqual(parseDependencyFile(content), ['C:\\Program Files\\Keil\\inc\\a.h']);
});

test('the object file itself is not a dependency', () => {
    const content = '.\\Objects\\main.o: .\\Core\\Src\\main.c';
    assert.ok(!parseDependencyFile(content).some((path) => path.endsWith('.o')));
});

test('duplicates are removed and empty input yields nothing', () => {
    const content = ['.\\Objects\\main.o: .\\a.h', '.\\a.h'].join('\r\n');
    assert.deepEqual(parseDependencyFile(content), ['.\\a.h']);
    assert.deepEqual(parseDependencyFile(''), []);
});
