import assert from 'node:assert/strict';

import { classifyLogLine } from '../src/core/outputlog';
import { test } from './harness';

test('compiler errors and warnings are coloured by severity', () => {
    assert.equal(classifyLogLine('../User/src/key.c(28): error: use of undeclared identifier'), 'error');
    assert.equal(classifyLogLine('../User/src/key.c(28): error: #20: identifier is undefined'), 'error');
    assert.equal(classifyLogLine("../User/src/ic.c(2): warning: In file included from"), 'warn');
    assert.equal(classifyLogLine('..\\Objects\\timer.axf: Error: L6218E: Undefined symbol foo'), 'error');
});

test('the summary line is coloured from its counts', () => {
    assert.equal(classifyLogLine('"timer\\timer.axf" - 0 Error(s), 0 Warning(s).'), 'info');
    assert.equal(classifyLogLine('"timer\\timer.axf" - 0 Error(s), 1 Warning(s).'), 'warn');
    assert.equal(classifyLogLine('"timer\\timer.axf" - 11 Error(s), 1 Warning(s).'), 'error');
});

test('progress output stays neutral', () => {
    assert.equal(classifyLogLine("*** Using Compiler 'V6.24', folder: ..."), 'info');
    assert.equal(classifyLogLine('compiling main.c...'), 'info');
    assert.equal(classifyLogLine('Program Size: Code=9092 RO-data=712'), 'info');
    assert.equal(classifyLogLine(''), 'info');
});

test('the warning count line is a warning', () => {
    assert.equal(classifyLogLine('1 warning generated.'), 'warn');
});
