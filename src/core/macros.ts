/**
 * Compiler macros that the Keil toolchains define implicitly.
 *
 * cpptools only understands `NAME` and `NAME=VALUE`, so function-like macros are
 * reduced to `NAME(...)=`. The tables are data, kept apart from the logic that
 * uses them.
 */

export const C51_MACROS: readonly string[] = [
    '__C51__',
    '__VSCODE_C51__',
    'reentrant=',
    'compact=',
    'small=',
    'large=',
    'data=',
    'idata=',
    'pdata=',
    'bdata=',
    'xdata=',
    'code=',
    'bit=char',
    'sbit=char',
    'sfr=char',
    'sfr16=int',
    'sfr32=int',
    'interrupt=',
    'using=',
    '_at_=',
    '_priority_=',
    '_task_='
];

export const ARMCC_MACROS: readonly string[] = [
    '__CC_ARM',
    '__arm__',
    '__align(x)=',
    '__ALIGNOF__(x)=',
    '__alignof__(x)=',
    '__asm(x)=',
    '__forceinline=',
    '__restrict=',
    '__global_reg(n)=',
    '__inline=',
    '__int64=long long',
    '__INTADDR__(expr)=0',
    '__irq=',
    '__packed=',
    '__pure=',
    '__smc(n)=',
    '__svc(n)=',
    '__svc_indirect(n)=',
    '__svc_indirect_r7(n)=',
    '__value_in_regs=',
    '__weak=',
    '__writeonly=',
    '__declspec(x)=',
    '__attribute__(x)=',
    '__nonnull__(x)=',
    '__register=',

    '__breakpoint(x)=',
    '__cdp(x,y,z)=',
    '__clrex()=',
    '__clz(x)=0U',
    '__current_pc()=0U',
    '__current_sp()=0U',
    '__disable_fiq()=',
    '__disable_irq()=',
    '__dmb(x)=',
    '__dsb(x)=',
    '__enable_fiq()=',
    '__enable_irq()=',
    '__fabs(x)=0.0',
    '__fabsf(x)=0.0f',
    '__force_loads()=',
    '__force_stores()=',
    '__isb(x)=',
    '__ldrex(x)=0U',
    '__ldrexd(x)=0U',
    '__ldrt(x)=0U',
    '__memory_changed()=',
    '__nop()=',
    '__pld(...)=',
    '__pli(...)=',
    '__qadd(x,y)=0',
    '__qdbl(x)=0',
    '__qsub(x,y)=0',
    '__rbit(x)=0U',
    '__rev(x)=0U',
    '__return_address()=0U',
    '__ror(x,y)=0U',
    '__schedule_barrier()=',
    '__semihost(x,y)=0',
    '__sev()=',
    '__sqrt(x)=0.0',
    '__sqrtf(x)=0.0f',
    '__ssat(x,y)=0',
    '__strex(x,y)=0U',
    '__strexd(x,y)=0',
    '__strt(x,y)=',
    '__swp(x,y)=0U',
    '__usat(x,y)=0U',
    '__wfe()=',
    '__wfi()=',
    '__yield()=',
    '__vfp_status(x,y)=0'
];

export const ARMCLANG_MACROS: readonly string[] = [
    '__alignof__(x)=',
    '__asm(x)=',
    '__asm__(x)=',
    '__forceinline=',
    '__restrict=',
    '__volatile__=',
    '__inline=',
    '__inline__=',
    '__declspec(x)=',
    '__attribute__(x)=',
    '__nonnull__(x)=',
    '__unaligned=',
    '__promise(x)=',
    '__irq=',
    '__swi=',
    '__weak=',
    '__register=',
    '__pure=',
    '__value_in_regs=',

    '__breakpoint(x)=',
    '__current_pc()=0U',
    '__current_sp()=0U',
    '__disable_fiq()=',
    '__disable_irq()=',
    '__enable_fiq()=',
    '__enable_irq()=',
    '__force_stores()=',
    '__memory_changed()=',
    '__schedule_barrier()=',
    '__semihost(x,y)=0',
    '__vfp_status(x,y)=0',

    '__builtin_arm_nop()=',
    '__builtin_arm_wfi()=',
    '__builtin_arm_wfe()=',
    '__builtin_arm_sev()=',
    '__builtin_arm_sevl()=',
    '__builtin_arm_yield()=',
    '__builtin_arm_isb(x)=',
    '__builtin_arm_dsb(x)=',
    '__builtin_arm_dmb(x)=',

    '__builtin_bswap32(x)=0U',
    '__builtin_bswap16(x)=0U',
    '__builtin_arm_rbit(x)=0U',

    '__builtin_clz(x)=0U',
    '__builtin_arm_ldrex(x)=0U',
    '__builtin_arm_strex(x,y)=0U',
    '__builtin_arm_clrex()=',
    '__builtin_arm_ssat(x,y)=0U',
    '__builtin_arm_usat(x,y)=0U',
    '__builtin_arm_ldaex(x)=0U',
    '__builtin_arm_stlex(x,y)=0U'
];

/** Used when `armclang -E -dM` cannot be executed. */
export const ARMCLANG_FALLBACK_MACROS: readonly string[] = [
    '__GNUC__=4',
    '__GNUC_MINOR__=2',
    '__GNUC_PATCHLEVEL__=1'
];

const DEFINE_PATTERN = /^#define\s+(\w+(?:\([^)]*\))?)\s*(.*)$/;

/**
 * Turns `armclang -dM` output into cpptools defines. Function-like macros keep
 * their parameter list but drop the body, because cpptools cannot evaluate it.
 */
export function parseMacroDump(lines: Iterable<string>): string[] {
    const result: string[] = [];
    for (const line of lines) {
        const match = DEFINE_PATTERN.exec(line.trim());
        if (!match) {
            continue;
        }
        const [, name, body] = match;
        if (body === '') {
            continue;
        }
        result.push(name.includes('(') ? `${name}=` : `${name}=${body}`);
    }
    return result;
}
