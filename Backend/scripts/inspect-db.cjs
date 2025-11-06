// Backend/scripts/inspect-db.cjs
const { db } = require("../db.cjs");

db.serialize(() => {
  db.all("SELECT id, email, created_at FROM users", (err, rows) => {
    if (err) console.error(err);
    else {
      console.log("Users:", rows);
    }
  });
});
