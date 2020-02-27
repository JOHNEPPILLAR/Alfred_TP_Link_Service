/**
 * Import external libraries
 */
const scheduler = require('node-schedule');
const serviceHelper = require('alfred-helper');
const dateformat = require('dateformat');

/**
 * Import helper libraries
 */
const deviceHelper = require('../api/devices/devices.js');

async function updateDevice(data) {
  try {
    let action = 'off';
    if (data.action) action = 'on';
    serviceHelper.log('info', `TP-Link schedule - Turning ${action} ${data.name}`);

    const req = {
      params: { deviceHost: '192.168.85.43' }, // Harriets lights
      body: { deviceAction: action },
    };
    const updateResponse = await deviceHelper.updateDevice(req);
    if (updateResponse instanceof Error) throw new Error(`There was an error updating ${data.name}`);
  } catch (err) {
    serviceHelper.log('error', err.message);
  }
}

async function setupSchedule(data) {
  serviceHelper.log(
    'trace',
    `Create tp-link schedule for ${data.name}`,
  );
  if (data.hour === null || data.minute === null) {
    serviceHelper.log('error', 'Schedule values were null');
    return;
  }

  // Check if girls are staying
  if (data.deviceid === '800693F733CEA366746DA9EE9AA3CE0C17D8ACF4') { // Harriets bed lights
    const kidsAtHomeToday = await serviceHelper.kidsAtHomeToday();
    if (!kidsAtHomeToday) {
      serviceHelper.log('info', 'Override schedule: Girls are not staying');
      return;
    }
  }

  const date = new Date();
  date.setHours(data.hour);
  date.setMinutes(data.minute);
  const schedule = scheduler.scheduleJob(date, () => updateDevice(data));
  global.schedules.push(schedule);
  serviceHelper.log(
    'info',
    `${data.name} schedule will run at ${dateformat(date, 'dd-mm-yyyy @ HH:MM')}`,
  );
}

/**
 * Set up schedules
 */
exports.setup = async () => {
  let results;

  try {
    // Get data from data store
    const SQL = 'SELECT name, hour, minute, deviceid, name, action FROM tp_link_schedules WHERE active';
    serviceHelper.log('trace', 'Connect to data store connection pool');
    const dbConnection = await serviceHelper.connectToDB('tplink');
    serviceHelper.log('trace', 'Get schedule settings');
    results = await dbConnection.query(SQL);
    serviceHelper.log(
      'trace',
      'Release the data store connection back to the pool',
    );
    await dbConnection.end(); // Close data store connection
    if (results.rowCount === 0) {
      // Exit function as no data to process
      serviceHelper.log('info', 'No tp-link schedules are active');
      return false;
    }

    // Setup schedules
    results.rows.map((info) => setupSchedule(info));
    return true;
  } catch (err) {
    serviceHelper.log('error', err.message);
    return false;
  }
};
