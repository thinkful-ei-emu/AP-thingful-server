const knex = require('knex')
const app = require('../src/app')
const helpers = require('./test-helpers')
const bcrypt = require('bcryptjs')

describe.only('Users Endpoints', function() {
  let db

  const { testUsers } = helpers.makeThingsFixtures()
  const testUser = testUsers[0]

  before('make knex instance', () => {
    db = knex({
      client: 'pg',
      connection: process.env.TEST_DB_URL,
    })
    app.set('db', db)
  })

  after('disconnect from db', () => db.destroy())

  before('cleanup', () => helpers.cleanTables(db))

  afterEach('cleanup', () => helpers.cleanTables(db))

  describe(`POST /api/users`, () => {
    context(`User Validation`, () => {
      beforeEach('insert users', () =>
        helpers.seedUsers(
          db,
          testUsers,
        )
      )

      const requiredFields = ['user_name', 'password', 'full_name']

      requiredFields.forEach(field => {
        const registerAttemptBody = {
          user_name: 'test user_name',
          password: 'test password',
          full_name: 'test full_name',
          nickname: 'test nickname',
        }

        it(`responds with 400 required error when '${field}' is missing`, () => {
          delete registerAttemptBody[field]

          return supertest(app)
            .post('/api/users')
            .send(registerAttemptBody)
            .expect(400, {
              error: `Missing '${field}' in request body`,
            })
        })
      })

      it(`responds 400 'Password be longer than 8 characters'`, ()=>{
          const userShortPassword = {
              user_name: 'test user_name',
              password: '1235',
              full_name: 'test full_name'
          }
          return supertest(app)
            .post(`/api/users`)
            .send(userShortPassword)
            .expect(400, {error: 'Password be longer than 8 characters'})
      })

      it(`responds 400 'Password be less than 72 characters'`, ()=>{
        const userLongPassword = {
            user_name: 'test user_name',
            password: '*'.repeat(73),
            full_name: 'test full_name'
        }
        return supertest(app)
          .post(`/api/users`)
          .send(userLongPassword)
          .expect(400, {error: 'Password be less than 72 characters'})
    })

    it(`responds 400 error when password starts with space`, ()=>{
        const startsWithSpace = {
            user_name: 'test user_name',
            password: ' 1Aa!2Bb@',
            full_name: 'test full_name'
        }
        return supertest(app)
          .post(`/api/users`)
          .send(startsWithSpace)
          .expect(400, {error: 'Password must not start or end with empty spaces'})
    })

    it(`responds 400 error when password ends with space`, ()=>{
        const endsWithSpace = {
            user_name: 'test user_name',
            password: '1Aa!2Bb@ ',
            full_name: 'test full_name'
        }
        return supertest(app)
          .post(`/api/users`)
          .send(endsWithSpace)
          .expect(400, {error: 'Password must not start or end with empty spaces'})
    })

    it(`responds 400 error when password is not complex`, ()=>{
        const notComplex = {
            user_name: 'test user_name',
            password: '11AAaabb',
            full_name: 'test full_name'
        }
        return supertest(app)
          .post(`/api/users`)
          .send(notComplex)
          .expect(400, {error: 'Password must contain 1 upper case, lower case, number and special character'})
    })

    it(`responds 400 when username taken`, ()=>{
        const usernameTaken = {
            user_name: testUser.user_name,
            password: '1Aa!2Bb@',
            full_name: 'test full_name'
        }
        return supertest(app)
          .post(`/api/users`)
          .send(usernameTaken)
          .expect(400, {error: 'Username already taken'})
    })

      
    })
    context('Happy path', ()=>{
        it(`responds 201, serialized user, storing bcrypt password`, ()=>{
            const newUser = {
                user_name: 'test user_name',
                full_name: 'test full_name',
                password: '11AAaa!!'
            }
            return supertest(app)
                .post('/api/users')
                .send(newUser)
                .expect(201)
                .expect(res=>{
                    expect(res.body).to.have.property('id')
                    expect(res.body.user_name).to.eql(newUser.user_name)
                    expect(res.body.full_name).to.eql(newUser.full_name)
                    expect(res.body.nickname).to.eql('')
                    expect(res.body).to.not.have.property('password')
                    expect(res.headers.location).to.eql(`/api/users/${res.body.id}`)
                })
                .expect(res =>
                    db
                        .from('thingful_users')
                        .select('*')
                        .where({ id: res.body.id })
                        .first()
                        .then(row => {
                        expect(row.user_name).to.eql(newUser.user_name)
                        expect(row.full_name).to.eql(newUser.full_name)
                        expect(row.nickname).to.eql(null)

                        return bcrypt.compare(newUser.password, row.password)
                        })
                        .then(compareMatch=>{
                            expect(compareMatch).to.be.true
                        })
                    )
        })
    })
  })
})