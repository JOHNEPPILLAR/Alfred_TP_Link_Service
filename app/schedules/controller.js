/**
 * Import external libraries
 */
const serviceHelper = require('alfred-helper');

/**
 * Import helper libraries
 */
const tpLink = require('./tp_link.js');

/**
 * Set up the schedules
 */
exports.setSchedule = () => {
  // Cancel any existing timers
  serviceHelper.log(
    'trace',
    'Removing any existing schedules',
  );
  global.schedules.forEach((value) => {
    value.cancel();
  });

  tpLink.setup();
};
