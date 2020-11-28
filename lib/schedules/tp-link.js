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
    this.logger.trace(
      `${this._traceStack()} - Update device: ${data.device[0].deviceIP}`,
    );
    const req = {
      params: { deviceIP: data.device[0].deviceIP, power: data.power },
    };
    const updateResponse = await deviceHelper.updateDevice.call(this, req);
    if (updateResponse instanceof Error)
      throw new Error(
        `There was an error updating: ${data.device[0].deviceIP}`,
      );
  } catch (err) {
    this.logger.error(`${this._traceStack()} - ${err.message}`);
  }
}

// Setup tp-link schedule
async function setupSchedule(data) {
  const date = new Date();

  this.logger.debug(
    `${this._traceStack()} - Create tp-link schedule for ${data.description}`,
  );
  if (data.hour === null || data.minute === null) {
    this.logger.error('Schedule data is empty');
    return false;
  }
  date.setHours(data.hour);
  date.setMinutes(data.minute);
  this.logger.debug(
    `${this._traceStack()} - Date/time set to: ${dateFormat(date, 'HH:MM')}`,
  );

  if (data.device[0].room === 'kids' && data.power) {
    // Check if kids are staying
    this.logger.debug(`${this._traceStack()} - Check if kids are staying`);

    let kidsAtHomeToday;
    try {
      kidsAtHomeToday = await this._kidsAtHomeToday();
    } catch (err) {
      this.logger.error(`${this._traceStack()} - ${err.message}`);
    }

    // check if in error state
    if (
      kidsAtHomeToday instanceof Error ||
      typeof kidsAtHomeToday === 'undefined' ||
      kidsAtHomeToday === null
    )
      return false;

    if (!kidsAtHomeToday) {
      this.logger.info('Override schedule: Kids are not staying');
      return false;
    }

    this.logger.info('Kids are staying: Setup schedule');
    if (data.override) {
      let overRideAPIResults;
      if (data.hour < 13) {
        this.logger.debug(`${this._traceStack()} - Getting sunrise data`);
        try {
          const url = `${process.env.ALFRED_WEATHER_SERVICE}/sunrise`;
          overRideAPIResults = await this._callAlfredServiceGet(url);
        } catch (err) {
          this.logger.error(`${this._traceStack()} - ${err.message}`);
        }
      } else {
        this.logger.debug(`${this._traceStack()} - Getting sunset data`);
        try {
          const url = `${process.env.ALFRED_WEATHER_SERVICE}/sunset`;
          overRideAPIResults = await this._callAlfredServiceGet(url);
        } catch (err) {
          this.logger.error(`${this._traceStack()} - ${err.message}`);
        }
      }

      if (overRideAPIResults instanceof Error)
        this.logger.error(
          `${this._traceStack()} - ${overRideAPIResults.response.data.error}`,
        );

      if (
        overRideAPIResults instanceof Error ||
        typeof overRideAPIResults === 'undefined' ||
        overRideAPIResults === null
      ) {
        date.setHours(data.hour);
        date.setMinutes(data.minute);
        this.logger.debug(
          `${this._traceStack()} - Date/time set to: ${dateFormat(
            date,
            'HH:MM',
          )}`,
        );
      } else {
        const overRideTime = new Date(
          `${'01/01/1900 '}${overRideAPIResults.time}`,
        );
        overRideTime.setMinutes(overRideTime.getMinutes() - 30);

        date.setHours(overRideTime.getHours());
        date.setMinutes(overRideTime.getMinutes());
        this.logger.debug(
          `${this._traceStack()} - Date/time set to: ${dateFormat(
            date,
            'HH:MM',
          )}`,
        );
      }
    }
  }

  try {
    this.logger.debug(`${this._traceStack()} - Register tp-link schedule`);
    this.schedules.push({
      hour: date.getHours(),
      minute: date.getMinutes(),
      description: data.description,
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
  let dbConnection;

  try {
    // Clear current schedules array
    this.logger.debug(`${this._traceStack()} - Clear current schedules`);
    this.schedules = [];

    // Setup tp-link schedules
    this.logger.debug(`${this._traceStack()} - Setting up Schedules`);
    dbConnection = await this._connectToDB();
    this.logger.trace(`${this._traceStack()} - Execute query`);
    const aggregate = [
      { $match: { active: true } },
      {
        $lookup: {
          from: 'devices',
          localField: 'deviceID',
          foreignField: 'deviceID',
          as: 'device',
        },
      },
    ];
    const results = await dbConnection
      .db(this.namespace)
      .collection(this.namespace)
      .aggregate(aggregate)
      .toArray();

    if (results.count === 0) {
      // Exit function as no data to process
      this.logger.error(
        `${this._traceStack()} - No tp-link schedules are active`,
      );
      return false;
    }

    // Setup schedules
    // eslint-disable-next-line no-restricted-syntax
    for await (const data of results) {
      await setupSchedule.call(this, data);
    }

    // Activate schedules
    await this.activateSchedules();
    return true;
  } catch (err) {
    this.logger.error(`${this._traceStack()} - ${err.message}`);
    return err;
  } finally {
    this.logger.trace(`${this._traceStack()} - Close DB connection`);
    await dbConnection.close();
  }
}

module.exports = {
  setupSchedules,
};
