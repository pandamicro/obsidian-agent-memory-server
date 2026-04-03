import { createDefaultHookDriver } from './driver.ts';
import { readHookInput, writeHookResponse } from './contracts.ts';

const driver = createDefaultHookDriver();
const response = driver.handleStop(readHookInput());

writeHookResponse(response);
