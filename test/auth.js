'use strict'

var chai = require('chai')
chai.should()
chai.use(require("chai-as-promised"))
chai.config.includeStack = true;
chai.config.showDiff = true;
chai.config.truncateThreshold = 20;

var Recaius = require('../')
var config = require('./config')

describe('Auth', function () {
    let recaius

    it('ログインできる', function () {
        recaius = new Recaius(config, { expire_sec: 35 })
        return recaius.auth.login()
            .catch(err => console.log('Login failed', err))
            .should.be.fulfilled
    })

    it('トークン取得できる', function () {
        recaius.auth.token().should.be.a('string')
    })

    it('ログアウト出来る', function () {
        recaius.auth.logout().should.be.fulfilled
    })

    it('有効期限切れが感知できる', done => {
        recaius = new Recaius(config, { expire_sec: 31 })
        recaius.auth.login().should.be.fulfilled.then(() => {
            setTimeout(() => {
                recaius.auth.needLogin().should.be.true;
                (() => { recaius.auth.token() }).should.throw(recaius.exceptions.NeedLoginError)
                recaius.auth.logout().then(() => {
                    done()
                }).catch(r => {
                    done(r)
                })
            }, 2000)
        })
    })
})

