/** jsmediatags 最小类型声明（跨格式标签读取用） */

declare module "jsmediatags" {
  export interface MediaTagResult {
    tags: {
      title?: string;
      artist?: string;
      album?: string;
      year?: string | number;
      comment?: string;
      track?: string;
      genre?: string;
      lyrics?: string;
      picture?: { format: string; data: number[] | Uint8Array };
    };
  }

  export interface ReadCallback {
    onSuccess: (result: MediaTagResult) => void;
    onError: (error: { type: string; info?: string }) => void;
  }

  export function read(file: any, callback: ReadCallback): void;
  export const ArrayFileReader: any;
}
