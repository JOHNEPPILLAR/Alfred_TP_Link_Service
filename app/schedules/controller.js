/**
 * Import external libraries
 */
const serviceHelper = require('alfred-helper');
const scheduler = require('node-schedule');

/**
 * Import helper libraries
 */
const tpLink = require('./tp_link.js');

async function setSchedule() {
  serviceHelper.log(
    'info',
    'Setting up daily scheduler',
  );

  // Cancel any existing schedules
  serviceHelper.log(
    'trace',
    'Removing any existing schedules',
  );
  await global.schedules.map((value) => value.cancel());

  // Set schedules each day to keep in sync with sunrise & sunset changes
  const rule = new scheduler.RecurrenceRule();
  rule.hour = 3;
  rule.minute = 5;
  const schedule = scheduler.scheduleJob(rule, () => setSchedule()); // Set the schedule
  global.schedules.push(schedule);

  tpLink.setup();
}

exports.setSchedule = setSchedule;
