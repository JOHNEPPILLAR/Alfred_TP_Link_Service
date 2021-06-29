/**
 * Import external libraries
 */
const dateFormat = require('dateformat');
const debug = require('debug')('TPLink:Schedules');
const { setTimeout } = require('timers/promises');

/**
 * Import helper libraries
 */
const deviceHelper = require('../api/devices/devices.js');

// Update tp-link device when schedule is run
async function updateDevice(data, reTryCounter = 0) {
  try {
    debug(`Update device: ${data.device[0].deviceIP}`);
    const req = {
      params: { deviceIP: data.device[0].deviceIP, power: data.power },
    };
    const updateResponse = await deviceHelper.updateDevice.call(this, req);
    if (updateResponse instanceof Error) {
      this.logger.error(
        `${this._traceStack()} - There was an error updating: ${
          data.device[0].deviceIP
        }`,
      );
      if (reTryCounter > 4) {
        throw new Error('Retry limit reached');
        return;
      }
      await setTimeout(1 * 60000); // Wait 1 minute then retry
      updateDevice.call(this, data, reTryCounter++);
    }
  } catch (err) {
    this.logger.error(`${this._traceStack()} - ${err.message}`);
  }
}

// Setup tp-link schedule
async function setupSchedule(data) {
  const date = new Date();

  debug(`Create tp-link schedule for ${data.description}`);
  if (data.hour === null || data.minute === null) {
    this.logger.error('Schedule data is empty');
    return false;
  }
  date.setHours(data.hour);
  date.setMinutes(data.minute);
  debug(`Date/time set to: ${dateFormat(date, 'HH:MM')}`);

  if (data.device[0].room === 'kids' && data.power) {
    // Check if kids are staying
    debug(`Check if kids are staying`);

    const kidsAtHomeToday = await this._kidsAtHomeToday();
    // check if in error state
    if (
      kidsAtHomeToday instanceof Error ||
      typeof kidsAtHomeToday === 'undefined' ||
      kidsAtHomeToday === null
    )
      return false;

    if (!kidsAtHomeToday) {
      this.logger.info(
        `Override schedule (${data.description}): Kids are not staying`,
      );
      return false;
    }
    this.logger.info('Kids are staying: Setup schedule');
  }

  if (data.override) {
    let overRideAPIResults;

    if (data.hour < 13) {
      debug(`Getting sunrise data`);
      const url = `${process.env.ALFRED_WEATHER_SERVICE}/sunrise`;
      overRideAPIResults = await this._callAlfredServiceGet(url);
    } else {
      debug(`Getting sunset data`);
      const url = `${process.env.ALFRED_WEATHER_SERVICE}/sunset`;
      overRideAPIResults = await this._callAlfredServiceGet(url);
    }

    if (overRideAPIResults instanceof Error)
      this.logger.error(
        `${this._traceStack()} - ${overRideAPIResults.response.data.error}`,
      );

    if (!(overRideAPIResults instanceof Error)) {
      const overRideTime = new Date(
        `${'01/01/1900 '}${overRideAPIResults.time}`,
      );
      overRideTime.setMinutes(overRideTime.getMinutes() - 30);
      date.setHours(overRideTime.getHours());
      date.setMinutes(overRideTime.getMinutes());
      debug(`Override Date/time to: ${dateFormat(date, 'HH:MM')}`);
    }
  }

  debug(`Register tp-link schedule: ${data.description}`);
  this.schedules.push({
    hour: date.getHours(),
    minute: date.getMinutes(),
    description: data.description,
    functionToCall: updateDevice,
    args: data,
  });
  return true;
}

/**
 * Set up schedules
 */
async function setupSchedules() {
  let dbConnection;

  try {
    // Clear current schedules array
    debug(`Clear current schedules`);
    this.schedules = [];

    // Setup tp-link schedules
    debug(`Setting up Schedules`);
    dbConnection = await this._connectToDB();
    debug(`Query DB`);
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
    for (const data of results) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await setupSchedule.call(this, data);
      } catch (err) {
        this.logger.error(`${this._traceStack()} - ${err.message}`);
      }
    }

    // Activate schedules
    await this.activateSchedules();
    return true;
  } catch (err) {
    this.logger.error(`${this._traceStack()} - ${err.message}`);
    return err;
  } finally {
    try {
      debug(`Close DB connection`);
      await dbConnection.close();
    } catch (err) {
      debug(`Not able to close DB`);
    }
  }
}

module.exports = {
  setupSchedules,
};
