import { calendarModule } from './calendar';
import { financeModule } from './finance';
import { projectsModule } from './projects';
import { storeModule } from './store';
import { growthModule } from './growth';
import type { OsModule } from './types';

export const MODULES: OsModule[] = [calendarModule, growthModule, financeModule, projectsModule, storeModule];
