import assert from 'node:assert/strict';

import { projectIdFor, SourceNode, sourceKindOf, withDependencies } from '../src/core/model';
import { parseProject } from '../src/core/parser';
import { test } from './harness';
import { fixture, stubResolver } from './support';

test('project ids are short and case insensitive', () => {
    assert.equal(projectIdFor('D:\\demo\\arm.uvprojx').length, 8);
    assert.equal(projectIdFor('D:\\Demo\\ARM.uvprojx'), projectIdFor('d:\\demo\\arm.uvprojx'));
    assert.notEqual(projectIdFor('D:\\demo\\a.uvprojx'), projectIdFor('D:\\demo\\b.uvprojx'));
});

test('source kinds follow the file extension', () => {
    assert.equal(sourceKindOf('a.C'), 'c');
    assert.equal(sourceKindOf('b.cpp'), 'cpp');
    assert.equal(sourceKindOf('c.hpp'), 'header');
    assert.equal(sourceKindOf('d.S'), 'assembler');
    assert.equal(sourceKindOf('e.lib'), 'library');
    assert.equal(sourceKindOf('f.txt'), 'other');
});

test('withDependencies attaches references without mutating the model', async () => {
    const project = await parseProject(fixture('arm.uvprojx'), {
        filePath: 'D:\\demo\\arm.uvprojx',
        toolchain: stubResolver('ARM')
    });

    const dependency: SourceNode = {
        label: 'main.h',
        path: 'D:\\demo\\Core\\Inc\\main.h',
        dir: 'D:\\demo\\Core\\Inc',
        kind: 'header',
        includedInBuild: true,
        exists: true,
        dependencies: []
    };

    const updated = withDependencies(project, (target, source) =>
        source.label === 'main.c' && target.name === 'Debug' ? [dependency] : []
    );

    assert.equal(updated.targets[0].groups[0].sources[0].dependencies.length, 1);
    assert.deepEqual(updated.targets[0].groups[0].sources[0].dependencies[0], dependency);
    assert.equal(updated.targets[0].groups[0].sources[1].dependencies.length, 0);
    assert.deepEqual(project.targets[0].groups[0].sources[0].dependencies, []);
});
