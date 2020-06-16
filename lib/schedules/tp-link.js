/**
 * Import external libraries
 */
const scheduler = require('node-schedule');
const serviceHelper = require('alfred-helper');
const dateFormat = require('dateformat');

/**
 * Import helper libraries
 */
const deviceHelper = require('../api/devices/devices.js');

async function updateDevice(data) {
  try {
    serviceHelper.log(
      'info',
      'Update device',
    );

    const req = {
      params: { deviceHost: '192.168.85.43', power: data.power }, // Harriets lights
    };
    const updateResponse = await deviceHelper.updateDevice(req);
    if (updateResponse instanceof Error) throw new Error(`There was an error updating ${data.name}`);
  } catch (err) {
    serviceHelper.log(
      'error',
      err.message,
    );
  }
}

async function setupSchedule(data) {
  serviceHelper.log(
    'trace',
    `Create tp-link schedule for ${data.name}`,
  );
  if (data.hour === null || data.minute === null) {
    serviceHelper.log(
      'error',
      'Schedule values were null',
    );
    return true;
  }

  const date = new Date();
  if (!data.power) { // Off schedule
    date.setHours(data.hour);
    date.setMinutes(data.minute);
  } else { // On schedule
    // Harriets bed light
    if (data.deviceid === '800693F733CEA366746DA9EE9AA3CE0C17D8ACF4') {
      // Check if girls are staying
      const kidsAtHomeToday = await serviceHelper.kidsAtHomeToday();
      if (kidsAtHomeToday instanceof Error) return kidsAtHomeToday;
      if (!kidsAtHomeToday) {
        serviceHelper.log(
          'info',
          'Override schedule: Girls are not staying',
        );
        return true;
      }
    }
    serviceHelper.log(
      'trace',
      'Getting sunset data',
    );
    const url = `${process.env.ALFRED_WEATHER_SERVICE}/sunset`;
    serviceHelper.log(
      'trace',
      url,
    );
    if (data.ai_override) {
      const sunsetData = await serviceHelper.callAlfredServiceGet(url);
      if (sunsetData instanceof Error) {
        serviceHelper.log(
          'trace',
          sunsetData.error.message,
        );
        date.setHours(data.hour);
        date.setMinutes(data.minute);
      } else {
        const sunSet = new Date(`${'01/01/1900 '}${sunsetData.sunset}`);
        sunSet.setMinutes(sunSet.getMinutes() - 30);

        // If sunset < 5pm then reset to 5pm
        if (dateFormat(sunSet, 'HH:MM') < '17:00') {
          sunSet.setHours(17);
          sunSet.setMinutes(0);
        }
        date.setHours(sunSet.getHours());
        date.setMinutes(sunSet.getMinutes());
      }
    } else {
      date.setHours(data.hour);
      date.setMinutes(data.minute);
    }
  }

  const schedule = scheduler.scheduleJob(date, () => updateDevice(data));
  global.schedules.push(schedule);
  serviceHelper.log(
    'info',
    `${data.name} schedule will run at ${dateFormat(
      date,
      'dd-mm-yyyy @ HH:MM',
    )}`,
  );
  return true;
}

/**
 * Set up schedules
 */
exports.setup = async () => {
  try {
    // Get data from data store
    const SQL = 'SELECT name, hour, minute, deviceid, name, power, ai_override FROM tp_link_schedules WHERE active';
    serviceHelper.log(
      'trace',
      'Connect to data store connection pool',
    );
    const dbConnection = await serviceHelper.connectToDB('tplink');
    serviceHelper.log(
      'trace',
      'Get schedule settings',
    );
    const results = await dbConnection.query(SQL);
    serviceHelper.log(
      'trace',
      'Release the data store connection back to the pool',
    );
    await dbConnection.end(); // Close data store connection
    if (results.rowCount === 0) {
      // Exit function as no data to process
      serviceHelper.log(
        'info',
        'No tp-link schedules are active',
      );
      return false;
    }

    // Setup schedules
    results.rows.map((info) => setupSchedule(info));
    return true;
  } catch (err) {
    serviceHelper.log(
      'error',
      err.message,
    );
    return false;
  }
};
