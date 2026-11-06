import { calendarModule } from './calendar';
import { financeModule } from './finance';
import { projectsModule } from './projects';
import { storeModule } from './store';
import { growthModule } from './growth';
import { audienceModule } from './audience';
import { esignModule } from './esign';
import { securityModule } from '../security/module';
import type { OsModule } from './types';

export const MODULES: OsModule[] = [calendarModule, growthModule, audienceModule, financeModule, projectsModule, storeModule, esignModule, securityModule];
