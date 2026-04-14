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

    // Handle both callback-style and Promise-returning functions
    const result = task.action(function(err, res) {
      // Callback-style: action will call this callback
      task.callback(err, res);
      next();
    });

    // If action returns a Promise (doesn't use the callback), handle it
    if (result && typeof result.then === 'function') {
      result
        .then(function(res) {
          task.callback(null, res);
          next();
        })
        .catch(function(err) {
          task.callback(err);
          next();
        });
    }
  };

  return function(action, callback) {
    queue.push({ action: action, callback: callback });
    if (!running) {
      next();
    }
  };
};
