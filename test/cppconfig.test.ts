import assert from 'node:assert/strict';

import {
    configKey,
    configNamesFor,
    CppPropertiesFormatError,
    updateCppProperties
} from '../src/core/cppconfig';
import { test } from './harness';

test('a missing file is created with version 4', () => {
    const document = JSON.parse(
        updateCppProperties(undefined, [
            { name: 'Debug', includePath: ['D:\\demo\\inc'], defines: ['USE_HAL_DRIVER'] }
        ])
    );

    assert.equal(document.version, 4);
    assert.equal(document.configurations.length, 1);
    assert.deepEqual(document.configurations[0], {
        name: 'Debug',
        includePath: ['D:\\demo\\inc'],
        defines: ['USE_HAL_DRIVER'],
        intelliSenseMode: '${default}'
    });
});

test('foreign configurations and unknown fields survive a merge', () => {
    const existing = JSON.stringify({
        version: 4,
        configurations: [{ name: 'Win32', includePath: ['C:\\sdk'] }],
        env: { PATH: 'x' }
    });

    const document = JSON.parse(
        updateCppProperties(existing, [{ name: 'Debug', includePath: ['D:\\demo\\inc'], defines: [] }])
    );

    assert.equal(document.configurations.length, 2);
    assert.deepEqual(document.configurations[0], { name: 'Win32', includePath: ['C:\\sdk'] });
    assert.equal(document.configurations[1].name, 'Debug');
    assert.deepEqual(document.env, { PATH: 'x' });
});

test('an existing configuration is updated in place', () => {
    const existing = JSON.stringify({
        version: 4,
        configurations: [{ name: 'Debug', includePath: ['old'], defines: [], cStandard: 'c11' }]
    });

    const document = JSON.parse(
        updateCppProperties(existing, [{ name: 'Debug', includePath: ['new'], defines: ['A=1'] }])
    );

    assert.equal(document.configurations.length, 1);
    assert.deepEqual(document.configurations[0].includePath, ['new']);
    assert.deepEqual(document.configurations[0].defines, ['A=1']);
    assert.equal(document.configurations[0].cStandard, 'c11');
});

test('a file that is not JSON is refused instead of being rewritten', () => {
    assert.throws(() => updateCppProperties('{ not json', []), CppPropertiesFormatError);
    assert.throws(() => updateCppProperties('[]', []), CppPropertiesFormatError);
    assert.throws(
        () => updateCppProperties(JSON.stringify({ configurations: 'nope' }), []),
        CppPropertiesFormatError
    );
});

test('configuration names are prefixed only when they collide', () => {
    const names = configNamesFor([
        { projectId: 'alpha', projectName: 'alpha', targetName: 'Debug' },
        { projectId: 'beta', projectName: 'beta', targetName: 'Debug' },
        { projectId: 'alpha', projectName: 'alpha', targetName: 'Release' }
    ]);

    assert.equal(names.get(configKey('alpha', 'Debug')), 'alpha/Debug');
    assert.equal(names.get(configKey('beta', 'Debug')), 'beta/Debug');
    assert.equal(names.get(configKey('alpha', 'Release')), 'Release');
});
