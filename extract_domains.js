'use strict';

console.error(
  'This generator is disabled. Auth and settings routes remain maintained under routes/; ' +
  'do not generate duplicate module handlers.',
);
process.exitCode = 1;
