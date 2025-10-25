// Minimal in-memory mock for fs/promises used by vehicleService.
type FileMap = Record<string, string>;
const mem: FileMap = {};

export const __setFile = (p: string, content: string) => { mem[p] = content; };

export const readFile = async (p: string, enc: BufferEncoding = 'utf-8'): Promise<string> => {
  if (!(p in mem)) {
    const err: NodeJS.ErrnoException = new Error(`ENOENT: ${p}`);
    err.code = 'ENOENT';
    throw err;
  }
  return mem[p];
};

export const writeFile = async (p: string, data: string, enc: BufferEncoding = 'utf-8') => {
  mem[p] = typeof data === 'string' ? data : String(data);
};
