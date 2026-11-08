import assert from 'node:assert/strict';

import { expandPathVariables } from '../src/core/paths';
import { test } from './harness';

test('workspace variables are expanded', () => {
    assert.equal(expandPathVariables('${workspaceFolder}/demo', { workspaceFolder: 'D:\\ws' }), 'D:\\ws/demo');
    assert.equal(expandPathVariables('${workspaceRoot}/src', { workspaceFolder: 'D:\\ws' }), 'D:\\ws/src');
    assert.equal(
        expandPathVariables('${workspaceFolderBasename}', { workspaceFolder: 'D:\\ws\\demo' }),
        'demo'
    );
});

test('home and environment variables are expanded', () => {
    assert.equal(expandPathVariables('${userHome}\\keil', { userHome: 'C:\\Users\\me' }), 'C:\\Users\\me\\keil');
    assert.equal(
        expandPathVariables('${env:KEIL_ROOT}\\UV4', { env: { KEIL_ROOT: 'C:\\Keil_v5' } }),
        'C:\\Keil_v5\\UV4'
    );
});

test('unknown variables are left untouched', () => {
    assert.equal(expandPathVariables('${nope}', {}), '${nope}');
    assert.equal(expandPathVariables('${env:MISSING}', { env: {} }), '${env:MISSING}');
    assert.equal(expandPathVariables('${workspaceFolder}', {}), '${workspaceFolder}');
});

test('plain paths pass through unchanged', () => {
    assert.equal(expandPathVariables('D:\\demo\\arm.uvprojx', {}), 'D:\\demo\\arm.uvprojx');
});
