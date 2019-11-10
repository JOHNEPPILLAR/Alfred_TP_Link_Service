/**
 * Import external libraries
 */
const scheduler = require('node-schedule');
const serviceHelper = require('alfred-helper');

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
      params: { deviceHost: data.host },
      body: {
        deviceAction: action,
      },
    };
    const updateResponse = await deviceHelper.updateDevice(req);
    if (updateResponse instanceof Error) {
      throw new Error(`There was an error updating ${data.name}`);
    }
    return true;
  } catch (err) {
    serviceHelper.log('error', err.message);
    return false;
  }
}

async function setupSchedule(data) {
  serviceHelper.log(
    'trace',
    `Create tp-link schedule for ${data.name}`,
  );

  if (data.hour === null || data.minute === null) {
    serviceHelper.log('error', 'Schedule values were null');
    return false;
  }
  let rule = new scheduler.RecurrenceRule();
  rule.hour = data.hour;
  rule.minute = data.minute;
  const schedule = scheduler.scheduleJob(rule, () => {
    updateDevice(data);
  });
  global.schedules.push(schedule);
  serviceHelper.log(
    'info',
    `${data.name} schedule will run at: ${serviceHelper.zeroFill(
      rule.hour,
      2,
    )}:${serviceHelper.zeroFill(rule.minute, 2)}`,
  );
  rule = null; // Clear schedule values
  return true;
}

/**
 * Set up schedules
 */
exports.setup = async () => {
  let dbClient;
  let results;

  try {
    // Get data from data store
    const SQL = 'SELECT name, hour, minute, host, name, action FROM tp_link_schedules WHERE active';
    serviceHelper.log('trace', 'Connect to data store connection pool');
    dbClient = await global.devicesDataClient.connect(); // Connect to data store
    serviceHelper.log('trace', 'Get schedule settings');
    results = await dbClient.query(SQL);
    serviceHelper.log(
      'trace',
      'Release the data store connection back to the pool',
    );
    await dbClient.release(); // Return data store connection back to pool

    if (results.rowCount === 0) {
      // Exit function as no data to process
      serviceHelper.log('info', 'No tp-link schedules are active');
      return false;
    }

    // Setup timers
    results.rows.forEach((info) => {
      setupSchedule(info);
    });
    return true;
  } catch (err) {
    serviceHelper.log('error', err.message);
    return false;
  }
};
