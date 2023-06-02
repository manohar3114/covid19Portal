const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
const app = express();
let db = null;
app.use(express.json());
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const initializeDbServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server started successfully");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};
initializeDbServer();

app.post("/login", async (request, response) => {
  const { username, password } = request.body;
  const dbCheckQuery = `SELECT * FROM user WHERE username = "${username}"`;
  //const hashedPassword = await bcrypt.hash()

  const dbCheckResponse = await db.get(dbCheckQuery);
  if (dbCheckResponse === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordCorrect = await bcrypt.compare(
      password,
      dbCheckResponse.password
    );
    if (isPasswordCorrect === true) {
      //response.send("Successful login of the user");
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

const authenticationToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

app.get("/states", authenticationToken, async (request, response) => {
  //const { stateId, stateName, population } = request.body;
  const dbQuery = `
    SELECT
        *
    FROM
        state
    `;
  const dbResponseQuery = await db.all(dbQuery);
  const convertToCamelCase = (dbQ) => {
    return {
      stateId: dbQ.state_id,
      stateName: dbQ.state_name,
      population: dbQ.population,
    };
  };
  response.send(dbResponseQuery.map((each) => convertToCamelCase(each)));
});

app.get("/states/:stateId/", authenticationToken, async (request, response) => {
  const { stateId } = request.params;
  const dbStateQuery = `
    SELECT
        *
    FROM
        state
    WHERE
        state_id = ${stateId}
    `;
  const dbStateResponse = await db.get(dbStateQuery);
  const convertToCamelCase = (dbQ) => {
    return {
      stateId: dbQ.state_id,
      stateName: dbQ.state_name,
      population: dbQ.population,
    };
  };
  response.send(convertToCamelCase(dbStateResponse));
});

app.post("/districts", authenticationToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const dbPostQuery = `
    INSERT INTO district (district_name, state_id, cases, cured, active, deaths)
    VALUES ("${districtName}", ${stateId}, ${cases}, ${cured}, ${active}, ${deaths})
    `;
  await db.run(dbPostQuery);
  response.send("District Successfully Added");
});

app.get(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const allDistrictsQuery = `
    SELECT * FROM district WHERE district_id = ${districtId}
    `;
    const dbAllDistrictsResponse = await db.get(allDistrictsQuery);
    const convertToCamelCase = (dbObject) => {
      return {
        districtId: dbObject.district_id,
        districtName: dbObject.district_name,
        stateId: dbObject.state_id,
        cases: dbObject.cases,
        cured: dbObject.cured,
        active: dbObject.active,
        deaths: dbObject.deaths,
      };
    };
    response.send(convertToCamelCase(dbAllDistrictsResponse));
  }
);

app.delete(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const dbDeleteQuery = `
    DELETE FROM district
    WHERE district_id = ${districtId}
    `;
    await db.run(dbDeleteQuery);
    response.send("District Removed");
  }
);

app.put(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const dbUpdateQuery = `
    UPDATE district
    SET
        district_name = "${districtName}",
        state_id = ${stateId},
        cases = ${cases},
        cured = ${cured},
        active = ${active},
        deaths = ${deaths}
    WHERE
        district_id = ${districtId}
    `;
    await db.run(dbUpdateQuery);
    response.send("District Details Updated");
  }
);
app.get(
  "/states/:stateId/stats",
  authenticationToken,
  async (request, response) => {
    const { stateId } = request.params;
    const dbQuery = `
    SELECT 
        SUM(cases) AS totalCases,
        SUM(cured) AS totalCured,
        SUM(active) AS totalActive,
        SUM(deaths) AS totalDeaths
    FROM district
    WHERE state_id = ${stateId}
    `;
    const dbResponse = await db.get(dbQuery);
    response.send(dbResponse);
  }
);
module.exports = app;
