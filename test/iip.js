'use strict'

var chai = require('chai')
chai.should()
chai.use(require("chai-as-promised"))
chai.config.includeStack = true;
chai.config.showDiff = true;
chai.config.truncateThreshold = 20;

var Recaius = require('../')
var config = require('./config')

describe('Iip', function () {
    const user = 'sdk_test_user'
    const dbName = 'sdk_test_db'
    let recaius = new Recaius(config)
    let dbid = null

    before(function () {
        return recaius.auth.login()
            .catch(() => {
                console.log('ログイン失敗')
                this.skip()
            })
    })

    describe('データベース操作', function () {
        it('データベースの一覧が取得できる', function () {
            return recaius.iip.getDatabases(user)
                .should.be.fulfilled.then(resp => {
                    resp.should.contain.keys('databases')
                    resp.databases.should.be.instanceof(Array)
                })
        })

        it('データベースの削除が出来る', function () {
            return recaius.iip.addDatabase(user, dbName)
                .catch(err => console.log("addDatabase:", err))
                .should.be.fulfilled.then(resp => {
                    return recaius.iip.getDatabases(user).catch(err => console.log("getDatabases:", err))
                }).should.be.fulfilled.then(resp => {
                    resp.databases.should.be.instanceof(Array)
                    return Promise.all(resp.databases.map(x => {
                        x.should.contain.keys('dbid')
                        return recaius.iip.deleteDatabase(user, x.dbid).catch(err => console.log("deleteDatabase", err))
                    }))
                }).should.be.fulfilled
        })

        it('データベースの追加が出来る', function () {
            return recaius.iip.addDatabase(user, dbName)
                .should.be.fulfilled.then(resp => {
                    resp.should.have.all.keys('database')
                    resp.database.should.have.all.keys('dbid', 'uid', 'dbname', 'created_timestamp', 'updated_timestamp', 'dictinfo', 'document_summary')
                    resp.database.should.contain.keys({ 'dbname': dbName })
                    dbid = resp.database.dbid
                })
        })

        it('データベースの情報が取得できる', function () {
            if (!dbid) this.skip()
            return recaius.iip.getDatabaseProperty(user, dbid)
                .should.be.fulfilled.then(resp => {
                    resp.should.have.all.keys('database')
                    resp.database.should.contain.keys('dbid', 'uid', 'dbname', 'created_timestamp', 'updated_timestamp', 'dictinfo', 'document_summary')
                })
        })

        it('データベースの語彙辞書は文書が無いので作れない', function () {
            if (!dbid) this.skip()
            return recaius.iip.updateVocabulary(user, dbid)
                .should.be.rejected
                .then(err => {
                    err.should.contain.keys('status')
                    err.status.should.be.equal(400)
                })
        })

        it('データベースのキーワードは文書が無いので取得できない', function () {
            if (!dbid) this.skip()
            return recaius.iip.getDatabaseKeywords(user, dbid)
                .should.be.rejected
                .then(err => {
                    err.should.contain.keys('status')
                    err.status.should.be.equal(400)
                })
        })
    })

    after(function() {
        return recaius.auth.logout()
    })
})

