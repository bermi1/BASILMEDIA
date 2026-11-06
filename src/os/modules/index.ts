import { financeModule } from './finance';
import { projectsModule } from './projects';
import { storeModule } from './store';
import { growthModule } from './growth';
import { esignModule } from './esign';
import { securityModule } from '../security/module';
import type { OsModule } from './types';

export const MODULES: OsModule[] = [growthModule, financeModule, projectsModule, storeModule, esignModule, securityModule];
