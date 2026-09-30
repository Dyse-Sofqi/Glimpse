/**
 * 服务归属记录的持久化。
 *
 * 为什么需要：插件的启动器实例会随插件重载而重建（开发时热重载尤其频繁），
 * 而它 spawn 出来的 python 进程**不会**跟着退出。重建后的实例不认识那个进程，
 * 于是「停止服务」会答「没有由本插件启动的服务需要停止」—— 进程变成孤儿。
 *
 * 把 pid 落盘，重载后就能认领回来，继续负责停止它。
 */
import type { App } from "obsidian";

export interface ServiceRecord {
  pid: number;
  /** 监听端口，用于二次确认（防 PID 复用误判） */
  port: string;
  startedAt: number;
}

export interface ServiceRecordStore {
  load(): Promise<ServiceRecord | null>;
  save(record: ServiceRecord | null): Promise<void>;
}

export function createServiceRecordStore(
  app: App,
  pluginId: string,
  /** 不同提供方各存一份，避免互相覆盖归属（gpt-sovits 与 qwen3-tts 可能同时各跑一个服务） */
  fileName = "reader-service.json"
): ServiceRecordStore {
  const filePath = `${app.vault.configDir}/plugins/${pluginId}/${fileName}`;

  return {
    async load(): Promise<ServiceRecord | null> {
      try {
        const adapter = app.vault.adapter;
        if (!(await adapter.exists(filePath))) return null;
        const parsed = JSON.parse(await adapter.read(filePath)) as Partial<ServiceRecord>;
        if (typeof parsed?.pid !== "number" || typeof parsed?.port !== "string") return null;
        return {
          pid: parsed.pid,
          port: parsed.port,
          startedAt: typeof parsed.startedAt === "number" ? parsed.startedAt : 0,
        };
      } catch {
        // 记录损坏时当作没有 —— 不该因为一个缓存文件挡住启动
        return null;
      }
    },

    async save(record: ServiceRecord | null): Promise<void> {
      try {
        const adapter = app.vault.adapter;
        if (!record) {
          if (await adapter.exists(filePath)) await adapter.remove(filePath);
          return;
        }
        await adapter.write(filePath, JSON.stringify(record, null, 2));
      } catch {
        // 持久化失败只影响「重载后能否认领」，不该打断主流程
      }
    },
  };
}
