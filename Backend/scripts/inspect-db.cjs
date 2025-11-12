// Backend/scripts/inspect-db.cjs
const { db } = require("../db.cjs");

db.serialize(() => {
db.all("SELECT id, username, role, must_change_password, created_at FROM users", (err, rows) => {
    if (err) console.error(err);
    else console.log("Users:", rows);
  });
  db.all("SELECT id, name FROM devices", (err, rows) => {
    if (err) console.error(err);
    else console.log("Devices:", rows);
  });
  db.all("SELECT key FROM settings", (err, rows) => {
    if (err) console.error(err);
    else console.log("Settings keys:", rows);
  });
});
