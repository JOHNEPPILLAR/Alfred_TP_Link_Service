/**
 * Import external libraries
 */
const serviceHelper = require('alfred-helper');
const scheduler = require('node-schedule');
const dateformat = require('dateformat');

/**
 * Import helper libraries
 */
const tpLink = require('./tp_link.js');

// Set up the schedules
async function setupSchedules() {
  // Cancel any existing schedules
  serviceHelper.log(
    'trace',
    'Removing any existing schedules',
  );
  await global.schedules.map((value) => value.cancel());
  await tpLink.setup(); // Set new schedules
}

exports.setSchedule = async () => {
  await setupSchedules();

  // Set schedules each day to keep in sync with sunrise & sunset changes
  const date = new Date();
  date.setHours(3);
  date.setMinutes(5);
  date.setTime(date.getTime() + 1 * 86400000);
  const schedule = scheduler.scheduleJob(date, () => {
    serviceHelper.log('info', 'Resetting daily schedules to keep in sync with sunrise & sunset changes');
    setupSchedules();
  }); // Set the schedule
  global.schedules.push(schedule);
  serviceHelper.log(
    'info',
    `Reset schedules will run on ${dateformat(date, 'dd-mm-yyyy @ HH:MM')}`,
  );
};
