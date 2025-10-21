import { NitroModules } from 'react-native-nitro-modules';
import type { JsapduRn } from './JsapduRn.nitro';

const JsapduRnHybridObject =
  NitroModules.createHybridObject<JsapduRn>('JsapduRn');

export function multiply(a: number, b: number): number {
  return JsapduRnHybridObject.multiply(a, b);
}
