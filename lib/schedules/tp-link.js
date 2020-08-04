/**
 * Import external libraries
 */
const dateFormat = require('dateformat');

/**
 * Import helper libraries
 */
const deviceHelper = require('../api/devices/devices.js');

// Update tp-link device when schedule is run
async function updateDevice(data) {
  try {
    this.logger.trace(`${this._traceStack()} - Update device`);
    const req = {
      params: { deviceID: data.deviceid, power: data.power }, // Harriets lights
    };
    const updateResponse = await deviceHelper.updateDevice.call(this, req);
    if (updateResponse instanceof Error)
      throw new Error(`There was an error updating ${data.name}`);
  } catch (err) {
    this.logger.error(`${this._traceStack()} - ${err.message}`);
  }
}

// Setup tp-link schedule
async function setupSchedule(data) {
  try {
    this.logger.debug(
      `${this._traceStack()} - Create tp-link schedule for ${data.name}`,
    );
    if (data.hour === null || data.minute === null) {
      this.logger.error('Schedule data is empty');
      return false;
    }
    const date = new Date();
    date.setHours(data.hour);
    date.setMinutes(data.minute);
    this.logger.debug(
      `${this._traceStack()} - Date/time set to: ${dateFormat(date, 'HH:MM')}`,
    );

    if (
      data.deviceid === '800693F733CEA366746DA9EE9AA3CE0C17D8ACF4' &&
      data.power
    ) {
      // Check if girls are staying
      this.logger.debug(`${this._traceStack()} - Check if girls are staying`);
      const kidsAtHomeToday = await this._kidsAtHomeToday();
      if (kidsAtHomeToday instanceof Error) return kidsAtHomeToday;
      if (!kidsAtHomeToday) {
        this.logger.info('Override schedule: Girls are not staying');
        return false;
      }
      this.logger.info('Girls are staying: Setup schedule');
      if (data.ai_override) {
        this.logger.debug(`${this._traceStack()} - Getting sunset data`);
        const url = `${process.env.ALFRED_WEATHER_SERVICE}/sunset`;
        const sunsetData = await this._callAlfredServiceGet(url);
        if (sunsetData instanceof Error) {
          this.logger.error(`${this._traceStack()} - ${sunsetData.message}`);
          date.setHours(data.hour);
          date.setMinutes(data.minute);
          this.logger.debug(
            `${this._traceStack()} - Date/time set to: ${dateFormat(
              date,
              'HH:MM',
            )}`,
          );
        } else {
          const sunSet = new Date(`${'01/01/1900 '}${sunsetData.sunset}`);
          sunSet.setMinutes(sunSet.getMinutes() - 30);

          // If sunset < 6pm then reset to 6pm
          if (dateFormat(sunSet, 'HH:MM') < '18:00') {
            this.logger.debug(
              `${this._traceStack()} - Resetting time due to sunset being before 6pm`,
            );
            sunSet.setHours(18);
            sunSet.setMinutes(0);
          }

          // If sunset > 8pm then reset to 8pm
          if (dateFormat(sunSet, 'HH:MM') > '20:00') {
            this.logger.debug(
              `${this._traceStack()} - Resetting time due to sunset being after 8pm`,
            );
            sunSet.setHours(20);
            sunSet.setMinutes(0);
          }

          date.setHours(sunSet.getHours());
          date.setMinutes(sunSet.getMinutes());
          this.logger.debug(
            `${this._traceStack()} - Date/time set to: ${dateFormat(
              date,
              'HH:MM',
            )}`,
          );
        }
      }
    }

    this.logger.debug(`${this._traceStack()} - Register tp-link schedule`);
    this.schedules.push({
      hour: date.getHours(),
      minute: date.getMinutes(),
      description: data.name,
      functionToCall: updateDevice,
      args: data,
    });
    return true;
  } catch (err) {
    this.logger.error(`${this._traceStack()} - ${err.message}`);
  }
  return true;
}

/**
 * Set up schedules
 */
async function setupSchedules() {
  try {
    // Clear current schedules array
    this.logger.debug(`${this._traceStack()} - Clear current schedules`);
    this.schedules = [];

    // Setup tp-link schedules
    this.logger.debug(`${this._traceStack()} - Setting up Schedules`);
    const sql =
      'SELECT hour, minute, deviceid, name, power, ai_override FROM tp_link_schedules WHERE active';
    const dbConnection = await this._connectToDB('tplink');
    this.logger.trace(`${this._traceStack()} - Execute sql`);
    const results = await dbConnection.query(sql);
    this.logger.trace(
      `${this._traceStack()} - Release the data store connection back to the pool`,
    );
    await dbConnection.end(); // Close data store connection
    if (results.rowCount === 0) {
      // Exit function as no data to process
      this.logger.info('No tp-link schedules are active');
      return false;
    }

    // Setup schedules
    await Promise.all(
      results.rows.map(async (info) => {
        await setupSchedule.call(this, info);
      }),
    );

    // Activate schedules
    await this.activateSchedules();
    return true;
  } catch (err) {
    this.logger.error(`${this._traceStack()} - ${err.message}`);
    return false;
  }
}

module.exports = {
  setupSchedules,
};
