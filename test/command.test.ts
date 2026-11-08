import assert from 'node:assert/strict';

import { actionTitle, classifyExitCode, problemMatchersFor, uv4Command } from '../src/core/command';
import { test } from './harness';

const UV4 = 'C:\\Keil_v5\\UV4\\UV4.exe';
const PROJECT = 'D:\\demo\\arm.uvprojx';

test('each action maps to its uVision batch flag', () => {
    assert.deepEqual(uv4Command('build', UV4, PROJECT, 'Debug'), {
        executable: UV4,
        args: ['-b', PROJECT, '-j0', '-t', 'Debug']
    });
    assert.deepEqual(uv4Command('rebuild', UV4, PROJECT, 'Debug').args[0], '-r');
    assert.deepEqual(uv4Command('download', UV4, PROJECT, 'Debug').args[0], '-f');
});

test('the command keeps the target name as a single argument', () => {
    const command = uv4Command('build', UV4, PROJECT, 'Target 1');
    assert.deepEqual(command.args, ['-b', PROJECT, '-j0', '-t', 'Target 1']);
});

test('an output log is appended when a path is given', () => {
    const command = uv4Command('download', UV4, PROJECT, 'timer', 'D:\\ws\\.vscode\\keil-assistant\\abc.build.log');
    assert.deepEqual(command.args, [
        '-f',
        PROJECT,
        '-j0',
        '-t',
        'timer',
        '-o',
        'D:\\ws\\.vscode\\keil-assistant\\abc.build.log'
    ]);
});

test('problem matchers follow the toolchain', () => {
    assert.deepEqual(problemMatchersFor('C51'), ['$c51']);
    assert.deepEqual(problemMatchersFor('ARM'), ['$armcc', '$gcc']);
});

test('actions have user facing titles', () => {
    assert.equal(actionTitle('build'), 'Build');
    assert.equal(actionTitle('rebuild'), 'Rebuild');
    assert.equal(actionTitle('download'), 'Download');
});

test('uVision exit codes are classified, not just compared with zero', () => {
    assert.equal(classifyExitCode(0).outcome, 'success');
    assert.equal(classifyExitCode(1).outcome, 'warnings');
    assert.equal(classifyExitCode(2).outcome, 'failure');
    assert.equal(classifyExitCode(3).outcome, 'failure');
    assert.match(classifyExitCode(3).detail, /fatal/);
    assert.match(classifyExitCode(11).detail, /project file/);
    assert.match(classifyExitCode(12).detail, /device/);
    assert.match(classifyExitCode(13).detail, /write/);
    assert.match(classifyExitCode(15).detail, /XML/);
    assert.match(classifyExitCode(20).detail, /converted/);
    assert.match(classifyExitCode(2).detail, /exit code 2/);
});

test('an unknown or missing exit code is a failure', () => {
    assert.equal(classifyExitCode(undefined).outcome, 'failure');
    assert.equal(classifyExitCode(99).outcome, 'failure');
    assert.match(classifyExitCode(99).detail, /99/);
});
