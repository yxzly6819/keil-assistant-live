type TestBody = () => void | Promise<void>;

interface TestCase {
    readonly name: string;
    readonly body: TestBody;
}

const cases: TestCase[] = [];

export function test(name: string, body: TestBody): void {
    cases.push({ name, body });
}

export async function run(): Promise<void> {
    let failed = 0;

    for (const testCase of cases) {
        try {
            await testCase.body();
            process.stdout.write(`  ok    ${testCase.name}\n`);
        } catch (error) {
            failed += 1;
            process.stdout.write(`  FAIL  ${testCase.name}\n`);
            process.stdout.write(`${indent(error instanceof Error ? error.stack ?? error.message : String(error))}\n`);
        }
    }

    const passed = cases.length - failed;
    process.stdout.write(`\n${passed}/${cases.length} passed\n`);
    if (failed > 0) {
        process.exitCode = 1;
    }
}

function indent(text: string): string {
    return text
        .split(/\r\n|\r|\n/)
        .map((line) => `        ${line}`)
        .join('\n');
}
