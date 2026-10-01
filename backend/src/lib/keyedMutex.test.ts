import { setTimeout as sleep } from 'node:timers/promises';
import { describe, expect, it } from 'vitest';
import { KeyedMutex } from './keyedMutex';

describe('KeyedMutex', () => {
  it('runs same-key tasks one at a time, in order', async () => {
    const mutex = new KeyedMutex();
    const events: string[] = [];
    const task = (name: string, ms: number) => async () => {
      events.push(`start ${name}`);
      await sleep(ms);
      events.push(`end ${name}`);
    };
    await Promise.all([mutex.run('a', task('1', 30)), mutex.run('a', task('2', 5)), mutex.run('a', task('3', 5))]);
    expect(events).toEqual(['start 1', 'end 1', 'start 2', 'end 2', 'start 3', 'end 3']);
  });

  it('runs different keys in parallel', async () => {
    const mutex = new KeyedMutex();
    const started = Date.now();
    await Promise.all([mutex.run('a', () => sleep(40)), mutex.run('b', () => sleep(40))]);
    expect(Date.now() - started).toBeLessThan(75);
  });

  it('keeps going after a task fails', async () => {
    const mutex = new KeyedMutex();
    const failed = mutex.run('a', async () => {
      throw new Error('boom');
    });
    await expect(failed).rejects.toThrow('boom');
    await expect(mutex.run('a', async () => 'ok')).resolves.toBe('ok');
  });
});
