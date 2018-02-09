'use strict'

var chai = require('chai')
chai.should()
chai.use(require("chai-as-promised"))
chai.config.includeStack = true;
chai.config.showDiff = true;
chai.config.truncateThreshold = 20;

var Recaius = require('../')
var config = require('./config')

describe('Mt', function() {
    let recaius

    before(function() {
        recaius = new Recaius(config)
        return recaius.auth.login()
        .catch(() => {
            console.log('ログイン失敗')
            this.skip()
        })
    })

    it('翻訳できる', function() {
        return recaius.mt.translate({src_lang: 'ja', tgt_lang: 'en', query: '東芝'})
        .should.be.fulfilled.then(resp => {
            resp.should.have.all.keys('data')
            resp.data.should.have.all.keys('translations')
        })
    })

    it('整文出来る', function() {
        return recaius.mt.arrange({src_lang: 'ja', query: '東芝'})
        .should.be.fulfilled.then(resp => {
            resp.should.have.all.keys('data')
            resp.data.should.have.all.keys('arrangements')
        })
    })

    it('整文翻訳できる', function() {
        return recaius.mt.translate({src_lang: 'ja', tgt_lang: 'en', query: '東芝', arrange: true})
        .should.be.fulfilled.then(resp => {
            resp.should.have.all.keys('data')
            resp.data.should.have.all.keys('translations', 'arrangements')
        })
    })

    after(function() {
        return recaius.auth.logout()
    })

})

