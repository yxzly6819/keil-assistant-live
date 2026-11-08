/**
 * Incremental reading of a file that another process keeps writing to
 * (uVision writes its `-o` log while it builds).
 */

export interface TailChunk {
    readonly text: string;
    readonly offset: number;
}

/**
 * Returns the part of `content` that has not been seen yet. When the file got
 * shorter (uVision truncates the log for every run) the whole content is new.
 */
export function tailFrom(content: string, offset: number): TailChunk {
    const start = offset >= 0 && offset <= content.length ? offset : 0;
    return { text: content.slice(start), offset: content.length };
}
