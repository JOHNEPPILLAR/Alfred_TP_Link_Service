CREATE TABLE tp_link_schedules (
  id          SERIAL      PRIMARY KEY,
  hour        INT         NOT NULL,
  minute      INT         NOT NULL,
  deviceID    TEXT        NOT NULL,
  name        TEXT        NOT NULL,
  action      BOOLEAN     NOT NULL DEFAULT FALSE,
  active      BOOLEAN     NOT NULL DEFAULT TRUE
)
