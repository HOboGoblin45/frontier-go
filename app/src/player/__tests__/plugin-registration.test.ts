import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { describeVideoInset } from '../types';

/**
 * The bug this guards: setVideoInsets was named in the Swift `pluginMethods`
 * list but not in the Objective-C `CAP_PLUGIN` macro. The macro defines
 * `pluginMethods` in a category, which replaces the Swift getter at runtime,
 * so the method was unreachable from JS on every device from 4.0.3 to 4.3.1
 * and the picture sat under the title. Nothing failed loudly: the JS wrapper
 * swallowed the rejection. These tests make drift a CI failure.
 */
const PLUGIN = resolve(__dirname, '../../../local-plugins/frontier-player/ios/Plugin');
const objc = readFileSync(resolve(PLUGIN, 'FrontierPlayer.m'), 'utf8');
const swift = readFileSync(resolve(PLUGIN, 'FrontierPlayer.swift'), 'utf8');
const types = readFileSync(resolve(__dirname, '../types.ts'), 'utf8');

export function objcMethods(src: string): string[] {
  return [...src.matchAll(/CAP_PLUGIN_METHOD\(\s*(\w+)\s*,/g)].map((m) => m[1]);
}

export function swiftListedMethods(src: string): string[] {
  return [...src.matchAll(/CAPPluginMethod\(name:\s*"(\w+)"/g)].map((m) => m[1]);
}

export function swiftImplementedMethods(src: string): string[] {
  return [...src.matchAll(/@objc\s+func\s+(\w+)\(\s*_\s+call:\s*CAPPluginCall\s*\)/g)].map((m) => m[1]);
}

/** Methods the JS side can call: every member of FrontierPlayerPlugin except listeners. */
export function jsMethods(src: string): string[] {
  const body = src.slice(src.indexOf('export interface FrontierPlayerPlugin'));
  const block = body.slice(0, body.indexOf('\n}\n'));
  return [...block.matchAll(/^\s{2}(\w+)\(/gm)].map((m) => m[1]).filter((n) => n !== 'addListener');
}

const sorted = (xs: string[]) => [...new Set(xs)].sort();

describe('FrontierPlayer registration', () => {
  it('the parsers find the lists (a parser that finds nothing would pass everything)', () => {
    expect(objcMethods(objc).length).toBeGreaterThan(10);
    expect(swiftListedMethods(swift).length).toBeGreaterThan(10);
    expect(swiftImplementedMethods(swift).length).toBeGreaterThan(10);
    expect(jsMethods(types).length).toBeGreaterThan(10);
  });

  it('the Objective-C macro lists exactly the Swift pluginMethods', () => {
    expect(sorted(objcMethods(objc))).toEqual(sorted(swiftListedMethods(swift)));
  });

  it('every registered method is implemented in Swift', () => {
    const implemented = new Set(swiftImplementedMethods(swift));
    expect(objcMethods(objc).filter((m) => !implemented.has(m))).toEqual([]);
  });

  it('every method the JS interface declares is registered natively', () => {
    const registered = new Set(objcMethods(objc));
    expect(jsMethods(types).filter((m) => !registered.has(m))).toEqual([]);
  });

  it('setVideoInsets in particular is registered', () => {
    expect(objcMethods(objc)).toContain('setVideoInsets');
  });

  it('the parity check catches the 4.3.1 drift', () => {
    const drifted = objc.replace(/\s*CAP_PLUGIN_METHOD\(setVideoInsets, CAPPluginReturnPromise\);/, '');
    expect(sorted(objcMethods(drifted))).not.toEqual(sorted(swiftListedMethods(swift)));
  });
});

describe('describeVideoInset', () => {
  it('flags a rejected layout hint as a fault', () => {
    const r = describeVideoInset({ state: 'failed', message: '"FrontierPlayer.setVideoInsets()" is not implemented on ios' }, null);
    expect(r.bad).toBe(true);
    expect(r.text).toMatch(/^NOT APPLIED/);
  });

  it('reports the applied inset and the native reading', () => {
    const r = describeVideoInset({ state: 'applied', top: 112, bottom: 540 }, { native: true, videoInsetTop: 112, videoInsetBottom: 540 });
    expect(r.bad).toBe(false);
    expect(r.text).toBe('top 112 · bottom 540 · native 112/540');
  });

  it('says nothing has been reported before Watch has measured', () => {
    expect(describeVideoInset({ state: 'unreported' }, null)).toEqual({ text: 'no report yet', bad: false });
  });
});
