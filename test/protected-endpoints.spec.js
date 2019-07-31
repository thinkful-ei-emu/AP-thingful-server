const knex = require("knex");
const app = require("../src/app");
const helpers = require("./test-helpers");

describe.only(`Protected endpoints`, () => {
  let db;

  const { testUsers, testThings, testReviews } = helpers.makeThingsFixtures();

  before("make knex instance", () => {
    db = knex({
      client: "pg",
      connection: process.env.TEST_DB_URL
    });
    app.set("db", db);
  });

  after("disconnect from db", () => db.destroy());

  before("cleanup", () => helpers.cleanTables(db));

  afterEach("cleanup", () => helpers.cleanTables(db));

  beforeEach("insert things", () =>
    helpers.seedThingsTables(
        db,
        testUsers,
        testThings,
        testReviews
        )
  );

  const protectedEndpoints = [
    {
      name: "GET /api/things/:thing_id",
      path: "/api/things/1",
      method: supertest(app).get,
    },

    {
      name: "GET /api/things/:thing_id/reviews",
      path: "/api/things/1/reviews",
      method: supertest(app).get,
    },

    {
        name: "POST /api/things/:thing_id/reviews",
        path: "/api/things/1/reviews",
        method: supertest(app).post,
      },

  ];

  protectedEndpoints.forEach(endpoint => {
    describe(endpoint.name, () => {
      it(`Responds with 401 'Missing bearer token' when no bearer token`, () => {
        return endpoint.method(endpoint.path)
          .expect(401, { error: `Missing bearer token` });
      });

      it.skip(`responds 401 'Unauthorized reqest' when no credentials in token`, () => {
        const userNoCreds = { user_name: "", password: "" };
        return endpoint.method(endpoint.path)
          .set("Authorization", makeAuthHeader(userNoCreds))
          .expect(401, { error: `Unauthorized request` });
      });

      it.skip(`responds 401 'Unauthorized request' when invalid user`, () => {
        const userInvalidCreds = { user_name: "user-not", password: "existy" };
        return endpoint.method(endpoint.path)
          .set("Authorization", makeAuthHeader(userInvalidCreds))
          .expect(401, { error: `Unauthorized request` });
      });

      it.skip(`responds 401 'Unauthorized request' when invalid password`, () => {
        const userInvalidPass = {
          user_name: testUsers[0].user_name,
          password: "wrong"
        };
        return endpoint.method(endpoint.path)
          .set("Authorization", makeAuthHeader(userInvalidPass))
          .expect(401, { error: `Unauthorized request` });
      });
    });
  });
});
