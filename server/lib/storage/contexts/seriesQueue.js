// Helper for sequential task execution
module.exports = function seriesQueue() {
  const queue = [];
  let running = false;

  const next = function() {
    if (queue.length === 0) {
      running = false;
      return;
    }

    running = true;
    const task = queue.shift();
    task.action(function(err, res) {
      task.callback(err, res);
      next();
    });
  };

  return function(action, callback) {
    queue.push({ action: action, callback: callback });
    if (!running) {
      next();
    }
  };
};
