/**
 * Import external libraries
 */
const Skills = require('restify-router').Router;

/**
 * Import helper libraries
 */
const serviceHelper = require('alfred-helper');

const skill = new Skills();

/**
 * @type get
 * @path /
 */
async function ping(req, res, next) {
  serviceHelper.ping(
    res,
    next,
  );
}
skill.get(
  '/ping',
  ping,
);
skill.get(
  '/healthcheck',
  ping,
);

module.exports = skill;
