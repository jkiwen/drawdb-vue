const cp = require('child_process');
const originalSpawn = cp.spawn;

cp.spawn = function spawn(...args) {
  const options = args[2] || {};
  if (options.stdio === 'pipe' || options.stdio === undefined) {
    options.stdio = 'inherit';
  }
  args[2] = options;
  return originalSpawn.apply(this, args);
};
