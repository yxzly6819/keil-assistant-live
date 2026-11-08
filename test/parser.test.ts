import assert from 'node:assert/strict';

import { parseProject, ProjectFormatError, resolveProjectPath } from '../src/core/parser';
import { test } from './harness';
import { fixture, stubResolver } from './support';

const ARM_PATH = 'D:\\demo\\arm.uvprojx';
const C51_PATH = 'D:\\demo51\\c51.uvproj';

test('ARM project: targets, compilers and schema version', async () => {
    const project = await parseProject(fixture('arm.uvprojx'), {
        filePath: ARM_PATH,
        toolchain: stubResolver('ARM'),
        fileExists: (path) => !path.endsWith('missing.c')
    });

    assert.equal(project.toolchain, 'ARM');
    assert.equal(project.name, 'arm');
    assert.equal(project.schemaVersion, '2.1');
    assert.equal(project.id.length, 8);
    assert.equal(project.targets.length, 2);
    assert.equal(project.targets[0].name, 'Debug');
    assert.equal(project.targets[0].compiler, 'armclang');
    assert.equal(project.targets[1].name, 'Release');
    assert.equal(project.targets[1].compiler, 'armcc');
});

test('ARM project: include paths, defines and system paths', async () => {
    const project = await parseProject(fixture('arm.uvprojx'), {
        filePath: ARM_PATH,
        toolchain: stubResolver('ARM')
    });
    const debug = project.targets[0];

    assert.deepEqual(debug.includes.slice(0, 2), [
        'D:\\demo\\Core\\Inc',
        'D:\\demo\\Drivers\\CMSIS\\Include'
    ]);
    assert.ok(debug.includes.includes('C:\\Keil\\ARM\\armclang\\include'));
    assert.ok(debug.includes.includes('D:\\demo\\Core\\Src'));

    assert.deepEqual(debug.defines, ['USE_HAL_DRIVER', 'STM32F103xB', '__TEST_ARMCLANG']);
    assert.equal(debug.outputDirectory, '.\\Objects\\');
});

test('ARM project: files, exclusions and missing sources', async () => {
    const project = await parseProject(fixture('arm.uvprojx'), {
        filePath: ARM_PATH,
        toolchain: stubResolver('ARM'),
        fileExists: (path) => !path.endsWith('missing.c')
    });
    const debug = project.targets[0];

    assert.equal(debug.groups.length, 2);

    const application = debug.groups[0];
    assert.equal(application.label, 'Application');
    assert.equal(application.includedInBuild, true);
    assert.equal(application.sources.length, 2);
    assert.equal(application.sources[0].label, 'main.c');
    assert.equal(application.sources[0].kind, 'c');
    assert.equal(application.sources[0].exists, true);
    assert.equal(application.sources[0].includedInBuild, true);
    assert.deepEqual(application.sources[0].dependencies, []);
    assert.equal(application.sources[1].includedInBuild, false);

    const generated = debug.groups[1];
    assert.equal(generated.includedInBuild, false);
    assert.equal(generated.sources[0].includedInBuild, false);
    assert.equal(generated.sources[0].exists, false);
});

test('C51 project: compiler, defines and assembler sources', async () => {
    const project = await parseProject(fixture('c51.uvproj'), {
        filePath: C51_PATH,
        toolchain: stubResolver('C51')
    });
    const target = project.targets[0];

    assert.equal(project.toolchain, 'C51');
    assert.equal(target.name, 'Target 1');
    assert.equal(target.compiler, 'c51');
    assert.ok(target.includes.includes('D:\\demo51\\inc'));
    assert.ok(target.defines.includes('DEBUG=1'));
    assert.ok(target.defines.includes('__TEST_C51'));
    assert.equal(target.groups[0].sources[1].kind, 'assembler');
    assert.equal(target.outputDirectory, '.\\Objects\\');
});

test('a broken file is reported as a project format error', async () => {
    await assert.rejects(
        parseProject('<<< not xml', { filePath: ARM_PATH, toolchain: stubResolver('ARM') }),
        ProjectFormatError
    );
    await assert.rejects(
        parseProject('<html><body /></html>', { filePath: ARM_PATH, toolchain: stubResolver('ARM') }),
        (error: Error) => error instanceof ProjectFormatError && /<Project>/.test(error.message)
    );
    await assert.rejects(
        parseProject('<Project><Targets /></Project>', { filePath: ARM_PATH, toolchain: stubResolver('ARM') }),
        (error: Error) => error instanceof ProjectFormatError && /<Target>/.test(error.message)
    );
});

test('a .uvproj file must contain a C51 target', async () => {
    await assert.rejects(
        parseProject(fixture('arm.uvprojx'), {
            filePath: 'D:\\demo\\arm.uvproj',
            toolchain: stubResolver('C51')
        }),
        (error: Error) => error instanceof ProjectFormatError && /not a C51 target/.test(error.message)
    );
});

test('project paths are resolved against the project directory', () => {
    assert.equal(resolveProjectPath('D:\\demo', '.\\Core\\Inc'), 'D:\\demo\\Core\\Inc');
    assert.equal(resolveProjectPath('D:\\demo', 'Core/Inc'), 'D:\\demo\\Core\\Inc');
    assert.equal(resolveProjectPath('D:\\demo', 'C:/Keil/Inc'), 'C:\\Keil\\Inc');
    assert.equal(resolveProjectPath('D:\\demo', '\\\\server\\share\\inc'), '\\\\server\\share\\inc');
    assert.equal(resolveProjectPath('D:\\demo', '..\\shared'), 'D:\\shared');
});
