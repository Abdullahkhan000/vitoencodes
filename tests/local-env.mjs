import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
// Unit tests always use disposable SQLite, never configured production services.
delete process.env.DATABASE_URL;
delete process.env.DATABASE_URL_POOLED;
delete process.env.DATABASE_URL_UNPOOLED;
process.env.DATA_DIRECTORY=mkdtempSync(path.join(tmpdir(),'vito-unit-'));
