import assert from 'node:assert/strict';

import { parseBuildOutput } from '../src/core/diagnostics';
import { buildSummary, flashSummary } from '../src/core/buildlog';
import { test } from './harness';

// Taken from a real uVision log of the STM32H750 test project.
const REAL_LOG = [
    '*** Using Compiler V6.24, folder: C:\\Keil_v5\\ARM\\ARMCLANG\\Bin',
    "Build target 'timer'",
    '../User/src/ic.c(2): warning: In file included from...../User/include\\key.h(4): warning: typedef requires a name [-Wmissing-declarations]',
    '1 warning generated.',
    '"timer\\timer.axf" - 0 Error(s), 1 Warning(s).',
    'Build Time Elapsed:  00:00:02'
].join('\r\n');

test('compile messages on a clean build become diagnostics', () => {
    const diagnostics = parseBuildOutput(REAL_LOG);

    assert.equal(diagnostics.length, 2);
    assert.deepEqual(diagnostics[0], {
        file: '../User/src/ic.c',
        line: 2,
        severity: 'warning',
        message: 'In file included'
    });
    // uVision truncates the include chain with dots, so the path is not clean.
    assert.deepEqual(diagnostics[1], {
        file: '...../User/include\\key.h',
        line: 4,
        severity: 'warning',
        message: 'typedef requires a name [-Wmissing-declarations]'
    });
});

test('errors with a compiler code are parsed', () => {
    const diagnostics = parseBuildOutput(
        '../Core/Src/main.c(203): error: #20: identifier "htim2" is undefined'
    );

    assert.deepEqual(diagnostics, [
        {
            file: '../Core/Src/main.c',
            line: 203,
            severity: 'error',
            message: '#20: identifier "htim2" is undefined'
        }
    ]);
});

test('gcc style messages are parsed', () => {
    assert.deepEqual(parseBuildOutput('../Core/Src/main.c:12:5: error: expected ";"'), [
        {
            file: '../Core/Src/main.c',
            line: 12,
            column: 5,
            severity: 'error',
            message: 'expected ";"'
        }
    ]);
});

test('summary lines and source echoes are not diagnostics', () => {
    const diagnostics = parseBuildOutput(
        [
            '  203 | #error deliberate verification failure',
            '"timer\\timer.axf" - 1 Error(s), 0 Warning(s).',
            'Build Time Elapsed:  00:00:00'
        ].join('\n')
    );
    assert.deepEqual(diagnostics, []);
});

test('the same message twice is reported once', () => {
    const line = '../Core/Src/main.c(7): warning: unused variable';
    assert.equal(parseBuildOutput(`${line}\n${line}`).length, 1);
});

test('the build summary line is extracted', () => {
    assert.equal(buildSummary(REAL_LOG), '"timer\\timer.axf" - 0 Error(s), 1 Warning(s).');
    assert.equal(buildSummary('nothing here'), undefined);
});

test('the flash result is extracted', () => {
    const log = 'Load "timer\\\\timer.axf"\r\nErase Done.Programming Done.Verify OK.Flash Load finished at 12:47:35';
    assert.equal(flashSummary(log), 'Erase Done.Programming Done.Verify OK.Flash Load finished at 12:47:35');
    assert.equal(flashSummary('Build target'), undefined);
});
