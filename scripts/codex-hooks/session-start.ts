import { createDefaultHookDriver } from './driver.ts';
import { readHookInput, writeHookResponse } from './contracts.ts';

const driver = createDefaultHookDriver();
const response = driver.handleSessionStart(readHookInput());

if (response) {
  writeHookResponse(response);
}
