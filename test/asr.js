'use strict'

const fs = require('fs')
const path = require('path')

var chai = require('chai')
chai.should()
chai.use(require("chai-as-promised"))
chai.config.includeStack = true;
chai.config.showDiff = true;
chai.config.truncateThreshold = 20;

var Recaius = require('../')
var config = require('./config')

describe('Asr', function() {
    let recaius
    let session
    let wav, raw

    before(function() {
        // waveのロード
        recaius = new Recaius(config)
        wav = fs.readFileSync(path.join(__dirname, 'test.wav'))
        raw = recaius.asr.getRawFromWave(wav)
        return recaius.auth.login()
        .catch(err => {
            console.log('ログイン失敗')
            this.skip()
        })
    })

    it('uuidを取得できる', function() {
        session = recaius.asr.newSession()
        return session.start({model_id: 1}).should.be.fulfilled.then(resp => {
            resp.should.be.an('object')
            resp.should.have.all.keys('uuid')
        })
    })

    it('uuidを開放できる', function() {
        return session.stop().should.be.fulfilled
    })

    it('stop後に再度start出来る', function() {
        return session.start({model_id: 1}).should.be.fulfilled.then(resp => {
            resp.should.be.an('object')
            resp.should.have.all.keys('uuid')
            return session.stop().should.be.fulfilled
        })
    })

    it('wavをそのまま認識できる', done => {
        recaius.asr.recognize(wav, {model_id: 1}, {inputType: 'wave'})
        .then(results => {
            console.log(results)
            done()
        }).catch(e => {
            console.log(e)
            done(e)
        })
    })

    it('pushして音声認識できる', done => {
        session = recaius.asr.newSession()
        let result = null
        session.setCallback('Result', obj => {
            console.log('onResult:', obj)
            result = obj
        })

        session.setCallback('NoData', () => {
            console.log('onNoData:', result)
            result.should.not.be.null
            session.stop().should.be.fulfilled.then(() => done())
        })

        session.setCallback('Reject', () => {
            console.log('onReject')
        })
        session.setCallback('Failure', () => {
            console.log('onFailure')
        })
        session.setCallback('SOS', () => {
            console.log('onSOS')
        })
        session.start({model_id: 1}).should.be.fulfilled.then(resp => {
            for(let i = 0; i < raw.buffer.byteLength; i += 3000) {
                let sz = Math.min((raw.buffer.byteLength - i), 3000)
                let a = new Int16Array(raw.buffer, i, sz / 2)
                session.push(a)
            }
            return session.flush()
        }).then(() => {
            session.checkResultFor('NoData')
        }).catch(e => {
            console.log(e)
            done(e)
        })
    })

    // TODO: ユーザー辞書登録系

    after(function() {
        return recaius.auth.logout()
    })

})

