import { createGardenRepository } from '../repositories/sql-garden.repository.js';
import { readEnv } from '../config/env.js';
const repository = await createGardenRepository(readEnv());
await repository.close();
console.info('数据库迁移完成');
